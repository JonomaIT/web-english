// Progress sync with the API (/api, the Lambda behind the same CloudFront): the same progress on the
// computer and the phone. The browser's copy stays the working copy, so the site works offline and
// signed out; the API is where devices meet.
//
//   sign-in user and password (POST /api/login): the API answers with a session cookie (HttpOnly,
//           30 days), so this code never keeps the password or the session
//   start   signed in → pull everything, merge (per card the latest review wins), push what only
//           this device has
//   answer  the card joins an outbox (kept in localStorage) and is pushed; offline, it waits for
//           the next "online" or the next visit
import type { CardProgress, Progress } from "./store";

export const OUTBOX = "english.outbox.v1";

export type Sync =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "synced"; user: string }
  | { kind: "pending"; user: string; count: number };

const reviewedAt = (p: CardProgress | undefined) => p?.card.lastReviewAt ?? "";

/** Per card, the copy reviewed last; cards newer here must go up. */
export function mergeProgress(
  local: Progress,
  remote: Record<string, CardProgress>,
): { merged: Progress; toPush: string[] } {
  const cards: Record<string, CardProgress> = { ...local.cards };
  const toPush: string[] = [];
  for (const [id, r] of Object.entries(remote)) {
    if (reviewedAt(r) > reviewedAt(cards[id])) cards[id] = r;
  }
  for (const [id, l] of Object.entries(local.cards)) {
    if (reviewedAt(l) > reviewedAt(remote[id])) toPush.push(id);
  }
  return { merged: { ...local, cards }, toPush };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A JSON answer from the API, or null when it is not reachable as the API (offline, dev server). */
async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T } | null> {
  try {
    const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init });
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) return null;
    return { status: res.status, body: (await res.json()) as T };
  } catch {
    return null;
  }
}

/** A request with a JSON body. CloudFront signs it for the Lambda but does not read the body: its hash goes along. */
async function send<T>(method: string, path: string, data: unknown) {
  const body = JSON.stringify(data);
  return api<T>(path, {
    method,
    headers: { "content-type": "application/json", "x-amz-content-sha256": await sha256Hex(body) },
    body,
  });
}

export async function whoAmI(): Promise<string | null> {
  const res = await api<{ user?: string }>("/me");
  return res?.status === 200 && res.body.user ? res.body.user : null;
}

/** "ok" (the session cookie is set), "wrong" (user or password), or "unavailable" (offline, no API here, not set up). */
export async function signIn(user: string, password: string): Promise<"ok" | "wrong" | "unavailable"> {
  const res = await send<{ user?: string }>("POST", "/login", { user, password });
  if (res?.status === 200) return "ok";
  if (res?.status === 401) return "wrong";
  return "unavailable";
}

export async function signOut(): Promise<void> {
  await send("POST", "/logout", {});
}

export async function pull(): Promise<Record<string, CardProgress> | null> {
  const res = await api<{ cards?: Record<string, CardProgress> }>("/progress");
  return res?.status === 200 ? (res.body.cards ?? {}) : null;
}

/** "saved", "stale" (another device saved a later review), or "failed" (try again later). */
export async function push(
  cardId: string,
  progress: CardProgress,
  review?: { rating: number; at: string },
): Promise<"saved" | "stale" | "failed"> {
  const res = await send("PUT", `/progress/${cardId}`, { ...progress, review });
  if (res?.status === 200) return "saved";
  if (res?.status === 409) return "stale";
  return "failed";
}

export function loadOutbox(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(OUTBOX) ?? "[]");
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveOutbox(ids: string[]): void {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify([...new Set(ids)]));
  } catch {
    // kept in memory for this visit
  }
}
