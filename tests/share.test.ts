import { describe, expect, it } from 'vitest'
import {
  parseShareData,
  resultsEmoji,
  shareQuery,
  shareText,
  toShareData,
} from '@/lib/share'
import type { RunState } from '@/lib/game'

const run = (score: number, results: Array<{ solved: boolean; guessesUsed: number }>): RunState => ({
  clipOrder: [],
  index: 0,
  wrongGuesses: [],
  score,
  history: results.map((r, i) => ({
    clipId: `c${i}`,
    playerId: `p${i}`,
    guessesUsed: r.guessesUsed,
    points: 0,
    solved: r.solved,
  })),
  phase: 'over',
})

describe('toShareData / shareQuery', () => {
  it('encodes score, solved count, and per-clip result digits', () => {
    const state = run(150, [
      { solved: true, guessesUsed: 1 },
      { solved: true, guessesUsed: 2 },
      { solved: false, guessesUsed: 3 },
    ])
    const d = toShareData(state, 'golf')
    expect(d).toEqual({ sport: 'golf', score: 150, solved: 2, results: '120' })
    expect(shareQuery(d)).toBe('g=golf&s=150&n=2&r=120')
  })
})

describe('parseShareData', () => {
  it('round-trips a query string', () => {
    const d = parseShareData(new URLSearchParams('g=golf&s=150&n=2&r=120'))
    expect(d).toEqual({ sport: 'golf', score: 150, solved: 2, results: '120' })
  })

  it('clamps and sanitizes hostile input', () => {
    const d = parseShareData(new URLSearchParams('g=<script>&s=-5&n=1e9&r=9ab12'))
    expect(d.sport).toBe('script') // stripped to word chars, non-empty
    expect(d.score).toBe(0) // negative clamped to 0
    expect(d.results).toBe('12') // only 0-3 digits kept
    expect(Number.isFinite(d.solved)).toBe(true)
  })

  it('defaults an empty sport to golf', () => {
    expect(parseShareData(new URLSearchParams('')).sport).toBe('golf')
  })
})

describe('resultsEmoji', () => {
  it('maps digits to the streak emoji', () => {
    expect(resultsEmoji('1230')).toBe('💯🎯🤏💀')
  })
})

describe('shareText', () => {
  it('is challenge-framed and singularizes for one solve', () => {
    const sport = { emoji: '⛳', athleteNoun: 'Golfer', athleteNounPlural: 'Golfers' }
    const many = shareText({ sport: 'golf', score: 150, solved: 2, results: '120' }, sport)
    expect(many).toContain("I ID'd 2 golfers for 150 pts on ShadowForm ⛳")
    expect(many).toContain('Think you can beat my run?')
    const one = shareText({ sport: 'golf', score: 100, solved: 1, results: '1' }, sport)
    expect(one).toContain("I ID'd 1 golfer for 100 pts")
  })
})
