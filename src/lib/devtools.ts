// Server-only helpers for the dev clip-review tool. These read and write
// repo files (pipeline manifests, clips.json), so they must never run in
// production; every consumer guards on NODE_ENV first.
import fs from 'node:fs'
import path from 'node:path'
import type { Player } from './types'
import { clipAlias } from './clipalias'

const REPO = process.cwd()
const PIPELINE = path.join(REPO, 'pipeline')
const CLIPS_JSON = path.join(REPO, 'src', 'data', 'clips.json')
const PLAYERS_JSON = path.join(REPO, 'src', 'data', 'players.json')

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
  file?: string // processed webm on disk, present even when flagged out of the game
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
  const players = JSON.parse(fs.readFileSync(PLAYERS_JSON, 'utf8')) as {
    id: string
    name: string
    sportId: string
  }[]
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as {
    id: string
    src: string
    speed?: number
    crop?: string
  }[]
  const playerById = new Map(players.map((p) => [p.id, p]))
  const clipById = new Map(clips.map((c) => [c.id, c]))

  const out: DevClip[] = []
  for (const file of manifestPaths()) {
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[]
    for (const e of entries) {
      const player = playerById.get(e.playerId)
      const clip = clipById.get(e.id)
      const webm = path.join(REPO, 'public', 'clips', `${e.id}.webm`)
      out.push({
        ...e,
        sportId: player?.sportId ?? 'unknown',
        playerName: player?.name ?? e.playerId,
        src: clip?.src ?? 'placeholder',
        file: fs.existsSync(webm) ? `/clips/${e.id}.webm` : undefined,
        crop: clip?.crop ?? 'auto',
        speed: clip?.speed,
      })
    }
  }
  return out
}

/** Read a manifest entry (or null) without mutating it. */
export function manifestEntry(id: string): ManifestEntry | null {
  for (const file of manifestPaths()) {
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[]
    const entry = entries.find((e) => e.id === id)
    if (entry) return entry
  }
  return null
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
  playerId: string
  src: string
  speed?: number
  crop?: string
}

/** The playerId for a clip, from whichever manifest defines it. */
function manifestPlayerId(id: string): string {
  for (const file of manifestPaths()) {
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[]
    const entry = entries.find((e) => e.id === id)
    if (entry) return entry.playerId
  }
  throw new Error(`No manifest entry for ${id}`)
}

/**
 * Gate the make-a-clip-real flow on a poolable player, keeping the invariant
 * that every clips.json row references an in-pool player. Reprocessing a clip
 * means you intend to play it, so a benched player is promoted into the pool;
 * a player that doesn't exist yet is a hard error (we can't invent its bio).
 */
export function ensurePoolPlayer(id: string): void {
  const playerId = manifestPlayerId(id)
  const players = JSON.parse(fs.readFileSync(PLAYERS_JSON, 'utf8')) as Player[]
  const player = players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error(`No player '${playerId}' in players.json; add it there first.`)
  }
  if (!player.inPool) {
    player.inPool = true
    writeJson(PLAYERS_JSON, players)
  }
}

/**
 * Point clips.json at the real webm, or back at the placeholder. Only a real
 * src creates a missing row; a placeholder row for a clip with no footage is
 * pointless and would reference a possibly out-of-pool player.
 */
export function setClipSrc(id: string, real: boolean): string {
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as ClipRow[]
  const webm = path.join(REPO, 'public', 'clips', `${id}.webm`)
  // Public URL is the opaque alias (proxy.ts maps it back to the real file).
  const src = real && fs.existsSync(webm) ? `/c/${clipAlias(id)}.webm` : 'placeholder'
  const row = clips.find((c) => c.id === id)
  if (row) {
    row.src = src
  } else {
    if (src === 'placeholder') return src // nothing worth persisting
    clips.push({ id, playerId: manifestPlayerId(id), src })
  }
  writeJson(CLIPS_JSON, clips)
  return src
}

/** Persist the real-time playbackRate multiplier (default 4). No-op until the
 *  clip has a row; speed is meaningless before there's footage to play. */
export function setClipSpeed(id: string, speed: number): void {
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as ClipRow[]
  const row = clips.find((c) => c.id === id)
  if (!row) return
  if (Number.isFinite(speed) && speed > 0 && speed !== 4) row.speed = speed
  else delete row.speed
  writeJson(CLIPS_JSON, clips)
}

/** Persist the render-time framing ('auto' or 'cx,cy,zoom'). No-op until the
 *  clip has a row; there's nothing to frame before it's processed. */
export function setClipCrop(id: string, crop: string): void {
  const clips = JSON.parse(fs.readFileSync(CLIPS_JSON, 'utf8')) as ClipRow[]
  const row = clips.find((c) => c.id === id)
  if (!row) return
  if (crop && crop !== 'auto') row.crop = crop
  else delete row.crop
  writeJson(CLIPS_JSON, clips)
}
