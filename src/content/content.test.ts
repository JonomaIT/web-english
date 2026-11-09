import { describe, expect, it } from "vitest";
import { BLANK, cardById, cards, lessons } from "./content";

describe("content (npm run content)", () => {
  it("every card has a unique id, Portuguese and English", () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const c of cards) {
      expect(c.pt.trim(), c.id).not.toBe("");
      expect(c.en.trim(), c.id).not.toBe("");
    }
  });

  it("every lesson item is a card", () => {
    for (const l of lessons)
      for (const it of l.items ?? []) expect(cardById.has(it.cardId), `${l.slug}: ${it.term}`).toBe(true);
  });

  it("a story's blanks in the text match its answer key", () => {
    for (const l of lessons.filter((x) => x.blanks)) {
      const numbers = (l.paragraphs ?? []).flatMap((p) => [...p.matchAll(BLANK)].map((m) => Number(m[1])));
      expect(numbers, l.slug).toEqual(l.blanks!.map((_, i) => i + 1));
    }
  });

  it("related lessons exist", () => {
    const slugs = new Set(lessons.map((l) => l.slug));
    for (const l of lessons)
      for (const r of l.related ?? []) expect(slugs.has(r), `${l.slug} → ${r}`).toBe(true);
  });
});
