import type { Clip, Player, Sport } from './types'
import sportsJson from '@/data/sports.json'
import playersJson from '@/data/players.json'
import clipsJson from '@/data/clips.json'
import { hashSeed, mulberry32, shuffle } from './rng'

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

/** The decade tokens in an era string, e.g. "2010s–2020s" -> ["2010s","2020s"]. */
function decades(era: string): string[] {
  return era.match(/\d{4}s/g) ?? []
}

/**
 * `count` players for a multiple-choice guess, always including the correct
 * one. Distractors prefer the exact same era, then anyone sharing a decade,
 * then the rest of the sport, so there are always enough to fill the grid even
 * for sparse eras. Deterministic per `seed` (pass the clip id) so the options
 * are stable across re-renders.
 */
export function multipleChoiceOptions(
  sportId: string,
  correctId: string,
  count = 12,
  seed: string = correctId,
): Player[] {
  const players = getPlayers(sportId)
  const correct = players.find((p) => p.id === correctId)
  if (!correct) throw new Error(`Unknown player: ${correctId}`)
  const rng = mulberry32(hashSeed(seed))
  const correctDecades = new Set(decades(correct.era))
  const sharesDecade = (p: Player) => decades(p.era).some((d) => correctDecades.has(d))
  const pool = players.filter((p) => p.id !== correctId)

  const sameEra = pool.filter((p) => p.era === correct.era)
  const decadeMatch = pool.filter((p) => p.era !== correct.era && sharesDecade(p))
  const rest = pool.filter((p) => p.era !== correct.era && !sharesDecade(p))

  const distractors = [
    ...shuffle(sameEra, rng),
    ...shuffle(decadeMatch, rng),
    ...shuffle(rest, rng),
  ].slice(0, count - 1)

  return shuffle([correct, ...distractors], rng)
}
