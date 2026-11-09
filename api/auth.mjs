// Sign-in of the site's one user. The credential lives in SSM, never in the repo or the bundle:
//   <SECRETS_PATH>/login   SecureString: { "user", "passwordHash", "sessionKey" }
// written by scripts/set-login.mjs (the password is hashed with scrypt there; this side only checks).
// A sign-in gives a session cookie signed with sessionKey (HMAC-SHA256), valid for 30 days:
// changing the password (or the key) ends every session.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const scrypt = promisify(scryptCb);
export const SESSION_DAYS = 30;
const CACHE_MS = 5 * 60 * 1000;

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** "scrypt$N$r$p$salt$hash": what set-login stores, so the parameters travel with the hash. */
export async function hashPassword(password, { N = 2 ** 15, r = 8, p = 1 } = {}) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, b64url(salt), b64url(hash)].join("$");
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored ?? "").split("$");
  if (kind !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(String(password ?? ""), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, expected);
}

const sameText = (a, b) => {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function signSession(user, key, now = Date.now()) {
  const payload = b64url(JSON.stringify({ u: user, exp: now + SESSION_DAYS * 86_400_000 }));
  return `${payload}.${b64url(createHmac("sha256", key).update(payload).digest())}`;
}

export function verifySession(token, key, now = Date.now()) {
  const [payload, sig] = String(token ?? "").split(".");
  if (!payload || !sig || !key) return null;
  const expected = b64url(createHmac("sha256", key).update(payload).digest());
  if (!sameText(sig, expected)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof u === "string" && typeof exp === "number" && exp > now ? { user: u } : null;
  } catch {
    return null;
  }
}

/** The stored credential, cached for a few minutes; null when it was never set. */
export function createCredentials({ path, client = new SSMClient({}) }) {
  let cache = { at: 0, value: null };
  return async () => {
    if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
    try {
      const res = await client.send(new GetParameterCommand({ Name: `${path}/login`, WithDecryption: true }));
      const value = JSON.parse(res.Parameter?.Value ?? "null");
      cache = {
        at: Date.now(),
        value: value?.user && value?.passwordHash && value?.sessionKey ? value : null,
      };
    } catch (err) {
      if (err?.name !== "ParameterNotFound") throw err;
      cache = { at: Date.now(), value: null };
    }
    return cache.value;
  };
}

/** Checks a sign-in: the user name and the password, both in constant time. */
export async function checkLogin(credentials, user, password) {
  if (!credentials) return false;
  const userOk = sameText(
    String(user ?? "")
      .trim()
      .toLowerCase(),
    credentials.user.toLowerCase(),
  );
  const passwordOk = await verifyPassword(password, credentials.passwordHash);
  return userOk && passwordOk;
}

export const sessionCookie = (token) =>
  `session=${token}; Path=/api; Max-Age=${SESSION_DAYS * 86_400}; HttpOnly; Secure; SameSite=Strict`;
export const clearCookie = "session=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict";

/** The session cookie of a function URL event (payload 2.0: event.cookies). */
export function cookieFrom(event) {
  const all = event.cookies ?? String(event.headers?.cookie ?? "").split(/;\s*/);
  const found = all.find((c) => c.startsWith("session="));
  return found ? found.slice("session=".length) : null;
}
