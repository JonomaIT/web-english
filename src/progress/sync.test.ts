import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyProgress, type CardProgress } from "./store";
import { mergeProgress, push, signIn, whoAmI } from "./sync";

const at = (iso: string): CardProgress => ({
  card: { dueAt: iso, lastReviewAt: iso } as never,
  firstReviewAt: iso,
});

afterEach(() => vi.unstubAllGlobals());

describe("merge", () => {
  it("per card the latest review wins; what only this device has goes up", () => {
    const local = {
      ...emptyProgress(),
      cards: { a: at("2026-11-09T10:00:00Z"), b: at("2026-11-09T12:00:00Z"), c: at("2026-11-01T00:00:00Z") },
    };
    const remote = {
      a: at("2026-11-09T11:00:00Z"),
      b: at("2026-11-09T09:00:00Z"),
      d: at("2026-11-08T00:00:00Z"),
    };
    const { merged, toPush } = mergeProgress(local, remote);
    expect(merged.cards.a).toEqual(remote.a);
    expect(merged.cards.b).toEqual(local.cards.b);
    expect(merged.cards.d).toEqual(remote.d);
    expect(toPush.sort()).toEqual(["b", "c"]);
  });
});

describe("API calls", () => {
  it("signed out (401) or no API (dev server answers HTML): nobody", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response('{"error":"sign in"}', { status: 401, headers: { "content-type": "application/json" } }),
    );
    expect(await whoAmI()).toBeNull();
    vi.stubGlobal(
      "fetch",
      async () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
    );
    expect(await whoAmI()).toBeNull();
  });

  it("sign-in: ok, wrong password, or unavailable (offline, no API)", async () => {
    const answer = (status: number) => async () =>
      new Response("{}", { status, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", answer(200));
    expect(await signIn("joshuel", "x")).toBe("ok");
    vi.stubGlobal("fetch", answer(401));
    expect(await signIn("joshuel", "x")).toBe("wrong");
    vi.stubGlobal("fetch", answer(503));
    expect(await signIn("joshuel", "x")).toBe("unavailable");
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    expect(await signIn("joshuel", "x")).toBe("unavailable");
  });

  it("a push carries the body's SHA-256, as CloudFront's signature to the Lambda requires", async () => {
    let sent: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent = init;
      return new Response('{"saved":true}', { headers: { "content-type": "application/json" } });
    });
    expect(await push("8856c7deed", at("2026-11-09T10:00:00Z"))).toBe("saved");
    const body = String(sent?.body);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect((sent?.headers as Record<string, string>)["x-amz-content-sha256"]).toBe(hex);
  });

  it("another device's later review: stale, not an error", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response('{"error":"later"}', { status: 409, headers: { "content-type": "application/json" } }),
    );
    expect(await push("8856c7deed", at("2026-11-09T10:00:00Z"))).toBe("stale");
  });
});
