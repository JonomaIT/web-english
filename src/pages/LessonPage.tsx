import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { playCard } from "../audio/speak";
import { Icon } from "../components/Icon";
import {
  BLANK,
  cardById,
  lessonBySlug,
  type Blank,
  type Lesson,
  type VocabularyItem,
} from "../content/content";
import NotFoundPage from "./NotFoundPage";

// PDF.js is heavy: its chunk loads only when a PDF is opened.
const PdfViewer = lazy(() => import("../components/PdfViewer"));

/** A blank of the story: tap to reveal the expression (try to remember it first). */
function BlankButton({
  n,
  blank,
  open,
  onToggle,
}: {
  n: number;
  blank: Blank | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`blank${open ? " is-open" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? `Blank ${n}: ${blank?.answer}` : `Reveal blank ${n}`}
    >
      <span className="blank__n">{n}</span>
      {open ? (
        <span className="blank__answer">{blank?.answer ?? "?"}</span>
      ) : (
        <span className="blank__line" />
      )}
    </button>
  );
}

function Paragraph({
  text,
  blanks,
  open,
  toggle,
}: {
  text: string;
  blanks: Blank[];
  open: Set<number>;
  toggle: (n: number) => void;
}) {
  const parts: (string | number)[] = [];
  let last = 0;
  for (const m of text.matchAll(BLANK)) {
    parts.push(text.slice(last, m.index), Number(m[1]));
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return (
    <p>
      {parts.map((p, i) =>
        typeof p === "number" ? (
          <BlankButton key={i} n={p} blank={blanks[p - 1]} open={open.has(p)} onToggle={() => toggle(p)} />
        ) : (
          p
        ),
      )}
    </p>
  );
}

function Items({ items }: { items: VocabularyItem[] }) {
  const [shown, setShown] = useState<Set<string>>(new Set());
  return (
    <ol className="items">
      {items.map((it) => {
        const card = cardById.get(it.cardId);
        const open = shown.has(it.cardId);
        return (
          <li key={it.cardId} className="item">
            <p className="item__term">{it.term}</p>
            {it.definition ? <p className="item__definition">{it.definition}</p> : null}
            <p className="item__en">{it.en}</p>
            <div className="item__row">
              {open ? (
                <p className="item__pt">{it.pt}</p>
              ) : (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setShown(new Set(shown).add(it.cardId))}
                >
                  <Icon name="eye" size={16} /> Portuguese
                </button>
              )}
              {card ? (
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => playCard(card)}
                  aria-label={`Play: ${it.en}`}
                >
                  <Icon name="volume" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Story({ lesson }: { lesson: Lesson }) {
  const blanks = lesson.blanks ?? [];
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (n: number) => {
    const next = new Set(open);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setOpen(next);
  };
  const all = blanks.length > 0 && open.size === blanks.length;

  return (
    <>
      {lesson.audio && lesson.audio.length > 0 ? (
        <div className="players">
          {lesson.audio.map((a) => (
            <figure key={a.src} className="card player">
              <figcaption className="mono">{a.label}</figcaption>
              <audio controls preload="none" src={a.src} />
            </figure>
          ))}
        </div>
      ) : null}

      {blanks.length > 0 ? (
        <div className="story-tools">
          <p className="hint">
            Each blank is an expression from the vocabulary exercises: say it, then tap to check.
          </p>
          <button
            className="btn btn--secondary"
            type="button"
            onClick={() => setOpen(all ? new Set() : new Set(blanks.map((_, i) => i + 1)))}
          >
            {all ? "Hide all" : "Reveal all"}
          </button>
        </div>
      ) : null}

      <div className="reading">
        {lesson.paragraphs?.map((p, i) => (
          <Paragraph key={i} text={p} blanks={blanks} open={open} toggle={toggle} />
        ))}
      </div>

      {blanks.length > 0 ? (
        <section className="section section--tight">
          <h2 className="section__title section__title--sm">Answer key</h2>
          <ol className="answer-key">
            {blanks.map((b, i) => (
              <li key={i}>
                {open.has(i + 1) ? (
                  <>
                    <strong>{b.answer}</strong> — {b.meaning}
                  </>
                ) : (
                  <button type="button" className="link-btn" onClick={() => toggle(i + 1)}>
                    Reveal {i + 1}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {lesson.questions ? (
        <section className="section section--tight">
          <h2 className="section__title section__title--sm">Talk about it</h2>
          <p className="hint">Answer out loud, in full sentences, using the expressions of the story.</p>
          <ol className="questions">
            {lesson.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {lesson.items ? (
        <section className="section section--tight">
          <h2 className="section__title section__title--sm">Useful vocabulary and expressions</h2>
          <Items items={lesson.items} />
        </section>
      ) : null}
    </>
  );
}

export default function LessonPage() {
  const { slug } = useParams();
  const lesson = lessonBySlug.get(slug ?? "");
  if (!lesson) return <NotFoundPage />;
  // A new lesson starts closed (PDF, revealed blanks).
  return <LessonView key={lesson.slug} lesson={lesson} />;
}

function LessonView({ lesson }: { lesson: Lesson }) {
  const [pdfOpen, setPdfOpen] = useState(false);
  const related = (lesson.related ?? []).map((s) => lessonBySlug.get(s)).filter((l): l is Lesson => !!l);
  const file = `${lesson.title}.pdf`;

  return (
    <article className="lesson">
      <Link className="back" to="/lessons">
        ← Lessons
      </Link>
      <div className="section__head">
        <span className="eyebrow">{lesson.kind === "story" ? "Story" : "Vocabulary reciting"}</span>
        <h1 className="page-title">{lesson.title}</h1>
        <div className="actions">
          {lesson.items && lesson.items.length > 0 ? (
            <Link className="btn btn--primary" to={`/study?lesson=${lesson.slug}`}>
              Study these {lesson.items.length} cards
            </Link>
          ) : null}
          {lesson.pdf ? (
            <>
              <button
                className="btn btn--secondary"
                type="button"
                aria-expanded={pdfOpen}
                aria-controls="lesson-pdf"
                onClick={() => setPdfOpen(!pdfOpen)}
              >
                <Icon name={pdfOpen ? "eye" : "file"} /> {pdfOpen ? "Hide PDF" : "Read PDF"}
              </button>
              <a className="btn btn--secondary" href={lesson.pdf} download={file}>
                <Icon name="download" /> Download PDF
              </a>
            </>
          ) : null}
        </div>
        {related.length > 0 ? (
          <p className="hint">
            Its expressions:{" "}
            {related.map((r, i) => (
              <span key={r.slug}>
                {i > 0 ? ", " : ""}
                <Link to={`/lessons/${r.slug}`}>{r.title}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {pdfOpen && lesson.pdf ? (
        <section id="lesson-pdf" className="section--pdf" aria-label={`${lesson.title}, PDF`}>
          <Suspense fallback={<p className="hint">Opening the PDF…</p>}>
            <PdfViewer src={lesson.pdf} title={lesson.title} />
          </Suspense>
        </section>
      ) : null}

      {lesson.kind === "story" ? <Story lesson={lesson} /> : <Items items={lesson.items ?? []} />}
    </article>
  );
}
