#!/usr/bin/env python3
"""Builds the site's content from its sources (run again whenever they change):

    npm run content -- --quiz "<vault>/English/vocabulary quiz.md" --spoken "<folder>/Spoken English"

Sources
  --quiz     the Obsidian quiz: "- [ ] N. <portuguese>" followed by a "> [!question]- Revelar" callout
             whose first line is the English and the next lines are notes (e.g. "go / went / gone").
  --spoken   the Spoken English folder: "<Title>.pdf" and "<Title>.mp3" (+ "<Title> (com emoção).mp3")
             for each story; "Vocabulary Reciting Exercise N.pdf" for the exercises. What the PDFs
             cannot give reliably is curated in content/spoken-english.json: the exercises' items, the
             stories' blanks, questions and vocabulary lists, and text fixes.

Output
  src/content/cards.json     every card: id, pt, en, notes, sources, audio (whether the file exists)
  src/content/lessons.json   the lessons: stories (paragraphs, audio, PDF) and vocabulary exercises
  public/lessons/<slug>/     the lessons' PDFs and audio, copied
  audio-todo.csv             cards without audio: id,en (file name to record: public/audio/cards/<id>.mp3)

A card's id is a hash of its English: the audio belongs to that exact sentence, so editing the English
gives a new id (and asks for a new recording). Standard library only, plus pdftotext (poppler).
"""

import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADER = re.compile(r"^\s*SPOKEN ENGLISH\s*-\s*VINAYAK K RAMACHANDRAN\s*\d*\s*$", re.I)


def card_id(en):
    norm = re.sub(r"\s+", " ", en.strip().lower())
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()[:10]


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# ------------------------------------------------------------------ Obsidian quiz
def parse_quiz(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    cards, i = [], 0
    item = re.compile(r"^- \[[ xX]\] (\d+)\.\s+(.*\S)\s*$")
    while i < len(lines):
        m = item.match(lines[i])
        if not m:
            i += 1
            continue
        number, pt = int(m.group(1)), m.group(2)
        i += 1
        while i < len(lines) and not lines[i].startswith("> [!question]"):
            i += 1
        i += 1
        body = []
        while i < len(lines) and lines[i].startswith(">"):
            body.append(lines[i][1:].strip())
            i += 1
        text = [b for b in body if b]
        if not text:
            print(f"warning: quiz item {number} has no answer, skipped", file=sys.stderr)
            continue
        cards.append({"pt": pt, "en": text[0], "notes": text[1:], "source": f"obsidian:{number}"})
    return cards


# ------------------------------------------------------------------ Spoken English
def pdf_text(path):
    out = subprocess.run(["pdftotext", str(path), "-"], check=True, capture_output=True, text=True).stdout
    return out


def paragraphs(raw, title):
    """Re-joins the PDF's wrapped lines: a short line (or one ending a sentence before a quote or a
    capital) closes a paragraph; page headers, page numbers and the title are dropped."""
    lines = [l.rstrip() for l in raw.splitlines()]
    keep = []
    for l in lines:
        s = l.strip()
        if not s or HEADER.match(s) or re.fullmatch(r"\d+", s) or s.upper() == title.upper():
            keep.append("")
            continue
        keep.append(s)
    width = max((len(l) for l in keep), default=60)
    paras, cur = [], []
    for l in keep:
        if not l:
            if cur:
                paras.append(" ".join(cur))
                cur = []
            continue
        cur.append(l)
        if len(l) < width * 0.75 and re.search(r"[.!?…”\"]$", l):
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return [re.sub(r"\s+", " ", p).strip() for p in paras if p.strip()]


def copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or dst.stat().st_size != src.stat().st_size:
        shutil.copy2(src, dst)


EXTRAS = re.compile(r"^(ANSWER KEYS|USEFUL VOCABULARY)", re.I)


def curated():
    return json.loads((ROOT / "content" / "spoken-english.json").read_text(encoding="utf-8"))


def item_cards(items, source):
    """Vocabulary items (term, definition?, en, pt) as cards, each item marked with its card."""
    out_items, cards = [], []
    for it in items:
        out_items.append({**it, "cardId": card_id(it["en"])})
        notes = [it["term"]] + ([it["definition"]] if it.get("definition") else [])
        cards.append({"pt": it["pt"], "en": it["en"], "notes": notes, "source": source})
    return out_items, cards


def stories(folder):
    extra = curated()["stories"]
    lessons, cards = [], []
    for pdf in sorted(folder.glob("*.pdf")):
        title = pdf.stem
        if title.lower().startswith("vocabulary reciting exercise"):
            continue
        slug = slugify(title)
        dest = ROOT / "public" / "lessons" / slug
        copy(pdf, dest / f"{slug}.pdf")
        audio = []
        for label, name, file in (("Narration", f"{title}.mp3", f"{slug}.mp3"), ("With emotion", f"{title} (com emoção).mp3", f"{slug}-emotion.mp3")):
            src = folder / name
            if src.exists():
                copy(src, dest / file)
                audio.append({"label": label, "src": f"/lessons/{slug}/{file}"})
        # The story ends where its extras begin (answer keys, vocabulary lists): those are curated.
        text = paragraphs(pdf_text(pdf), title)
        cut = next((i for i, p in enumerate(text) if EXTRAS.match(p)), len(text))
        text = text[:cut]
        meta = extra.get(slug, {})
        for wrong, right in meta.get("fixes", []):
            text = [p.replace(wrong, right) for p in text]
        lesson = {"slug": slug, "kind": "story", "title": title, "paragraphs": text, "audio": audio, "pdf": f"/lessons/{slug}/{slug}.pdf"}
        for key in ("blanks", "questions", "related"):
            if key in meta:
                lesson[key] = meta[key]
        if "vocabulary" in meta:
            lesson["items"], story_cards = item_cards(meta["vocabulary"], f"spoken-english:{slug}")
            cards += story_cards
        lessons.append(lesson)
    return lessons, cards


def vocabulary(folder):
    lessons, cards = [], []
    for lesson in curated()["lessons"]:
        slug = lesson["slug"]
        src = folder / lesson["pdf"]
        pdf = None
        if src.exists():
            copy(src, ROOT / "public" / "lessons" / slug / f"{slug}.pdf")
            pdf = f"/lessons/{slug}/{slug}.pdf"
        items, lesson_cards = item_cards(lesson["items"], f"spoken-english:{slug}")
        cards += lesson_cards
        lessons.append({"slug": slug, "kind": "vocabulary", "title": lesson["title"], "items": items, "pdf": pdf})
    return lessons, cards


# ------------------------------------------------------------------ output
def merge(raw_cards):
    """One card per English sentence; a sentence in two sources keeps both."""
    by_id = {}
    for c in raw_cards:
        cid = card_id(c["en"])
        if cid in by_id:
            by_id[cid]["sources"].append(c["source"])
            continue
        by_id[cid] = {"id": cid, "pt": c["pt"], "en": c["en"], "notes": c["notes"], "sources": [c["source"]]}
    audio_dir = ROOT / "public" / "audio" / "cards"
    for c in by_id.values():
        c["audio"] = (audio_dir / f"{c['id']}.mp3").exists()
    return list(by_id.values())


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quiz", required=True, type=Path)
    ap.add_argument("--spoken", required=True, type=Path)
    args = ap.parse_args(argv)

    quiz = parse_quiz(args.quiz)
    story_lessons, story_cards = stories(args.spoken)
    vocab_lessons, vocab_cards = vocabulary(args.spoken)
    vocab_cards = story_cards + vocab_cards
    cards = merge(quiz + vocab_cards)

    out = ROOT / "src" / "content"
    out.mkdir(parents=True, exist_ok=True)
    (out / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "lessons.json").write_text(json.dumps(story_lessons + vocab_lessons, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    todo = [c for c in cards if not c["audio"]]
    with open(ROOT / "audio-todo.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "en"])
        for c in todo:
            w.writerow([c["id"], c["en"]])

    print(f"cards: {len(cards)} ({len(quiz)} from the quiz, {len(vocab_cards)} from Spoken English, {len(quiz) + len(vocab_cards) - len(cards)} shared)")
    print(f"lessons: {len(story_lessons)} stories, {len(vocab_lessons)} vocabulary exercises")
    print(f"audio: {len(cards) - len(todo)} recorded, {len(todo)} missing (audio-todo.csv)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
