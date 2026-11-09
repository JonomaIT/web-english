// What to study next, as in Anki: cards that are due first (oldest first), then new cards up to the
// daily limit, and, when nothing else is left, cards in their learning steps that come back within
// a few minutes (learn ahead) instead of ending the session early.
import type { Progress } from "../progress/store";

export interface QueueOptions {
  newPerDay: number;
  learnAheadMinutes: number;
  /** Study only these cards (a lesson), with no new-card limit. */
  only?: string[];
}

export interface Queue {
  next: string | null;
  due: number;
  newLeft: number;
  /** When nothing is left now: the next time a card comes back. */
  nextDueAt: Date | null;
}

const startOfDay = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

export function newIntroducedToday(progress: Progress, now: Date): number {
  const start = startOfDay(now).getTime();
  return Object.values(progress.cards).filter((p) => new Date(p.firstReviewAt).getTime() >= start).length;
}

export function buildQueue(cardIds: string[], progress: Progress, now: Date, options: QueueOptions): Queue {
  const pool = options.only ?? cardIds;
  const t = now.getTime();
  const studied = pool.filter((id) => progress.cards[id]);
  const fresh = pool.filter((id) => !progress.cards[id]);
  const dueAt = (id: string) => new Date(progress.cards[id]!.card.dueAt).getTime();

  const due = studied.filter((id) => dueAt(id) <= t).sort((a, b) => dueAt(a) - dueAt(b));
  const newLeft = options.only
    ? fresh.length
    : Math.max(0, Math.min(fresh.length, options.newPerDay - newIntroducedToday(progress, now)));
  const ahead = studied
    .filter((id) => dueAt(id) > t && dueAt(id) <= t + options.learnAheadMinutes * 60_000)
    .sort((a, b) => dueAt(a) - dueAt(b));

  const next = due[0] ?? (newLeft > 0 ? fresh[0] : undefined) ?? ahead[0] ?? null;
  const later = studied.map(dueAt).filter((d) => d > t);
  return {
    next,
    due: due.length,
    newLeft,
    nextDueAt: next === null && later.length > 0 ? new Date(Math.min(...later)) : null,
  };
}
