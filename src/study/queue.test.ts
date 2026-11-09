import { describe, expect, it } from "vitest";
import { emptyProgress, type Progress } from "../progress/store";
import type { StoredCard } from "../srs/scheduler";
import { buildQueue, newIntroducedToday } from "./queue";

const now = new Date(2026, 10, 9, 12, 0, 0);
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

function withCard(p: Progress, id: string, dueInMinutes: number, firstReviewAt = at(-60 * 24 * 3)): Progress {
  const card = { dueAt: at(dueInMinutes), lastReviewAt: at(-60), state: 2 } as unknown as StoredCard;
  return { ...p, cards: { ...p.cards, [id]: { card, firstReviewAt } } };
}

const ids = ["a", "b", "c", "d", "e"];
const opts = { newPerDay: 2, learnAheadMinutes: 20 };

describe("buildQueue", () => {
  it("shows due cards first, the most overdue first", () => {
    let p = withCard(emptyProgress(), "c", -10);
    p = withCard(p, "d", -60);
    const q = buildQueue(ids, p, now, opts);
    expect(q.next).toBe("d");
    expect(q.due).toBe(2);
  });

  it("then new cards, up to the daily limit", () => {
    const q = buildQueue(ids, emptyProgress(), now, opts);
    expect(q.next).toBe("a");
    expect(q.newLeft).toBe(2);
  });

  it("counts the new cards started today against the limit", () => {
    let p = withCard(emptyProgress(), "a", 60 * 24, at(-5));
    p = withCard(p, "b", 60 * 24, at(-3));
    const q = buildQueue(ids, p, now, opts);
    expect(newIntroducedToday(p, now)).toBe(2);
    expect(q.newLeft).toBe(0);
    expect(q.next).toBeNull();
  });

  it("learns ahead: a card coming back within minutes beats ending the session", () => {
    let p = withCard(emptyProgress(), "a", 5, at(-1));
    p = withCard(p, "b", 5, at(-1));
    const q = buildQueue(["a", "b"], p, now, opts);
    expect(q.next).toBe("a");
  });

  it("says when the next card comes back when nothing is left", () => {
    const p = withCard(emptyProgress(), "a", 60 * 24 * 4);
    const q = buildQueue(["a"], p, now, opts);
    expect(q.next).toBeNull();
    expect(q.nextDueAt?.toISOString()).toBe(at(60 * 24 * 4));
  });

  it("a lesson studies only its cards, with no new-card limit", () => {
    const q = buildQueue(ids, emptyProgress(), now, { ...opts, only: ["e", "d", "c"] });
    expect(q.next).toBe("e");
    expect(q.newLeft).toBe(3);
  });
});
