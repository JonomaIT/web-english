// Study progress: the FSRS state of every card reviewed, and a log of the answers. Kept in this
// browser (localStorage) for now; the progress API (a Lambda) will sync it between devices.
import type { StoredCard } from "../srs/scheduler";

export interface CardProgress {
  card: StoredCard;
  firstReviewAt: string; // when the card stopped being new (counts against new cards per day)
}

export interface ReviewEntry {
  cardId: string;
  rating: number;
  at: string;
}

export interface Progress {
  version: 1;
  cards: Record<string, CardProgress>;
  log: ReviewEntry[];
}

export const KEY = "english.progress.v1";
const MAX_LOG = 5_000; // enough to tune FSRS later; old entries are dropped

export const emptyProgress = (): Progress => ({ version: 1, cards: {}, log: [] });

function isProgress(value: unknown): value is Progress {
  const p = value as Partial<Progress> | null;
  return !!p && p.version === 1 && typeof p.cards === "object" && p.cards !== null && Array.isArray(p.log);
}

export function loadProgress(storage: Storage | undefined = globalThis.localStorage): Progress {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isProgress(parsed) ? parsed : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  progress: Progress,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // private browsing or full: kept in memory for this visit
  }
}

export function recordReview(
  progress: Progress,
  cardId: string,
  card: StoredCard,
  rating: number,
  now: Date,
): Progress {
  const previous = progress.cards[cardId];
  return {
    version: 1,
    cards: {
      ...progress.cards,
      [cardId]: { card, firstReviewAt: previous?.firstReviewAt ?? now.toISOString() },
    },
    log: [...progress.log, { cardId, rating, at: now.toISOString() }].slice(-MAX_LOG),
  };
}

export function exportProgress(progress: Progress): string {
  return JSON.stringify(progress, null, 2);
}

export function importProgress(text: string): Progress {
  const parsed: unknown = JSON.parse(text);
  if (!isProgress(parsed)) throw new Error("This file is not an English progress export (version 1).");
  return parsed;
}
