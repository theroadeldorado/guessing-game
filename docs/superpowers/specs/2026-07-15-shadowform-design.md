# ShadowForm — Design Spec

**Date:** 2026-07-15
**Status:** Approved by John (brainstorming session)

## What it is

ShadowForm is a web game: a looping silhouetted clip of an athlete's signature motion plays, and you guess who it is. V1 covers NFL quarterbacks (throwing motions, active and retired). Golfers (swings) are a planned second sport — the data model is sport-agnostic from day one, and the name is deliberately not football-specific.

Hosted on Vercel as a public hobby site. No accounts, no backend in v1.

## Feasibility decision (why this shape)

There is no API that serves NFL footage or silhouettes, and GIF services (GIPHY etc.) prohibit modifying their content. So silhouettes are produced by a **local preprocessing pipeline** we own, and the deployed game only ever serves finished static assets. Silhouetting strips jerseys, faces, logos, and broadcast graphics — which is both the game mechanic and what keeps the content well-transformed. Known risk, accepted for a hobby site: source footage is NFL-copyrighted; silhouettes are heavily transformed but not licensed.

## Game rules

- **Mode:** endless streak (score attack). One run = clips drawn from a shuffled answer pool, no repeats within a run.
- **Guessing:** up to 3 guesses per clip, selected from an autocomplete list (never free-typed, so spelling never matters).
  - Correct on guess 1: **+100**
  - Wrong guess 1 reveals **hint 1: era/decade played**, correct on guess 2: **+50**
  - Wrong guess 2 reveals **hint 2: team(s)**, correct on guess 3: **+25**
  - Wrong guess 3: **run over.**
- After each clip resolves (correct or fatal), reveal the answer: player name, years active, teams.
- **Game over screen:** final score, clips survived, personal best (localStorage), and a Share button that copies an emoji summary, e.g.:

  ```
  🏈 ShadowForm — 725 pts, 9 QBs
  💯💯🎯💯🎯🎯💯🤏💀
  ```

  (💯 first guess, 🎯 second, 🤏 third, 💀 the miss that ended the run.)

## Architecture: two independent halves

```
shadowform/
  pipeline/          # local-only Python + ffmpeg tooling, never deployed
  (Next.js app)      # deployed to Vercel; sees only finished assets + JSON
```

### Pipeline (local, `pipeline/`)

Manifest-driven, idempotent. `pipeline/manifest.json` has one entry per clip:

```json
{
  "id": "marino-1984",
  "playerId": "dan-marino",
  "source": "https://youtube.com/watch?v=...",
  "start": "01:23.5",
  "end": "01:26.8",
  "crop": "auto"
}
```

Per entry, one command (`python process.py`) runs:

1. **yt-dlp** downloads the source video (cached).
2. **ffmpeg** trims to the `start`–`end` window.
3. **Robust Video Matting** (PyTorch; runs on Apple Silicon) extracts a temporally-consistent person matte — chosen over per-frame tools (rembg) because video needs frame-to-frame coherence.
4. **ffmpeg** composites a solid-black figure on a flat background, crops/scales to a consistent frame, and exports **looping WebM + MP4 fallback** (not GIF — far smaller, smoother) into `public/clips/`.

Already-processed IDs are skipped, so growing the pool is: add a manifest entry, re-run. Claude pre-fills the manifest with ~50 candidate QBs and source URLs; John reviews timestamps and re-sources any clip whose matte comes out badly (expected for old grainy footage — this is the project's main manual cost).

### Game data (`data/`)

```
sports.json    [{ id: "nfl-qb", label: "NFL Quarterbacks" }]
players.json   [{ id, name, sportId, era, teams[], yearsActive, inPool }]
clips.json     [{ id, playerId, src }]
```

- `players.json` includes **every** notable NFL QB (from nflverse open roster data) so autocomplete never misses a guess; only the ~50 with clips are `inPool: true` and eligible as answers.
- Adding golf later = new sport row, new players, new clips; no code changes.

### Game app

- **Stack:** Next.js (App Router), TypeScript, Tailwind. Chosen over a plain SPA because it costs nothing now and gives in-place upgrade paths for the likely next features (global leaderboard via API route + marketplace DB, daily-puzzle mode, OG share images).
- **State:** fully client-side. Run state in React; personal best + last run in localStorage. No env vars, no database, no API routes in v1.
- **Assets:** clips served as static files from Vercel's CDN. 50 clips × ~300–600KB WebM ≈ 15–30MB — fine in-repo; move to Vercel Blob if the library grows past ~100 clips.
- **Autocomplete:** client-side fuzzy search (typo- and diacritic-tolerant) over the full player list (a few KB). Guess submits on selection.
- **Preloading:** the next clip fetches in the background during the current guess, so runs never stall.
- **Accessibility:** reduced-motion users get a poster frame with an explicit play button.

## V1 scope

- ~50 QB answer pool spanning eras (icons + solid starters).
- Endless mode only. No daily puzzle, no leaderboard, no accounts.
- Name: **ShadowForm** (domain availability unchecked at spec time).

## Testing

- Unit tests for run-state and scoring logic (pure functions: guess evaluation, hint progression, scoring tiers, run termination).
- Manual QA of the pipeline output (visual check per clip — silhouette quality is subjective).

## Explicitly deferred

- Golf (and other sports) content.
- Daily-puzzle mode, global leaderboard, OG share images.
- Vercel Blob asset hosting (only if the clip library outgrows the repo).
