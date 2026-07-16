#!/usr/bin/env python3
"""ShadowForm silhouette pipeline.

manifest.<sport>.json -> public/clips/<id>.webm + .mp4 + .jpg

One manifest per sport (manifest.nfl-qb.json, manifest.golf.json, ...);
all of them are processed together.

Per entry: yt-dlp download (cached) -> ffmpeg trim -> Robust Video Matting
alpha matte -> ffmpeg silhouette composite (black figure, light background).

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

# black figure on this flat warm-paper background — matches the app's
# --color-paper token (#F5F2EC) so clips blend into the projection frame
SILHOUETTE_VF = (
    "negate,format=gray,"
    "scale=720:720:force_original_aspect_ratio=increase,crop=720:720,"
    "eq=contrast=1.15,"
    "colorlevels=romax=0.961:gomax=0.949:bomax=0.925"
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


def trim(entry: dict, raw: Path) -> Path:
    trimmed = CACHE / f"{entry['id']}.trim.mp4"
    run(["ffmpeg", "-y", "-ss", entry["start"], "-to", entry["end"], "-i", str(raw),
         "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", str(trimmed)])
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
    """Robust Video Matting -> alpha video (white figure on black)."""
    import torch  # deferred: heavy import, only needed for real processing

    pha = CACHE / f"{entry['id']}.pha.mp4"
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


def silhouette(entry: dict, pha: Path) -> None:
    """Alpha matte -> black figure on flat light bg; export webm + mp4 + poster."""
    OUT.mkdir(parents=True, exist_ok=True)
    webm = OUT / f"{entry['id']}.webm"
    mp4 = OUT / f"{entry['id']}.mp4"
    poster = OUT / f"{entry['id']}.jpg"
    run(["ffmpeg", "-y", "-i", str(pha), "-vf", SILHOUETTE_VF, "-an",
         "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", str(webm)])
    run(["ffmpeg", "-y", "-i", str(pha), "-vf", SILHOUETTE_VF, "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", "23",
         "-pix_fmt", "yuv420p", str(mp4)])
    run(["ffmpeg", "-y", "-i", str(webm), "-vframes", "1", str(poster)])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="process a single clip id")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    entries = load_manifest_entries()

    # dry-run only validates the manifest; downloading tools aren't needed
    required_tools = () if args.dry_run else ("ffmpeg", "yt-dlp")
    for tool in required_tools:
        if not shutil.which(tool):
            print(f"ERROR: {tool} not found on PATH", file=sys.stderr)
            return 1

    CACHE.mkdir(exist_ok=True)
    done = skipped = 0
    for entry in entries:
        if args.only and entry["id"] != args.only:
            continue
        if not entry.get("source"):
            print(f"~ {entry['id']}: no source URL yet, skipping")
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
        raw = download(entry)
        trimmed = trim(entry, raw)
        pha = matte(entry, trimmed)
        silhouette(entry, pha)
        done += 1

    print(f"\nDone: {done} processed, {skipped} awaiting source URLs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
