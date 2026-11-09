// The study state every page shares: the FSRS scheduler, the progress and the settings. One review =
// one new FSRS state for the card, saved in this browser right away and, signed in, sent to the
// progress API (sync.ts).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadProgress, recordReview, saveProgress, type Progress } from "../progress/store";
import {
  loadOutbox,
  mergeProgress,
  pull,
  push,
  saveOutbox,
  signIn as apiSignIn,
  signOut as apiSignOut,
  whoAmI,
  type Sync,
} from "../progress/sync";
import {
  createScheduler,
  fromStored,
  newCard,
  previewCard,
  reviewCard,
  toStored,
  type FsrsCard,
  type Grade,
  type Scheduler,
} from "../srs/scheduler";
import { usePersistentState } from "./storage";
import { DEFAULT_SETTINGS, StudyContext, type Settings } from "./studyContext";

export function StudyProvider({ children }: { children: ReactNode }) {
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [settings, setSettings] = usePersistentState<Settings>("english.settings", DEFAULT_SETTINGS);
  const [sync, setSync] = useState<Sync>({ kind: "checking" });
  const progressRef = useRef(progress);
  const signedIn = useRef<string | null>(null);
  const flushing = useRef(false);

  useEffect(() => {
    let alive = true;
    void createScheduler().then((s) => alive && setScheduler(s));
    return () => {
      alive = false;
    };
  }, []);

  // Sends the outbox, one card at a time; stops at the first failure (offline) and tries again later.
  const flush = useCallback(async () => {
    const who = signedIn.current;
    if (!who || flushing.current) return;
    flushing.current = true;
    try {
      let outbox = loadOutbox();
      for (const id of [...outbox]) {
        const card = progressRef.current.cards[id];
        if (card) {
          const last = progressRef.current.log.findLast((r) => r.cardId === id);
          const result = await push(id, card, last ? { rating: last.rating, at: last.at } : undefined);
          if (result === "failed") break; // "stale": another device has a later review; the next pull brings it
        }
        outbox = outbox.filter((x) => x !== id);
        saveOutbox(outbox);
      }
      setSync(
        outbox.length > 0
          ? { kind: "pending", user: who, count: outbox.length }
          : { kind: "synced", user: who },
      );
    } finally {
      flushing.current = false;
    }
  }, []);

  // Signed in: everything from the API, merged with this browser's (the latest review of each card
  // wins), then what only this browser has goes up.
  const connect = useCallback(
    async (alive: () => boolean = () => true) => {
      const who = await whoAmI();
      if (!alive()) return;
      signedIn.current = who;
      if (!who) {
        setSync({ kind: "signed-out" });
        return;
      }
      const remote = await pull();
      if (!alive()) return;
      if (remote) {
        const { merged, toPush } = mergeProgress(progressRef.current, remote);
        saveProgress(merged);
        saveOutbox([...loadOutbox(), ...toPush]);
        progressRef.current = merged;
        setProgress(merged);
      }
      await flush();
    },
    [flush],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      await connect(() => alive);
    })();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      alive = false;
      window.removeEventListener("online", online);
    };
  }, [connect, flush]);

  const signIn = useCallback(
    async (user: string, password: string) => {
      const result = await apiSignIn(user, password);
      if (result === "ok") await connect();
      return result;
    },
    [connect],
  );

  // This browser keeps its copy of the progress; it just stops syncing.
  const signOut = useCallback(async () => {
    await apiSignOut();
    signedIn.current = null;
    saveOutbox([]);
    setSync({ kind: "signed-out" });
  }, []);

  // Every change of progress (a review, an import) goes out when signed in.
  useEffect(() => {
    progressRef.current = progress;
    if (signedIn.current && loadOutbox().length > 0) void flush();
  }, [progress, flush]);

  const cardOf = useCallback(
    (cardId: string, now: Date, p: Progress): FsrsCard | null => {
      if (!scheduler) return null;
      const saved = p.cards[cardId];
      return saved ? fromStored(saved.card) : newCard(scheduler, now);
    },
    [scheduler],
  );

  const review = useCallback(
    (cardId: string, grade: Grade, now = new Date()) => {
      setProgress((p) => {
        const card = cardOf(cardId, now, p);
        if (!scheduler || !card) return p;
        const next = recordReview(p, cardId, toStored(reviewCard(scheduler, card, grade, now)), grade, now);
        saveProgress(next);
        return next;
      });
      if (signedIn.current) saveOutbox([...loadOutbox(), cardId]);
    },
    [scheduler, cardOf],
  );

  const preview = useCallback(
    (cardId: string, now: Date) => {
      const card = cardOf(cardId, now, progress);
      if (!scheduler || !card) return [];
      return previewCard(scheduler, card, now).map((p) => ({
        grade: p.grade,
        ms: p.dueAt.getTime() - now.getTime(),
      }));
    },
    [scheduler, cardOf, progress],
  );

  const replaceProgress = useCallback((next: Progress) => {
    saveProgress(next);
    if (signedIn.current) saveOutbox([...loadOutbox(), ...Object.keys(next.cards)]);
    setProgress(next);
  }, []);

  const value = useMemo(
    () => ({
      scheduler,
      progress,
      settings,
      setSettings,
      review,
      preview,
      replaceProgress,
      sync,
      signIn,
      signOut,
    }),
    [scheduler, progress, settings, setSettings, review, preview, replaceProgress, sync, signIn, signOut],
  );
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}
