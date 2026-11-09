import { useMemo, useState } from "react";
import { useStudy } from "../app/studyContext";
import { playCard } from "../audio/speak";
import { Icon } from "../components/Icon";
import { cards, sourceLabel } from "../content/content";
import { cardStatus, statusLabel } from "../study/status";

type Filter = "all" | "mine" | "course" | "no-audio";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "My sentences" },
  { id: "course", label: "Spoken English" },
  { id: "no-audio", label: "Recording pending" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CardsPage() {
  const { progress } = useStudy();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [now] = useState(() => new Date());

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return cards.filter((c) => {
      if (filter === "mine" && !c.sources.some((s) => s.startsWith("obsidian:"))) return false;
      if (filter === "course" && !c.sources.some((s) => s.startsWith("spoken-english:"))) return false;
      if (filter === "no-audio" && c.audio) return false;
      return !q || normalize(`${c.pt} ${c.en} ${c.notes.join(" ")}`).includes(q);
    });
  }, [query, filter]);

  return (
    <>
      <div className="section__head">
        <span className="eyebrow">Cards</span>
        <h1 className="page-title">Every sentence</h1>
        <p className="lead">
          {cards.length} cards. A card&apos;s recording is <code>public/audio/cards/&lt;id&gt;.mp3</code>; the
          ones still pending are in <code>audio-todo.csv</code>.
        </p>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search in Portuguese or English"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search cards"
        />
        <div className="segmented" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hint" role="status">
        {shown.length} {shown.length === 1 ? "card" : "cards"}
      </p>

      <ul className="card-list" role="list">
        {shown.map((c) => {
          const status = cardStatus(progress, c.id, now);
          return (
            <li key={c.id} className="card-row">
              <div className="card-row__text">
                <p className="card-row__pt">{c.pt}</p>
                <p className="card-row__en">{c.en}</p>
                <p className="card-row__meta mono">
                  {c.notes.length > 0 ? `${c.notes[0]} · ` : ""}
                  {c.sources.map(sourceLabel).join(" · ")} · {c.id}
                </p>
              </div>
              <div className="card-row__side">
                <span className={`badge badge--${status.kind}`}>{statusLabel(status)}</span>
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => playCard(c)}
                  aria-label={`Play: ${c.en}`}
                  title={c.audio ? "Recording" : "Browser voice (recording pending)"}
                >
                  <Icon name="volume" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
