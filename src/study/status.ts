import type { Progress } from "../progress/store";
import { formatInterval } from "../srs/scheduler";

export type Status = { kind: "new" } | { kind: "due" } | { kind: "learning" | "review"; inMs: number };

/** FSRS state: 0 new, 1 learning, 2 review, 3 relearning. */
export function cardStatus(progress: Progress, cardId: string, now: Date): Status {
  const saved = progress.cards[cardId];
  if (!saved) return { kind: "new" };
  const inMs = new Date(saved.card.dueAt).getTime() - now.getTime();
  if (inMs <= 0) return { kind: "due" };
  return { kind: saved.card.state === 2 ? "review" : "learning", inMs };
}

export function statusLabel(status: Status): string {
  switch (status.kind) {
    case "new":
      return "New";
    case "due":
      return "Due";
    default:
      return `In ${formatInterval(status.inMs)}`;
  }
}
