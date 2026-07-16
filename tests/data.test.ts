import { describe, expect, it } from 'vitest'
import { getActiveSports, getPlayers, getPoolClips, getSports } from '@/lib/data'

describe('data integrity', () => {
  const sports = getSports()
  const players = getPlayers()
  const clips = getPoolClips()
  const playerIds = new Set(players.map((p) => p.id))
  const sportIds = new Set(sports.map((s) => s.id))

  it('has at least one active sport, and every sport has full config', () => {
    expect(getActiveSports().length).toBeGreaterThanOrEqual(1)
    for (const s of sports) {
      expect(s.label.length, s.id).toBeGreaterThan(0)
      expect(s.athleteNoun.length, s.id).toBeGreaterThan(0)
      expect(s.athleteNounPlural.length, s.id).toBeGreaterThan(0)
      expect(s.emoji.length, s.id).toBeGreaterThan(0)
      expect(s.detailLabel.length, s.id).toBeGreaterThan(0)
      expect(s.inputPlaceholder.length, s.id).toBeGreaterThan(0)
    }
  })

  it('every player belongs to a known sport', () => {
    for (const p of players) expect(sportIds.has(p.sportId), p.id).toBe(true)
  })

  it('every sport has a sizable pool and a larger autocomplete list', () => {
    for (const s of sports) {
      const sportPlayers = getPlayers(s.id)
      const pool = sportPlayers.filter((p) => p.inPool)
      expect(pool.length, s.id).toBeGreaterThanOrEqual(45)
      expect(sportPlayers.length, s.id).toBeGreaterThan(pool.length)
    }
  })

  it('pool clips filter by sport and cover every in-pool player', () => {
    for (const s of sports) {
      const sportPlayerIds = new Set(getPlayers(s.id).map((p) => p.id))
      const sportClips = getPoolClips(s.id)
      for (const clip of sportClips) {
        expect(sportPlayerIds.has(clip.playerId), `clip ${clip.id}`).toBe(true)
      }
      const clipPlayerIds = new Set(sportClips.map((c) => c.playerId))
      for (const p of getPlayers(s.id).filter((p) => p.inPool)) {
        expect(clipPlayerIds.has(p.id), `${p.id} missing clip`).toBe(true)
      }
    }
  })

  it('every clip references an existing in-pool player', () => {
    for (const clip of clips) {
      expect(playerIds.has(clip.playerId), `clip ${clip.id}`).toBe(true)
      const player = players.find((p) => p.id === clip.playerId)!
      expect(player.inPool, `${clip.playerId} must be inPool`).toBe(true)
    }
  })

  it('player ids are unique and kebab-case', () => {
    expect(playerIds.size).toBe(players.length)
    for (const p of players) expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every player has era, detail, and yearsActive', () => {
    for (const p of players) {
      expect(p.era.length, p.id).toBeGreaterThan(0)
      expect(p.detail.length, p.id).toBeGreaterThan(0)
      expect(p.yearsActive.length, p.id).toBeGreaterThan(0)
    }
  })
})
