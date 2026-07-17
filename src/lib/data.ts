import type { Clip, Player, Sport } from './types'
import sportsJson from '@/data/sports.json'
import playersJson from '@/data/players.json'
import clipsJson from '@/data/clips.json'

export function getSports(): Sport[] {
  return sportsJson as Sport[]
}

export function getActiveSports(): Sport[] {
  return getSports().filter((s) => s.active)
}

export function getSport(id: string): Sport {
  const s = getSports().find((s) => s.id === id)
  if (!s) throw new Error(`Unknown sport: ${id}`)
  return s
}

export function getPlayers(sportId?: string): Player[] {
  const players = playersJson as Player[]
  return sportId ? players.filter((p) => p.sportId === sportId) : players
}

export function getPlayer(id: string): Player {
  const p = (playersJson as Player[]).find((p) => p.id === id)
  if (!p) throw new Error(`Unknown player: ${id}`)
  return p
}

/**
 * The playable answer pool: only clips with real processed footage. Players
 * whose clips are still placeholders (unsourced or flagged in /dev) never
 * appear in a run.
 */
export function getPoolClips(sportId?: string): Clip[] {
  const clips = (clipsJson as Clip[]).filter((c) => c.src !== 'placeholder')
  if (!sportId) return clips
  const sportPlayerIds = new Set(getPlayers(sportId).map((p) => p.id))
  return clips.filter((c) => sportPlayerIds.has(c.playerId))
}
