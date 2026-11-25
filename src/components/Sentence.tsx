// An English sentence whose words can be heard one by one: tap a word, the browser voice says it
// slowly. Punctuation stays as text.
import { playWord } from "../audio/speak";

const WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

export function Sentence({ text, className }: { text: string; className?: string }) {
  const parts: { word?: string; text: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ word: m[0], text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return (
    <p className={`sentence${className ? ` ${className}` : ""}`} role="group" aria-label={text}>
      {parts.map((p, i) =>
        p.word ? (
          <button
            key={i}
            type="button"
            className="sentence__word"
            onClick={() => playWord(p.word!)}
            aria-label={`Hear "${p.word}"`}
          >
            {p.text}
          </button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
