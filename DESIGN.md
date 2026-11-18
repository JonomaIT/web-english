# DESIGN.md: Joshuel / Jonoma IT design system

The design system of joshuel.com.br and english.joshuel.com.br. Any page or component in these
sites follows it; an agent building UI here reads this file first. The values live in
`tokens.css` (`site/css/` in web-joshuel, `src/styles/` in web-english): this file explains them,
the CSS is the source of truth.

## 1. Visual theme

- Taken from the Jonoma IT emblem: a cloud with a dog and an infinity loop, drawn in a
  blue → violet → orange gradient on black.
- Dark first (the emblem's black), with a light theme that follows the system or the toggle.
- Calm and technical: plenty of space, one accent, the gradient used sparingly (a hairline, a
  heading word), never as a page background.
- Mono type for data and labels, sans for everything else.

## 2. Colour

Components use the semantic tokens only, never the palette.

| Token                            | Dark                                | Light                 | Use                                      |
| -------------------------------- | ----------------------------------- | --------------------- | ---------------------------------------- |
| `--bg`                           | `#050608`                           | `#f6f7f9`             | page background                          |
| `--surface`                      | `#111319`                           | `#ffffff`             | cards, panels                            |
| `--surface-raised`               | `#191c23`                           | `#e9ebef`             | raised or hovered surfaces               |
| `--border` / `--border-strong`   | white 8% / 16%                      | ink 9% / 18%          | hairlines, inputs                        |
| `--text`                         | `#f1f2f4`                           | `#0b0d12`             | body text                                |
| `--text-muted` / `--text-subtle` | `#a6abb5` / `#7e8490`               | `#4a505c` / `#646a76` | secondary text                           |
| `--link`                         | `#6cc7ff`                           | `#2156d9`             | links                                    |
| `--accent`                       | `#f7982b`                           | `#f7982b`             | the one primary action (the "IT" orange) |
| `--on-accent`                    | `#050608`                           | `#050608`             | text on the accent                       |
| `--status`                       | `#2bc48a`                           | `#137a52`             | success, "available", synced             |
| `--metric-1..4`                  | sky, violet, amber, ember           | darker versions       | numbers in stat tiles                    |
| `--brand-gradient`               | sky → blue → violet → ember → amber | same                  | hairlines, emblem echoes                 |
| `--brand-gradient-text`          | sky → violet → ember                | darker                | one highlighted heading word             |

Light theme: the brand tones darken to keep AA contrast on white. `theme-color` follows the
theme (`#050608` dark, `#f6f7f9` light).

## 3. Typography

- **Sans:** Geist (variable, self-hosted, `font-display: swap`, preloaded).
- **Mono:** Geist Mono, for eyebrows, labels, counts, code and status pills.
- **Scale:** `--text-xs` 0.75rem · `--text-sm` 0.875rem · `--text-md` 1rem · `--text-lg`
  1.125rem · `--text-xl` to `--text-3xl` fluid (`clamp`), up to 4rem for the hero.
- **Rhythm:** headings `--leading-tight` 1.1 with `text-wrap: balance`; body `--leading-normal`
  1.65 with `text-wrap: pretty`; eyebrows uppercase with `--tracking-wide` 0.14em.
- **Numbers that change or line up** (counters, intervals, stats): `font-variant-numeric:
tabular-nums`.
- **Copy:** sentence case for headings and buttons; `…` (not `...`), including loading states
  ("Signing in…"); curly quotes in prose.

## 4. Components

- **Buttons:** `.btn` at least 2.75rem (44 px) tall. `.btn--primary` uses the accent with
  `--on-accent` text, one per screen region. `.btn--secondary` has a transparent background with a
  border. A button label is a verb plus an object ("Export progress", "Start review").
- **Icon buttons:** `.icon-btn`, always with `aria-label`; the SVG gets `aria-hidden="true"`.
- **Cards:** `--surface`, 1px `--border`, `--radius-lg`; at most two boxes deep, never a card
  inside a card inside a card.
- **Inputs:** `.input`, `.search` and number fields are 2.75rem tall, with `--border-strong` and a
  visible `<label>`. Forms get `name`, `autocomplete`, the right `type`/`inputmode`, and
  `spellCheck={false}` on user names and codes.
- **Status pill** (`.status`, `.sync`): mono, rounded, with a coloured dot; it is not a button
  unless it links somewhere.
- **Focus:** `:focus-visible` draws `--focus` (a 2px gap and a 2px sky ring). The outline is
  removed only because this ring replaces it.

## 5. Layout

- 4px spacing scale: `--space-1` (0.25rem) to `--space-24` (6rem).
- Container `--container` 70rem, with `--space-5` gutters on each side; equal left and right edges.
- Radius `--radius-sm` 6px (controls), `--radius-md` 10px, `--radius-lg` 16px (cards),
  `--radius-full` for pills.
- Sticky header: `scroll-padding-top: 5rem` keeps anchors and focused elements below it.
- Grid and flex for layout, never JavaScript measurement.

## 6. Depth and motion

- Depth comes from surface steps and borders, with almost no shadow.
- Motion: `--duration` 600ms and `--ease-out` for entrances, 150ms for hover states. Animate
  `transform` and `opacity` only, and list the transitioned properties (never `transition: all`).
- `prefers-reduced-motion: reduce` shows everything at once: no reveal, no smooth scroll.
- Nothing that moves for more than 5 seconds without a way to pause it.

## 7. Do and don't

Do:

- Use semantic HTML first: `<button>` for actions, `<a>` for navigation, `<label>` for every
  field.
- Give every image `width`, `height` and `alt` (`alt=""` when decorative), and the hero image
  `fetchpriority="high"`.
- Add `touch-action: manipulation` to controls, so fast taps do not zoom.
- Announce async results with `role="status"` and errors with `role="alert"`, and say how to fix
  an error, not only what failed.
- Keep state that a person would share or reload in the URL (a filter, a search, a tab).

Don't:

- Use violet or the gradient as a background block.
- Disable zoom (`user-scalable=no`, `maximum-scale=1`).
- Use `<div onClick>`, block paste, or set `autoFocus` on mobile.
- Write fake numbers, testimonials or logos.

## 8. Responsive

- Mobile first. The navigation stays in one row.
- Tap targets are at least 44px, with at least 8px between them.
- Grids use `repeat(auto-fit, minmax(min(100%, Xrem), 1fr))`: one column on a phone and nothing
  wider than the screen at 320px.

## 9. Prompting guide

> Build it with the design system in DESIGN.md: semantic tokens only, Geist and Geist Mono, one
> accent button per region, the gradient only as a hairline or one heading word, dark and light
> themes, focus ring on `:focus-visible`, reduced motion respected. Then review the result against
> the Web Interface Guidelines (vercel-labs/web-interface-guidelines) and fix what they flag.
