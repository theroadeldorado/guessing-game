import type { Clip, Player, Sport } from './types'
import sportsJson from '@/data/sports.json'
import playersJson from '@/data/players.json'
import clipsJson from '@/data/clips.json'

export function getSports(): Sport[] {
  return sportsJson as Sport[]
}

export function getPlayers(): Player[] {
  return playersJson as Player[]
}

export function getPlayer(id: string): Player {
  const p = getPlayers().find((p) => p.id === id)
  if (!p) throw new Error(`Unknown player: ${id}`)
  return p
}

export function getPoolClips(): Clip[] {
  return clipsJson as Clip[]
}
