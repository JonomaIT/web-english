# web-english

English practice at [english.joshuel.com.br](https://english.joshuel.com.br): read the Portuguese, say it in English, reveal the answer and its audio. Spaced repetition (FSRS, the algorithm Anki uses) brings each card back right before it would be forgotten. Also the Spoken English lessons: stories with their audio and PDF, blanks to fill, discussion questions and each lesson's expressions as cards.

The Spoken English material (texts, audio, PDFs) is by Vinayak K Ramachandran, published here with his permission.

## Architecture

```
browser (React, FSRS, PDF.js)  ── progress in localStorage, synced when signed in
   │
Cloudflare  ── DNS, WAF
   │
CloudFront  ── /*      → S3: the app, card audio, lessons (copy in the second region)
            └─ /api/*  → Lambda (api/): POST /api/login, /api/logout, GET /api/me,
                            GET /api/progress, PUT /api/progress/<card>
                            ├─ DynamoDB progress (deploy/data.hcl): user + card, the FSRS state
                            └─ SSM <SECRETS_PATH>/login: the sign-in (SecureString)
```

|         |                                                                                            |
| ------- | ------------------------------------------------------------------------------------------ |
| Runtime | `cloudfront` (`deploy/app.hcl`), with an `api` (pipelines `v2.9.0`)                        |
| Data    | `deploy/data.hcl`: the `progress` table, given to the API as `TABLE_PROGRESS`              |
| Deploy  | merge to `main` → `build-static`, then `deploy-app`: data, the site and its API, the files |

The site is public: anyone can study, and progress stays in their browser. Syncing it between devices needs the sign-in, one user and password. The password is never in the repo or the bundle: `npm run set-login` asks for it, hashes it (scrypt) and stores `{ user, passwordHash, sessionKey }` as an SSM SecureString under the app's secrets path, which the function reads at run time. A sign-in gives a session cookie (HttpOnly, Secure, SameSite=Strict, 30 days) signed with `sessionKey`; running `set-login` again changes the password and ends every session. Writes keep the latest review of a card: an older one from another device gets 409.

```bash
aws sso login --sso-session jonomait
npm run set-login -- --prefix jonomait --environment production --profile <production profile>
```

## Content

Never edited by hand: `npm run content` builds it from its sources.

```bash
npm run content -- --quiz "<vault>/English/vocabulary quiz.md" --spoken "<folder>/Spoken English"
```

| Source                                                                                                                             | Becomes                                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| The Obsidian quiz (`- [ ] N. <pt>` + a `Revelar` callout)                                                                          | cards                                      |
| The Spoken English folder (`<Title>.pdf`, `<Title>.mp3`; the "com emoção" recording is left out)                                   | lessons, media copied to `public/lessons/` |
| `content/spoken-english.json` (curated: the exercises' items with our translations, the stories' blanks, questions and vocabulary) | cards and lesson extras                    |

A card's id is a hash of its English: its recording is `public/audio/cards/<id>.mp3`. The ones still to record are listed in `audio-todo.csv` (id, English); after adding recordings, run `npm run content` again.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173 (no API: progress stays in the browser)
npm test           # site (jsdom) and API (node, tests/)
npm run lint && npm run typecheck && npm run build
```

Design system: the one of [joshuel.com.br](https://joshuel.com.br) (the Jonoma IT emblem: its black, its blue → violet → orange gradient), in `src/styles/`.
