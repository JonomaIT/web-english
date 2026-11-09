// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import {
  checkLogin,
  createCredentials,
  hashPassword,
  signSession,
  verifyPassword,
  verifySession,
} from "../api/auth.mjs";
import { createHandler } from "../api/index.mjs";
import { createStore } from "../api/store.mjs";

const NOW = Date.UTC(2026, 10, 9, 12);
const PASSWORD = "a long test password";
let creds;

// Cheap scrypt parameters: the tests check the logic, not the cost.
beforeAll(async () => {
  creds = {
    user: "joshuel",
    passwordHash: await hashPassword(PASSWORD, { N: 1024 }),
    sessionKey: "test-session-key",
  };
});

describe("password and session", () => {
  it("the password checks against its scrypt hash, and nothing else does", async () => {
    expect(await verifyPassword(PASSWORD, creds.passwordHash)).toBe(true);
    expect(await verifyPassword("a long test passworD", creds.passwordHash)).toBe(false);
    expect(await verifyPassword(undefined, creds.passwordHash)).toBe(false);
    expect(await verifyPassword(PASSWORD, "plain-text")).toBe(false);
  });

  it("the user name ignores case and spaces; a wrong user fails even with the right password", async () => {
    expect(await checkLogin(creds, " Joshuel ", PASSWORD)).toBe(true);
    expect(await checkLogin(creds, "someone", PASSWORD)).toBe(false);
    expect(await checkLogin(null, "joshuel", PASSWORD)).toBe(false);
  });

  it("a session is valid for 30 days, with its key only, and cannot be edited", () => {
    const token = signSession("joshuel", "k", NOW);
    expect(verifySession(token, "k", NOW + 29 * 86_400_000)).toEqual({ user: "joshuel" });
    expect(verifySession(token, "k", NOW + 31 * 86_400_000)).toBeNull();
    expect(verifySession(token, "another key", NOW)).toBeNull();
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "joshuel", exp: NOW + 999 * 86_400_000 })).toString(
      "base64url",
    );
    expect(verifySession(`${forged}.${sig}`, "k", NOW)).toBeNull();
    expect(verifySession("garbage", "k", NOW)).toBeNull();
    expect(verifySession(undefined, "k", NOW)).toBeNull();
  });

  it("the credential comes from SSM, decrypted; never set means null", async () => {
    const asked = [];
    const client = {
      send: async (cmd) => (asked.push(cmd.input), { Parameter: { Value: JSON.stringify(creds) } }),
    };
    expect(await createCredentials({ path: "/p/production/web-english/secrets", client })()).toEqual(creds);
    expect(asked).toEqual([{ Name: "/p/production/web-english/secrets/login", WithDecryption: true }]);
    const missing = {
      send: async () => {
        throw Object.assign(new Error("nope"), { name: "ParameterNotFound" });
      },
    };
    expect(await createCredentials({ path: "/p", client: missing })()).toBeNull();
  });
});

function fakeStore() {
  const data = {};
  return {
    data,
    async load(user) {
      return data[user] ?? {};
    },
    async save(user, cardId, progress) {
      const current = data[user]?.[cardId];
      if (current && current.card.lastReviewAt > progress.card.lastReviewAt) return false;
      data[user] = { ...data[user], [cardId]: progress };
      return true;
    },
  };
}

const event = (method, path, { cookie, body } = {}) => ({
  rawPath: path,
  requestContext: { http: { method } },
  headers: {},
  ...(cookie ? { cookies: [cookie] } : {}),
  body: body ? Buffer.from(JSON.stringify(body)).toString("base64") : undefined,
  isBase64Encoded: Boolean(body),
});

const handlerWith = (store = fakeStore(), credentials = async () => creds) =>
  createHandler({ env: {}, store, credentials, sleep: async () => {} });

async function signedIn(handler) {
  const res = await handler(event("POST", "/api/login", { body: { user: "joshuel", password: PASSWORD } }));
  return res.cookies[0].split(";")[0];
}

describe("progress API", () => {
  const card = (at) => ({
    card: { dueAt: "2026-11-14T00:00:00.000Z", lastReviewAt: at },
    firstReviewAt: "2026-11-09T10:00:00.000Z",
  });

  it("sign-in: the right password gives an HttpOnly, Secure session cookie; a wrong one, 401 and none", async () => {
    const handler = handlerWith();
    const ok = await handler(event("POST", "/api/login", { body: { user: "joshuel", password: PASSWORD } }));
    expect(ok.statusCode).toBe(200);
    expect(ok.cookies[0]).toMatch(
      /^session=[^;]+; Path=\/api; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict$/,
    );
    const bad = await handler(event("POST", "/api/login", { body: { user: "joshuel", password: "guess" } }));
    expect([bad.statusCode, bad.cookies]).toEqual([401, undefined]);
  });

  it("not set up yet (no credential in SSM): 503, nobody can sign in", async () => {
    const handler = handlerWith(fakeStore(), async () => null);
    expect(
      (await handler(event("POST", "/api/login", { body: { user: "joshuel", password: PASSWORD } })))
        .statusCode,
    ).toBe(503);
    expect((await handler(event("GET", "/api/progress"))).statusCode).toBe(401);
  });

  it("without a valid session: 401, nothing read or written", async () => {
    const store = fakeStore();
    const handler = handlerWith(store);
    expect((await handler(event("GET", "/api/progress"))).statusCode).toBe(401);
    expect((await handler(event("PUT", "/api/progress/8856c7deed", { body: card("x") }))).statusCode).toBe(
      401,
    );
    const forged = `session=${signSession("joshuel", "not the key")}`;
    expect((await handler(event("GET", "/api/me", { cookie: forged }))).statusCode).toBe(401);
    expect(store.data).toEqual({});
  });

  it("signed in: saves a card and reads it back", async () => {
    const store = fakeStore();
    const handler = handlerWith(store);
    const cookie = await signedIn(handler);
    expect(JSON.parse((await handler(event("GET", "/api/me", { cookie }))).body)).toEqual({
      user: "joshuel",
    });
    const put = await handler(
      event("PUT", "/api/progress/8856c7deed", {
        cookie,
        body: { ...card("2026-11-09T12:00:00.000Z"), review: { rating: 3, at: "2026-11-09T12:00:00.000Z" } },
      }),
    );
    expect(put.statusCode).toBe(200);
    const got = await handler(event("GET", "/api/progress", { cookie }));
    expect(JSON.parse(got.body).cards["8856c7deed"].card.lastReviewAt).toBe("2026-11-09T12:00:00.000Z");
    expect(Object.keys(store.data)).toEqual(["joshuel"]);
  });

  it("an older review from another device does not overwrite a newer one: 409", async () => {
    const handler = handlerWith();
    const cookie = await signedIn(handler);
    await handler(
      event("PUT", "/api/progress/8856c7deed", { cookie, body: card("2026-11-09T12:00:00.000Z") }),
    );
    const old = await handler(
      event("PUT", "/api/progress/8856c7deed", { cookie, body: card("2026-11-08T09:00:00.000Z") }),
    );
    expect(old.statusCode).toBe(409);
  });

  it("refuses a bad card id or body, and unknown routes", async () => {
    const handler = handlerWith();
    const cookie = await signedIn(handler);
    expect(
      (await handler(event("PUT", "/api/progress/../../x", { cookie, body: card("x") }))).statusCode,
    ).toBe(404);
    expect(
      (await handler(event("PUT", "/api/progress/NOTAHASH00", { cookie, body: card("x") }))).statusCode,
    ).toBe(400);
    expect(
      (await handler(event("PUT", "/api/progress/8856c7deed", { cookie, body: { hello: 1 } }))).statusCode,
    ).toBe(400);
    expect((await handler(event("DELETE", "/api/progress", { cookie }))).statusCode).toBe(404);
  });

  it("sign-out clears the cookie", async () => {
    const res = await handlerWith()(event("POST", "/api/logout"));
    expect(res.cookies[0]).toMatch(/^session=; Path=\/api; Max-Age=0;/);
  });
});

describe("DynamoDB store", () => {
  it("a stale write is reported, not thrown", async () => {
    const client = {
      send: async () => {
        throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
      },
    };
    const store = createStore({ table: "t", client });
    expect(await store.save("u", "8856c7deed", card0(), null)).toBe(false);
  });

  it("reads every page of the person's cards, and only cards", async () => {
    const pages = [
      {
        Items: [{ card: { S: "card#aaaaaaaaaa" }, data: { S: JSON.stringify(card0()) } }],
        LastEvaluatedKey: { k: 1 },
      },
      { Items: [{ card: { S: "card#bbbbbbbbbb" }, data: { S: JSON.stringify(card0()) } }] },
    ];
    const sent = [];
    const client = { send: async (cmd) => (sent.push(cmd.input), pages.shift()) };
    const cards = await createStore({ table: "t", client }).load("u");
    expect(Object.keys(cards)).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
    expect(sent[0].ExpressionAttributeValues[":p"].S).toBe("card#");
  });
});

function card0() {
  return {
    card: { dueAt: "2026-11-14T00:00:00.000Z", lastReviewAt: "2026-11-09T12:00:00.000Z" },
    firstReviewAt: "2026-11-09T10:00:00.000Z",
  };
}
