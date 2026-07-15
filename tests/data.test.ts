import { describe, expect, it } from 'vitest'
import { getPlayers, getPoolClips } from '@/lib/data'

describe('data integrity', () => {
  const players = getPlayers()
  const clips = getPoolClips()
  const playerIds = new Set(players.map((p) => p.id))

  it('has ~50 in-pool players and a larger autocomplete list', () => {
    const pool = players.filter((p) => p.inPool)
    expect(pool.length).toBeGreaterThanOrEqual(45)
    expect(players.length).toBeGreaterThan(pool.length)
  })

  it('every clip references an existing in-pool player', () => {
    for (const clip of clips) {
      expect(playerIds.has(clip.playerId), `clip ${clip.id}`).toBe(true)
      const player = players.find((p) => p.id === clip.playerId)!
      expect(player.inPool, `${clip.playerId} must be inPool`).toBe(true)
    }
  })

  it('every in-pool player has at least one clip', () => {
    const clipPlayerIds = new Set(clips.map((c) => c.playerId))
    for (const p of players.filter((p) => p.inPool)) {
      expect(clipPlayerIds.has(p.id), `${p.id} missing clip`).toBe(true)
    }
  })

  it('player ids are unique and kebab-case', () => {
    expect(playerIds.size).toBe(players.length)
    for (const p of players) expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every player has era, teams, and yearsActive', () => {
    for (const p of players) {
      expect(p.era.length, p.id).toBeGreaterThan(0)
      expect(p.teams.length, p.id).toBeGreaterThan(0)
      expect(p.yearsActive.length, p.id).toBeGreaterThan(0)
    }
  })
})
