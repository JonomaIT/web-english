import { describe, expect, it } from "vitest";
import { createScheduler, fromStored, newCard, reviewCard, toStored } from "../srs/scheduler";
import {
  emptyProgress,
  exportProgress,
  importProgress,
  KEY,
  loadProgress,
  recordReview,
  saveProgress,
} from "./store";

describe("progress", () => {
  it("survives a reload: the FSRS card comes back with real dates and reviews again", async () => {
    const scheduler = await createScheduler();
    const now = new Date("2026-11-09T12:00:00Z");
    const first = reviewCard(scheduler, newCard(scheduler, now), 3, now);
    saveProgress(recordReview(emptyProgress(), "abc", toStored(first), 3, now));

    const loaded = loadProgress();
    const card = fromStored(loaded.cards.abc!.card);
    expect(card.dueAt).toBeInstanceOf(Date);
    const later = new Date(card.dueAt.getTime() + 60_000);
    expect(reviewCard(scheduler, card, 3, later).reps).toBe(2);
    expect(loaded.log).toEqual([{ cardId: "abc", rating: 3, at: now.toISOString() }]);
  });

  it("keeps when a card was first studied (the new-card limit counts it)", () => {
    const card = { dueAt: "2026-11-10T00:00:00.000Z", lastReviewAt: null } as never;
    const a = recordReview(emptyProgress(), "x", card, 1, new Date("2026-11-09T10:00:00Z"));
    const b = recordReview(a, "x", card, 3, new Date("2026-11-09T10:05:00Z"));
    expect(b.cards.x!.firstReviewAt).toBe("2026-11-09T10:00:00.000Z");
    expect(b.log).toHaveLength(2);
  });

  it("an unreadable save starts empty instead of breaking the app", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadProgress()).toEqual(emptyProgress());
  });

  it("exports and imports; anything else is refused with a message", () => {
    const p = recordReview(
      emptyProgress(),
      "x",
      { dueAt: "2026-11-10T00:00:00.000Z" } as never,
      3,
      new Date(),
    );
    expect(importProgress(exportProgress(p))).toEqual(p);
    expect(() => importProgress('{"hello": 1}')).toThrow(/not an English progress export/);
  });
});
