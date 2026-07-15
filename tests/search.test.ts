import { describe, expect, it } from 'vitest'
import { normalize, searchPlayers } from '@/lib/search'
import type { Player } from '@/lib/types'

const P = (id: string, name: string): Player => ({
  id, name, sportId: 'nfl-qb', era: 'x', teams: ['X'], yearsActive: 'x', inPool: true,
})

const players = [
  P('dan-marino', 'Dan Marino'),
  P('peyton-manning', 'Peyton Manning'),
  P('eli-manning', 'Eli Manning'),
  P('patrick-mahomes', 'Patrick Mahomes'),
  P('tom-brady', 'Tom Brady'),
]

describe('normalize', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalize('Dàn Márino')).toBe('dan marino')
  })
})

describe('searchPlayers', () => {
  it('returns empty for empty query', () => {
    expect(searchPlayers(players, '')).toEqual([])
    expect(searchPlayers(players, '  ')).toEqual([])
  })

  it('matches word prefixes: "man" finds both Mannings before Mahomes', () => {
    const names = searchPlayers(players, 'man').map((p) => p.name)
    expect(names.slice(0, 2).sort()).toEqual(['Eli Manning', 'Peyton Manning'])
  })

  it('matches full-name prefix highest: "pey" → Peyton first', () => {
    expect(searchPlayers(players, 'pey')[0].name).toBe('Peyton Manning')
  })

  it('tolerates missing letters via subsequence: "mhomes" finds Mahomes', () => {
    expect(searchPlayers(players, 'mhomes').map((p) => p.name)).toContain('Patrick Mahomes')
  })

  it('matches across word boundary: "danmar" finds Dan Marino', () => {
    expect(searchPlayers(players, 'danmar')[0].name).toBe('Dan Marino')
  })

  it('respects limit', () => {
    expect(searchPlayers(players, 'a', 2)).toHaveLength(2)
  })

  it('returns nothing for garbage', () => {
    expect(searchPlayers(players, 'zzzz')).toEqual([])
  })
})
