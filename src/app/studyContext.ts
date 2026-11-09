import { createContext, useContext } from "react";
import type { Progress } from "../progress/store";
import type { Sync } from "../progress/sync";
import type { Grade, Scheduler } from "../srs/scheduler";

export interface Settings {
  newPerDay: number;
  autoplay: boolean;
}

export const DEFAULT_SETTINGS: Settings = { newPerDay: 20, autoplay: true };

export interface StudyValue {
  scheduler: Scheduler | null;
  progress: Progress;
  settings: Settings;
  setSettings: (settings: Settings) => void;
  review: (cardId: string, grade: Grade, now?: Date) => void;
  /** Time until the card comes back, for each answer. */
  preview: (cardId: string, now: Date) => { grade: number; ms: number }[];
  replaceProgress: (progress: Progress) => void;
  /** Whether progress is synced with the API (signed in) or kept in this browser only. */
  sync: Sync;
  /** Signs in to the progress API ("unavailable": offline, or no API here, as on the dev server). */
  signIn: (user: string, password: string) => Promise<"ok" | "wrong" | "unavailable">;
  signOut: () => Promise<void>;
}

export const StudyContext = createContext<StudyValue | null>(null);

export function useStudy(): StudyValue {
  const value = useContext(StudyContext);
  if (!value) throw new Error("useStudy outside StudyProvider");
  return value;
}
