// The progress API of the English site, at /api/* of the same host (CloudFront → function URL).
// The site is public; only reading and saving progress needs the sign-in (auth.mjs).
//
//   POST /api/login              { user, password } → session cookie (30 days)
//   POST /api/logout             ends the session on this device
//   GET  /api/me                 who is signed in
//   GET  /api/progress           every card studied: { cards: { <id>: { card, firstReviewAt } } }
//   PUT  /api/progress/<card>    { card, firstReviewAt, review?: { rating, at } }; 409 if a later
//                                review of the card is already stored (another device)
//
// Environment: TABLE_PROGRESS (the data runner) and SECRETS_PATH (the platform).
import {
  checkLogin,
  clearCookie,
  cookieFrom,
  createCredentials,
  sessionCookie,
  signSession,
  verifySession,
} from "./auth.mjs";
import { createStore } from "./store.mjs";

const CARD_ID = /^[a-f0-9]{10}$/;
const FAILED_SIGN_IN_DELAY_MS = 600; // slows guessing; the password itself is the real protection

const json = (statusCode, body, cookies) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  ...(cookies ? { cookies } : {}),
  body: JSON.stringify(body),
});

function parseBody(event) {
  if (!event.body) return null;
  const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const validProgress = (p) =>
  p &&
  typeof p === "object" &&
  p.card &&
  typeof p.card.dueAt === "string" &&
  typeof p.firstReviewAt === "string";

export function createHandler({
  env = process.env,
  store,
  credentials,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const progress = store ?? createStore({ table: env.TABLE_PROGRESS });
  const login = credentials ?? createCredentials({ path: env.SECRETS_PATH });

  return async (event) => {
    const method = event.requestContext?.http?.method ?? "GET";
    const path = (event.rawPath ?? "/").replace(/\/+$/, "") || "/";

    if (method === "POST" && path === "/api/login") {
      const creds = await login();
      if (!creds) return json(503, { error: "Sign-in is not set up yet (scripts/set-login.mjs)." });
      const body = parseBody(event) ?? {};
      if (!(await checkLogin(creds, body.user, body.password))) {
        await sleep(FAILED_SIGN_IN_DELAY_MS);
        return json(401, { error: "Wrong user or password." });
      }
      return json(200, { user: creds.user }, [sessionCookie(signSession(creds.user, creds.sessionKey))]);
    }
    if (method === "POST" && path === "/api/logout") return json(200, { signedOut: true }, [clearCookie]);

    const creds = await login();
    const who = creds ? verifySession(cookieFrom(event), creds.sessionKey) : null;
    if (!who) return json(401, { error: "Sign in to sync your progress." });

    if (method === "GET" && path === "/api/me") return json(200, { user: who.user });
    if (method === "GET" && path === "/api/progress")
      return json(200, { cards: await progress.load(who.user) });

    const m = path.match(/^\/api\/progress\/([^/]+)$/);
    if (m && method === "PUT") {
      const cardId = m[1];
      if (!CARD_ID.test(cardId)) return json(400, { error: "Unknown card id." });
      const body = parseBody(event);
      if (!validProgress(body)) return json(400, { error: "Expected { card, firstReviewAt, review? }." });
      const { card, firstReviewAt, review } = body;
      const saved = await progress.save(who.user, cardId, { card, firstReviewAt }, review);
      return saved
        ? json(200, { saved: true })
        : json(409, { error: "A later review of this card is already saved." });
    }

    return json(404, { error: "Not found." });
  };
}

export const handler = createHandler();
