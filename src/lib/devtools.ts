// Server-only helpers for the dev clip-review tool. These read and write
// repo files (pipeline manifests, clips.json), so they must never run in
// production — every consumer guards on NODE_ENV first.
import fs from 'node:fs'
import path from 'node:path'

const REPO = process.cwd()
const PIPELINE = path.join(REPO, 'pipeline')
const CLIPS_JSON = path.join(REPO, 'src', 'data', 'clips.json')

/** The review tool is opt-in: dev server AND SHADOWFORM_DEV_TOOLS=1 (.env.local). */
export function devToolsEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.SHADOWFORM_DEV_TOOLS === '1'
  )
}

export interface ManifestEntry {
  id: string
  playerId: string
  source: string
  start: string
  end: string
  crop: string
  flagged?: boolean
}

export interface DevClip extends ManifestEntry {
  sportId: string
  playerName: string
  src: string // current clips.json src ("placeholder" or /clips/...)
  speed?: number // playbackRate approximating real time (default 4)
}

function manifestPaths(): string[] {
  return fs
    .readdirSync(PIPELINE)
    .filter((f) => /^manifest\..+\.json$/.test(f))
    .sort()
    .map((f) => path.join(PIPELINE, f))
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export function listDevClips(): DevClip[] {
  const players = JSON.parse(
    fs.readFileSync(path.join(REPO, 'src', 'data', 'players.json'), 'utf8'),
  ) as { id: string; name: string; sportId: string }[]
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as {
    id: string
    src: string
    speed?: number
  }[]
  const playerById = new Map(players.map((p) => [p.id, p]))
  const clipById = new Map(clips.map((c) => [c.id, c]))

  const out: DevClip[] = []
  for (const file of manifestPaths()) {
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[]
    for (const e of entries) {
      const player = playerById.get(e.playerId)
      const clip = clipById.get(e.id)
      out.push({
        ...e,
        sportId: player?.sportId ?? 'unknown',
        playerName: player?.name ?? e.playerId,
        src: clip?.src ?? 'placeholder',
        speed: clip?.speed,
      })
    }
  }
  return out
}

/** Update manifest fields for one clip id. Returns the updated entry. */
export function updateManifestEntry(
  id: string,
  fields: Partial<Pick<ManifestEntry, 'source' | 'start' | 'end' | 'flagged'>>,
): ManifestEntry {
  for (const file of manifestPaths()) {
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[]
    const entry = entries.find((e) => e.id === id)
    if (!entry) continue
    if (fields.source !== undefined) entry.source = fields.source
    if (fields.start !== undefined) entry.start = fields.start
    if (fields.end !== undefined) entry.end = fields.end
    if (fields.flagged !== undefined) {
      if (fields.flagged) entry.flagged = true
      else delete entry.flagged
    }
    writeJson(file, entries)
    return entry
  }
  throw new Error(`No manifest entry for ${id}`)
}

interface ClipRow {
  id: string
  src: string
  speed?: number
}

/** Point clips.json at the real webm (if it exists) or the placeholder. */
export function setClipSrc(id: string, real: boolean): string {
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as ClipRow[]
  const clip = clips.find((c) => c.id === id)
  if (!clip) throw new Error(`No clips.json entry for ${id}`)
  const webm = path.join(REPO, 'public', 'clips', `${id}.webm`)
  clip.src = real && fs.existsSync(webm) ? `/clips/${id}.webm` : 'placeholder'
  writeJson(CLIPS_JSON, clips)
  return clip.src
}

/** Persist the real-time playbackRate multiplier for a clip (default 4). */
export function setClipSpeed(id: string, speed: number): void {
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as ClipRow[]
  const clip = clips.find((c) => c.id === id)
  if (!clip) throw new Error(`No clips.json entry for ${id}`)
  if (Number.isFinite(speed) && speed > 0 && speed !== 4) clip.speed = speed
  else delete clip.speed
  writeJson(CLIPS_JSON, clips)
}
