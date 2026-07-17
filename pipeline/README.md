# ShadowForm silhouette pipeline

Local-only tooling that turns raw footage into the silhouette clips the game
serves. Nothing in this directory is deployed — the app only ever sees the
finished files it writes into `public/clips/`.

## One-time setup

```bash
brew install ffmpeg yt-dlp        # if not already installed
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # torch + Robust Video Matting deps (~2GB)
```

The first real run downloads the Robust Video Matting model weights from
torch hub automatically.

## The curation workflow (per athlete)

1. Find a highlight video of the athlete (YouTube). Best sources:
   single-player highlight reels, slow-motion compilations, and for QBs
   NFL Films retrospectives.
2. Scrub to a clean **2–4 second window of the signature motion** — a QB's
   drop-back through release, a golfer's address through follow-through.
   What makes a good clip:
   - athlete large in frame, ideally side-on or three-quarter angle
   - a stable camera (avoid whip pans) — golf's down-the-line and face-on
     swing cameras are ideal
   - **as few other people in frame as possible** — the matting model
     extracts *every* person it sees; golf is friendly here (caddies aside),
     for QBs a clean pocket shot beats a collapsing-pocket shot
3. Paste the URL and timestamps into that athlete's entry in the sport's
   manifest — one file per sport: `manifest.golf.json`,
   `manifest.nfl-qb.json`, … (the pipeline processes all of them):

   ```json
   {
     "id": "dan-marino-01",
     "playerId": "dan-marino",
     "source": "https://www.youtube.com/watch?v=XXXXXXXX",
     "start": "01:23.5",
     "end": "01:26.8",
     "crop": "auto"
   }
   ```

4. Run the pipeline (from `pipeline/` with the venv active):

   ```bash
   python process.py                      # everything with a source URL
   python process.py --only dan-marino-01 # just one clip
   python process.py --force              # reprocess existing output
   python process.py --dry-run            # validate the manifest only
   ```

5. **QA the output**: open `public/clips/<id>.webm`. You want a crisp
   white figure on black with no big blobs from other players
   or refs. If the matte is ugly (common with grainy pre-1980s footage), try
   a different source video or window and re-run with `--force`.
6. Flip the matching entry in `src/data/clips.json` from `"placeholder"` to
   `"/clips/<id>.webm"`. The game picks it up on the next build — no code
   changes.

Entries with an empty `source` are skipped with a warning, so you can fill
the manifest gradually and re-run any time; already-processed clips are
skipped unless you pass `--force`.

## What the pipeline does

```
yt-dlp (cached download)
  → ffmpeg trim to [start, end]
  → Robust Video Matting (temporally-consistent person matte, MPS-accelerated)
  → ffmpeg: white figure on black, native aspect ratio, fit within 720×720
  → <id>.webm (VP9, served) + <id>.mp4 (H.264 fallback) + <id>.jpg (poster)
```

The black background matches the app's clip box exactly, so real clips
blend seamlessly where the placeholders sat.

## Content posture

Source footage is NFL-copyrighted. The silhouette output is heavily
transformed — no jerseys, faces, logos, or broadcast graphics survive — and
the site is a non-commercial hobby project, but that is a considered risk,
not a license. Keep raw downloads local (`cache/` is gitignored) and only
ship the transformed silhouettes.
