// The site's content, built by scripts/import_content.py (npm run content) from the Obsidian quiz and
// the Spoken English folder. Never edited by hand: edit the sources and import again.
import cardsJson from "./cards.json";
import lessonsJson from "./lessons.json";

export interface Card {
  id: string; // hash of the English: the audio belongs to that exact sentence
  pt: string;
  en: string;
  notes: string[];
  sources: string[]; // "obsidian:<n>" or "spoken-english:<lesson slug>"
  audio: boolean; // public/audio/cards/<id>.mp3 exists
}

export interface VocabularyItem {
  term: string;
  definition?: string;
  en: string;
  pt: string;
  cardId: string;
}

export interface Blank {
  answer: string;
  meaning: string;
}

export interface Lesson {
  slug: string;
  kind: "story" | "vocabulary";
  title: string;
  pdf: string | null;
  paragraphs?: string[];
  audio?: { label: string; src: string }[];
  blanks?: Blank[];
  questions?: string[];
  items?: VocabularyItem[];
  related?: string[];
}

export const cards: Card[] = cardsJson as Card[];
export const lessons: Lesson[] = lessonsJson as Lesson[];

export const cardById = new Map(cards.map((c) => [c.id, c]));
export const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]));

export function sourceLabel(source: string): string {
  if (source.startsWith("obsidian:")) return "My sentences";
  const lesson = lessonBySlug.get(source.slice("spoken-english:".length));
  return lesson ? lesson.title : "Spoken English";
}

/** Cards a lesson teaches (its vocabulary items), in the lesson's order. */
export function lessonCardIds(lesson: Lesson): string[] {
  return (lesson.items ?? []).map((i) => i.cardId);
}

/** Blanks in a story are written "(n) __________" in the text. */
export const BLANK = /\((\d+)\)\s*_{3,}/g;
