# ShadowForm

Guess the NFL quarterback from a looping silhouette of their throwing motion.
Three guesses per QB — 100 points on the first, 50 on the second, 25 on the
third — and a third miss ends the run. Wrong guesses unlock scouting-report
hints (era, then teams). Endless score-attack; your best run is saved locally.

Built sport-agnostic: golfers (swings) and other sports slot in as new data,
no code changes.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # engine + search + data integrity tests (Vitest)
npm run lint
npm run build   # production build
```

The game is fully client-side — no env vars, no database, no API routes.

## Content

Clips currently render as animated placeholders. Real silhouette clips are
produced by the local pipeline in [`pipeline/`](pipeline/README.md): fill in
a YouTube URL + timestamps per QB in `pipeline/manifest.json`, run
`python process.py`, and flip the matching `src/data/clips.json` entry to
`/clips/<id>.webm`.

Player data lives in `src/data/players.json` (~113 QBs for autocomplete,
50 in the answer pool).

## Deploy

Hosted on Vercel. Either connect the GitHub repo in the Vercel dashboard or:

```bash
npx vercel        # preview
npx vercel --prod # production
```

No configuration needed.
