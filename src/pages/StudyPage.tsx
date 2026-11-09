// Review, as in Anki: the Portuguese first; say it in English, then reveal the English and its audio
// and answer how it went (Again, Hard, Good, Easy). Keys: Space or Enter reveals, 1-4 answer,
// R plays the audio again.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useStudy } from "../app/studyContext";
import { playCard, stopAudio } from "../audio/speak";
import { Icon } from "../components/Icon";
import { cardById, cards, lessonBySlug, lessonCardIds, sourceLabel } from "../content/content";
import { formatInterval, GRADES, type Grade } from "../srs/scheduler";
import { buildQueue } from "../study/queue";

const ALL_IDS = cards.map((c) => c.id);

export default function StudyPage() {
  const { scheduler, progress, settings, review, preview } = useStudy();
  const [params] = useSearchParams();
  const lesson = lessonBySlug.get(params.get("lesson") ?? "");
  const only = useMemo(() => (lesson ? lessonCardIds(lesson) : undefined), [lesson]);
  const [now, setNow] = useState(() => new Date());
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  // Learning steps bring a card back within minutes: look again every 30 s.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const queue = useMemo(
    () => buildQueue(ALL_IDS, progress, now, { newPerDay: settings.newPerDay, learnAheadMinutes: 20, only }),
    [progress, now, settings.newPerDay, only],
  );
  const card = queue.next ? cardById.get(queue.next) : undefined;
  const isNew = card ? !progress.cards[card.id] : false;
  const intervals = useMemo(
    () => (card && revealed ? preview(card.id, now) : []),
    [card, revealed, preview, now],
  );

  const show = useCallback(() => {
    if (!card || revealed) return;
    setRevealed(true);
    if (settings.autoplay) playCard(card);
  }, [card, revealed, settings.autoplay]);

  const answer = useCallback(
    (grade: Grade) => {
      if (!card || !revealed) return;
      stopAudio();
      const at = new Date();
      review(card.id, grade, at);
      setNow(at);
      setRevealed(false);
      setDone((n) => n + 1);
    },
    [card, revealed, review],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === " " || e.key === "Enter") && !revealed) {
        e.preventDefault();
        show();
        return;
      }
      const g = GRADES.find((x) => x.key === e.key);
      if (g && revealed) answer(g.grade);
      if (e.key.toLowerCase() === "r" && revealed && card) playCard(card);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, answer, revealed, card]);

  useEffect(() => () => stopAudio(), []);

  if (!scheduler) return <p className="muted">Loading the scheduler…</p>;

  if (!card) {
    return (
      <section className="study-done">
        <span className="eyebrow">{lesson ? lesson.title : "Review"}</span>
        <h1 className="page-title">
          All <span className="gradient-text">caught up</span>
        </h1>
        <p className="lead">
          {done > 0 ? `${done} ${done === 1 ? "card" : "cards"} reviewed. ` : ""}
          {queue.nextDueAt
            ? `The next card comes back in ${formatInterval(queue.nextDueAt.getTime() - now.getTime())}.`
            : "Nothing scheduled yet."}
        </p>
        <div className="actions">
          <Link className="btn btn--secondary" to="/">
            Back to today
          </Link>
          <Link className="btn btn--secondary" to="/lessons">
            Lessons
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="study" aria-label="Review">
      <div className="study__meta">
        <span className="mono">{lesson ? lesson.title : "Review"}</span>
        <span className="mono">
          {queue.due} due · {queue.newLeft} new{done > 0 ? ` · ${done} done` : ""}
        </span>
      </div>

      <article className={`flashcard${revealed ? " is-revealed" : ""}`}>
        <div className="flashcard__side">
          <span className="flashcard__label">
            Português{isNew ? <span className="badge badge--new">new</span> : null}
          </span>
          <p className="flashcard__pt">{card.pt}</p>
        </div>

        {revealed ? (
          <div className="flashcard__side flashcard__answer">
            <span className="flashcard__label">English</span>
            <p className="flashcard__en">{card.en}</p>
            {card.notes.length > 0 ? (
              <ul className="chips" role="list">
                {card.notes.map((n) => (
                  <li key={n} className="chip">
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flashcard__audio">
              <button className="btn btn--secondary" type="button" onClick={() => playCard(card)}>
                <Icon name="volume" /> Play <kbd>R</kbd>
              </button>
              {!card.audio ? <span className="hint">Browser voice: the recording is pending</span> : null}
            </div>
            <p className="flashcard__source mono">{card.sources.map(sourceLabel).join(" · ")}</p>
          </div>
        ) : null}
      </article>

      {revealed ? (
        <div className="grades" role="group" aria-label="How did it go?">
          {GRADES.map((g) => {
            const ms = intervals.find((i) => i.grade === g.grade)?.ms;
            return (
              <button
                key={g.label}
                className={`grade grade--${g.label.toLowerCase()}`}
                type="button"
                onClick={() => answer(g.grade)}
              >
                <span className="grade__label">{g.label}</span>
                <span className="grade__when">{ms !== undefined ? formatInterval(ms) : ""}</span>
                <kbd>{g.key}</kbd>
              </button>
            );
          })}
        </div>
      ) : (
        <button className="btn btn--primary reveal-btn" type="button" onClick={show}>
          Show answer <kbd>Space</kbd>
        </button>
      )}
    </section>
  );
}
