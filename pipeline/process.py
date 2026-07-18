#!/usr/bin/env python3
"""ShadowForm silhouette pipeline.

manifest.<sport>.json -> public/clips/<id>.webm + .mp4 + .jpg

One manifest per sport (manifest.nfl-qb.json, manifest.golf.json, ...);
all of them are processed together.

Per entry: yt-dlp download (cached) -> ffmpeg trim -> Robust Video Matting
alpha matte -> ffmpeg silhouette composite (white figure on black).

Usage:
  python process.py            # process all manifest entries with a source
  python process.py --only dan-marino-01
  python process.py --force    # reprocess even if output exists
  python process.py --dry-run  # validate manifest + tool availability only
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "public" / "clips"


def load_manifest_entries() -> list[dict]:
    """Concatenate every per-sport manifest (manifest.<sport>.json)."""
    paths = sorted(ROOT.glob("manifest.*.json"))
    if not paths:
        raise SystemExit("no manifest.<sport>.json files found")
    entries = []
    for path in paths:
        entries.extend(json.loads(path.read_text()))
    return entries

# White figure on black — the RVM alpha matte is already exactly that, so no
# negate. Native aspect ratio preserved (no crop): fit within 720x720, and the
# app letterboxes invisibly against its black clip box.
SILHOUETTE_VF = (
    "format=gray,"
    "scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2,"
    "eq=contrast=1.15"
)


def run(cmd: list[str]) -> None:
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, capture_output=True)


def download(entry: dict) -> Path:
    raw = CACHE / f"{entry['id']}.source.mp4"
    if raw.exists():
        return raw
    run(["yt-dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4",
         "-o", str(raw), entry["source"]])
    return raw


def parse_ts(ts: str) -> float:
    """Colon-separated, last field is seconds and may be fractional:
    'HH:MM:SS.d' / 'MM:SS.d' / 'SS.d' -> seconds. Sub-second precision is
    expressed as a decimal on the seconds field, e.g. '00:00:01.5' -> 1.5."""
    return sum(float(p) * 60 ** i for i, p in enumerate(reversed(ts.strip().split(":"))))


DEFAULT_WINDOW = 4.0  # seconds, when an entry has no end timestamp


def trim_window(entry: dict) -> tuple[float, float]:
    """Resolve (start, end) in seconds, tolerating empty values: start defaults
    to the beginning, end to start + 4s (Shorts are often already just the swing)."""
    start = parse_ts(entry.get("start") or "0")
    end_raw = entry.get("end")
    end = parse_ts(end_raw) if end_raw else start + DEFAULT_WINDOW
    return start, end


def trim(entry: dict, raw: Path) -> Path:
    """Cached on the trim window: re-encodes only when start/end changed,
    which in turn invalidates the matte via mtime. Times are normalized to
    seconds so ffmpeg never sees a raw, possibly-malformed timestamp string."""
    trimmed = CACHE / f"{entry['id']}.trim.mp4"
    meta = CACHE / f"{entry['id']}.trim.txt"
    start, end = trim_window(entry)
    window = f"{start:.3f}|{end:.3f}"
    if trimmed.exists() and meta.exists() and meta.read_text() == window:
        return trimmed
    run(["ffmpeg", "-y", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(raw),
         "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", str(trimmed)])
    meta.write_text(window)
    return trimmed


def _fix_rvm_videowriter() -> None:
    """RVM passes the frame rate to PyAV as a string, which PyAV >= 12 rejects."""
    import sys
    from fractions import Fraction

    iu = sys.modules["inference_utils"]

    def _init(self, path, frame_rate, bit_rate=1000000):
        import av

        self.container = av.open(path, mode="w")
        rate = Fraction(frame_rate).limit_denominator(65535)
        self.stream = self.container.add_stream("h264", rate=rate)
        self.stream.pix_fmt = "yuv420p"
        self.stream.bit_rate = bit_rate

    iu.VideoWriter.__init__ = _init


def matte(entry: dict, trimmed: Path) -> Path:
    """Robust Video Matting -> alpha video (white figure on black).

    Cached: skipped when the matte already exists and is newer than the
    trimmed source, so --force restyling only reruns the cheap ffmpeg pass.
    """
    pha = CACHE / f"{entry['id']}.pha.mp4"
    if pha.exists() and pha.stat().st_mtime >= trimmed.stat().st_mtime:
        return pha

    import torch  # deferred: heavy import, only needed for real processing
    model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True).eval()
    convert_video = torch.hub.load("PeterL1n/RobustVideoMatting", "converter", trust_repo=True)
    _fix_rvm_videowriter()
    if torch.backends.mps.is_available():
        model = model.to("mps")
    convert_video(
        model,
        input_source=str(trimmed),
        output_type="video",
        output_alpha=str(pha),
        downsample_ratio=None,  # auto
        seq_chunk=8,
    )
    return pha


def silhouette(entry: dict, pha: Path, speed: float = 4.0) -> None:
    """Alpha matte -> white figure on black.

    Exports both speeds as separate files — playbackRate is unreliable on
    iOS (4x means 120fps decode), so real time is baked in with setpts:
      <id>.webm/.mp4       full speed (source slow-mo compressed by `speed`)
      <id>-slo.webm/.mp4   the source's native slow motion
    plus <id>.jpg poster.
    """
    OUT.mkdir(parents=True, exist_ok=True)
    variants = {
        "": f"{SILHOUETTE_VF},setpts=PTS/{speed},fps=30",
        "-slo": SILHOUETTE_VF,
    }
    for suffix, vf in variants.items():
        webm = OUT / f"{entry['id']}{suffix}.webm"
        mp4 = OUT / f"{entry['id']}{suffix}.mp4"
        run(["ffmpeg", "-y", "-i", str(pha), "-vf", vf, "-an",
             "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", str(webm)])
        run(["ffmpeg", "-y", "-i", str(pha), "-vf", vf, "-an",
             "-c:v", "libx264", "-preset", "slow", "-crf", "23",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)])
    # representative frame, not frame 1 — the matte warms up over the first
    # frames and clips may open before the athlete is fully visible
    run(["ffmpeg", "-y", "-i", str(OUT / f"{entry['id']}.webm"),
         "-vf", "thumbnail=30", "-frames:v", "1", str(OUT / f"{entry['id']}.jpg")])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="process a single clip id")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    entries = load_manifest_entries()

    # per-clip real-time speed factor lives with the game data (tuned in /dev)
    clips_json = ROOT.parent / "src" / "data" / "clips.json"
    speeds = {c["id"]: c.get("speed", 4.0) for c in json.loads(clips_json.read_text())}

    # dry-run only validates the manifest; downloading tools aren't needed
    required_tools = () if args.dry_run else ("ffmpeg", "yt-dlp")
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"ERROR: {tool} not found on PATH", file=sys.stderr)
            return 1

    CACHE.mkdir(exist_ok=True)
    done = skipped = 0
    failed: list[str] = []
    for entry in entries:
        if args.only and entry["id"] != args.only:
            continue
        if not entry.get("source"):
            print(f"~ {entry['id']}: no source URL yet, skipping")
            skipped += 1
            continue
        if entry.get("flagged") and not args.only:
            print(f"~ {entry['id']}: flagged as bad, skipping (fix via /dev or --only)")
            skipped += 1
            continue
        if not args.force and (OUT / f"{entry['id']}.webm").exists():
            print(f"= {entry['id']}: already processed")
            continue
        if args.dry_run:
            print(f"+ {entry['id']}: would process {entry['source']} "
                  f"[{entry['start']}-{entry['end']}]")
            continue
        print(f"> {entry['id']}")
        try:
            raw = download(entry)
            trimmed = trim(entry, raw)
            pha = matte(entry, trimmed)
            silhouette(entry, pha, speeds.get(entry["id"], 4.0))
            done += 1
        except subprocess.CalledProcessError as e:
            tail = (e.stderr or b"").decode(errors="replace").strip().splitlines()[-3:]
            print(f"! {entry['id']} FAILED: {' '.join(str(c) for c in e.cmd[:2])}", file=sys.stderr)
            for line in tail:
                print(f"    {line}", file=sys.stderr)
            failed.append(entry["id"])
        except Exception as e:  # keep the batch going on any per-clip error
            print(f"! {entry['id']} FAILED: {e}", file=sys.stderr)
            failed.append(entry["id"])

    print(f"\nDone: {done} processed, {skipped} awaiting source URLs.")
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
