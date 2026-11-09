import { Link } from "react-router";
import { lessons, type Lesson } from "../content/content";

function meta(l: Lesson): string {
  if (l.kind === "vocabulary") return `${l.items?.length ?? 0} expressions · PDF`;
  const extras = [
    l.blanks ? `${l.blanks.length} blanks` : null,
    l.items ? `${l.items.length} expressions` : null,
    l.questions ? `${l.questions.length} questions` : null,
  ].filter(Boolean);
  return [`${l.audio?.length ?? 0} audio`, ...extras, "PDF"].join(" · ");
}

export default function LessonsPage() {
  const groups = [
    { title: "Stories", items: lessons.filter((l) => l.kind === "story") },
    { title: "Vocabulary reciting", items: lessons.filter((l) => l.kind === "vocabulary") },
  ];
  return (
    <>
      <div className="section__head">
        <span className="eyebrow">Lessons</span>
        <h1 className="page-title">Spoken English</h1>
        <p className="lead">
          The course by Vinayak K Ramachandran, published here with his permission: listen, read along, fill
          the blanks and study each lesson&apos;s expressions as cards.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="section section--tight">
          <h2 className="section__title section__title--sm">{g.title}</h2>
          <ul className="lesson-grid" role="list">
            {g.items.map((l) => (
              <li key={l.slug}>
                <Link className="card lesson-card" to={`/lessons/${l.slug}`}>
                  <span className="lesson-card__kind mono">{l.kind}</span>
                  <span className="lesson-card__title">{l.title}</span>
                  <span className="lesson-card__meta mono">{meta(l)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
