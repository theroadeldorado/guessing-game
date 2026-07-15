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

## The curation workflow (per QB)

1. Find a highlight video of the QB (YouTube). Best sources: NFL Films
   retrospectives, single-player highlight reels, slow-motion compilations.
2. Scrub to a clean **2–4 second window of the throwing motion**: drop-back
   through release. What makes a good clip:
   - QB large in frame, ideally side-on or three-quarter angle
   - a stable camera (avoid whip pans)
   - **as few other people in frame as possible** — the matting model
     extracts *every* person it sees, so a clean pocket shot beats a
     collapsing-pocket shot
3. Paste the URL and timestamps into that QB's entry in `manifest.json`:

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

5. **QA the output**: open `public/clips/<id>.webm`. You want a crisp black
   figure on the warm paper background with no big blobs from other players
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
  → ffmpeg: negate → black figure on #F5F2EC paper → 720×720 crop
  → <id>.webm (VP9, served) + <id>.mp4 (H.264 fallback) + <id>.jpg (poster)
```

The paper background matches the app's clip frame exactly, so real clips
blend seamlessly where the placeholders sat.

## Content posture

Source footage is NFL-copyrighted. The silhouette output is heavily
transformed — no jerseys, faces, logos, or broadcast graphics survive — and
the site is a non-commercial hobby project, but that is a considered risk,
not a license. Keep raw downloads local (`cache/` is gitignored) and only
ship the transformed silhouettes.
