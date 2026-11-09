// Spaced repetition with FSRS (ts-fsrs), the algorithm Anki uses by default: each answer (Again,
// Hard, Good, Easy) moves the card's next review closer or further, aiming at 90% recall.
import { DefaultScheduler, Rating } from "ts-fsrs";

export type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
export type FsrsCard = ReturnType<Scheduler["newCard"]>;
export type Grade = Parameters<Scheduler["review"]>[0]["grade"];

export function newCard(scheduler: Scheduler, now: Date): FsrsCard {
  return scheduler.newCard({ now });
}

// review() and preview() are typed per model version, and FSRS-7's card has a field (stabilityFast)
// that newCard() is not typed with, though the object carries it. The conversion lives here only.
export function reviewCard(scheduler: Scheduler, card: FsrsCard, grade: Grade, now: Date): FsrsCard {
  return scheduler.review({ card: card as never, grade, now }).card as FsrsCard;
}

export function previewCard(
  scheduler: Scheduler,
  card: FsrsCard,
  now: Date,
): { grade: number; dueAt: Date }[] {
  return [...scheduler.preview({ card: card as never, now })].map((p) => ({
    grade: Number(p.grade),
    dueAt: p.card.dueAt,
  }));
}

export const GRADES = [
  { grade: Rating.Again, label: "Again", key: "1" },
  { grade: Rating.Hard, label: "Hard", key: "2" },
  { grade: Rating.Good, label: "Good", key: "3" },
  { grade: Rating.Easy, label: "Easy", key: "4" },
] as const;

export function createScheduler(): Promise<Scheduler> {
  return DefaultScheduler({ desiredRetention: 0.9, enableFuzz: true, maximumInterval: 3650 });
}

/** A card as JSON: dates as ISO strings (localStorage and, later, the progress API). */
export type StoredCard = Omit<FsrsCard, "dueAt" | "lastReviewAt"> & {
  dueAt: string;
  lastReviewAt: string | null;
};

export function toStored(card: FsrsCard): StoredCard {
  return JSON.parse(JSON.stringify(card)) as StoredCard;
}

export function fromStored(card: StoredCard): FsrsCard {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  } as FsrsCard;
}

/** "1m", "14h", "5d", "3mo", "1.2y": how long until the card comes back. */
export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, "")}y`;
}
