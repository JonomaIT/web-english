import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation } from "react-router";
import { useStudy } from "../app/studyContext";
import { SignIn } from "../components/SignIn";
import { SyncBadge } from "../components/SyncBadge";
import { cards, lessons } from "../content/content";
import { exportProgress, importProgress } from "../progress/store";
import { formatInterval } from "../srs/scheduler";
import { buildQueue, newIntroducedToday } from "../study/queue";

const ALL_IDS = cards.map((c) => c.id);

export default function HomePage() {
  const { progress, settings, setSettings, replaceProgress } = useStudy();
  const [now] = useState(() => new Date());
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const { hash } = useLocation();

  // "Sign in to sync" (the header) lands on /#sync: the sign-in form.
  useEffect(() => {
    if (hash !== "#sync") return;
    const target = document.getElementById("sync");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.querySelector<HTMLInputElement>("input[name=username]")?.focus({ preventScroll: true });
  }, [hash]);

  const queue = useMemo(
    () => buildQueue(ALL_IDS, progress, now, { newPerDay: settings.newPerDay, learnAheadMinutes: 0 }),
    [progress, now, settings.newPerDay],
  );
  const studied = Object.keys(progress.cards).length;
  const reviewsToday = progress.log.filter(
    (r) => new Date(r.at).toDateString() === now.toDateString(),
  ).length;
  const toStudy = queue.due + queue.newLeft;

  const download = () => {
    const blob = new Blob([exportProgress(progress)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `english-progress-${now.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      replaceProgress(importProgress(await f.text()));
      setMessage("Progress imported.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <section className="hero">
        <span className="status">
          {reviewsToday > 0 ? `${reviewsToday} reviews today` : "ready when you are"}
        </span>
        <h1 className="page-title">
          Say it in <span className="gradient-text">English</span>.
        </h1>
        <p className="lead">
          Read the Portuguese, say it out loud in English, then reveal the answer and its audio. Spaced
          repetition (FSRS) brings each card back right before you would forget it.
        </p>
        <div className="actions">
          {toStudy > 0 ? (
            <Link className="btn btn--primary" to="/study">
              Start review · {toStudy}
            </Link>
          ) : (
            <span className="hint">
              All caught up
              {queue.nextDueAt
                ? `: the next card comes back in ${formatInterval(queue.nextDueAt.getTime() - now.getTime())}`
                : ""}
              .
            </span>
          )}
          <Link className="btn btn--secondary" to="/lessons">
            Spoken English lessons
          </Link>
        </div>
      </section>

      <section className="stats" aria-label="Today">
        <div className="card stat">
          <p className="stat__value stat__value--1">{queue.due}</p>
          <p className="stat__label">due now</p>
        </div>
        <div className="card stat">
          <p className="stat__value stat__value--2">
            {queue.newLeft}
            <small>/{settings.newPerDay}</small>
          </p>
          <p className="stat__label">new left today ({newIntroducedToday(progress, now)} started)</p>
        </div>
        <div className="card stat">
          <p className="stat__value stat__value--3">
            {studied}
            <small>/{cards.length}</small>
          </p>
          <p className="stat__label">cards studied</p>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="eyebrow">Lessons</span>
          <h2 className="section__title">Spoken English</h2>
        </div>
        <ul className="lesson-grid" role="list">
          {lessons
            .filter((l) => l.kind === "story")
            .map((l) => (
              <li key={l.slug}>
                <Link className="card lesson-card" to={`/lessons/${l.slug}`}>
                  <span className="lesson-card__kind mono">story</span>
                  <span className="lesson-card__title">{l.title}</span>
                  <span className="lesson-card__meta mono">
                    {l.audio?.length ?? 0} audio ·{" "}
                    {l.blanks
                      ? `${l.blanks.length} blanks`
                      : l.items
                        ? `${l.items.length} expressions`
                        : "reading"}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section className="section">
        <div className="section__head">
          <span className="eyebrow">Settings</span>
          <h2 className="section__title">Your pace</h2>
        </div>
        <div className="card settings">
          <label className="field">
            <span>New cards per day</span>
            <input
              type="number"
              min={0}
              max={200}
              value={settings.newPerDay}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  newPerDay: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                })
              }
            />
          </label>
          <label className="field field--check">
            <input
              type="checkbox"
              checked={settings.autoplay}
              onChange={(e) => setSettings({ ...settings, autoplay: e.target.checked })}
            />
            <span>Play the English audio when the answer is revealed</span>
          </label>
          <div className="settings__backup" id="sync">
            <div className="settings__sync">
              <SyncBadge />
              <SignIn />
            </div>
            <p className="hint">A backup, or moving progress without signing in:</p>
            <div className="actions">
              <button className="btn btn--secondary" type="button" onClick={download}>
                Export progress
              </button>
              <button className="btn btn--secondary" type="button" onClick={() => file.current?.click()}>
                Import progress
              </button>
              <input
                ref={file}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => void upload(e)}
              />
            </div>
            {message ? (
              <p className="hint" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
