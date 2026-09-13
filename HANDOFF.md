# Vlot — Project Handoff

**Vlot** is a free, local, offline Dutch-learning app with an English interface. The name *vlot*
is Dutch for "fluent/smooth" (and "raft/to float"). It uses **FSRS** spaced repetition, free image
search, and browser text-to-speech — no accounts, no paid APIs.

- **Interface:** English · **Learning direction:** English → Dutch
- **Status:** Rebuilt from a single file into an organised static PWA. **Phase 0 + 1 done.**
- **Rebuilt:** 2026-09-06 (fresh start; old app kept as `legacy-index.html`)

---

## How to run it

**Quick look:** double-click `index.html`.

**Full PWA (service worker, install, image search behave best over http):**
```
cd ~/Projects/Vlot
python3 -m http.server 8777
```
then open **http://localhost:8777** (Chrome/Edge best for TTS). To install on a phone later, deploy the
folder to GitHub Pages / Netlify and use "Add to Home Screen" (planned, Phase 3).

---

## What's built (Phase 0 + 1)

- **Organised multi-file PWA** — `index.html` + `css/` + `js/` + `icons/` + `manifest.webmanifest` + `sw.js`.
- **FSRS scheduler** (`js/fsrs.js`) — FSRS-4.5, default weights, 90% target retention. Grades Again/Hard/Good/Easy
  show the real next interval on each button.
- **Richer cards** — word, translation, example sentence (NL) + translation (EN), category (pick-or-type),
  part of speech + de/het article, notes, image. All new fields optional.
- **🔊 in study only** — tap the speaker on the word or the sentence; the Add-card screen is quiet (no auto-play).
- **Decks** — create / delete / import / export (JSON, images embedded as base64).
- **Themes** — Polder Green (default) + Delft/Tulip/Midnight accents, plus Auto/Light/Dark. In ⚙️ Settings.
- **Offline** — service worker caches the app shell. Old decks load automatically (same IndexedDB `vlot_flashcards`).

## Data model (IndexedDB `vlot_flashcards`, store `decks`)
```
deck = { id, name, created, cards: [ card ] }
card = { id, word, trans, img,
         sentence, sentenceTrans, category, pos, article, notes,
         level, freqRank,                    // reserved for the living curriculum (Phase 3)
         stability, difficulty, due, reps, lapses, last, state }   // FSRS
```
Old SM-2 cards migrate automatically (fields filled, schedule preserved).

---

## Files
- `index.html` — app shell · `css/app.css` — styles
- `js/fsrs.js` `js/db.js` `js/tts.js` `js/images.js` `js/app.js`
- `manifest.webmanifest` · `sw.js` · `icons/` (Bold-V gradient, SVG + PNGs)
- `legacy-index.html` — the original single-file app (reference)
- `.lavish/vlot-plan.html` — the full rebuild plan (all phases & decisions)

## Roadmap (next)
Phase 2 look polish · **Phase 3 living curriculum** (rank by add-order, coverage map, A1–C1 grammar) ·
Phase 4 analytics + 🎤 speech scoring · Phase 5 Inburgering A1 (→ A2 later) · Phase 6 idea backlog + reminders.
See `.lavish/vlot-plan.html` for the details and every locked decision.
