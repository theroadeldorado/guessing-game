import { describe, expect, it } from 'vitest'
import {
  createRun, currentClip, submitGuess, advance, hintLevel, shareText,
  POINTS, MAX_GUESSES,
} from '@/lib/game'
import type { Clip } from '@/lib/types'

const clips: Clip[] = [
  { id: 'a-01', playerId: 'a', src: 'placeholder' },
  { id: 'b-01', playerId: 'b', src: 'placeholder' },
  { id: 'c-01', playerId: 'c', src: 'placeholder' },
]

// rng() = 0 makes the shuffle deterministic
const run = () => createRun(clips, () => 0)

describe('createRun', () => {
  it('starts in guessing phase with zero score and all clips queued', () => {
    const s = run()
    expect(s.phase).toBe('guessing')
    expect(s.score).toBe(0)
    expect(s.history).toEqual([])
    expect(s.clipOrder).toHaveLength(3)
    expect(hintLevel(s)).toBe(0)
  })

  it('shuffles: contains the same clips regardless of rng', () => {
    const ids = createRun(clips, Math.random).clipOrder.map((c) => c.id).sort()
    expect(ids).toEqual(['a-01', 'b-01', 'c-01'])
  })
})

describe('submitGuess', () => {
  it('first-guess correct scores 100 and enters reveal', () => {
    let s = run()
    s = submitGuess(s, currentClip(s).playerId)
    expect(s.score).toBe(POINTS[0])
    expect(s.phase).toBe('reveal')
    expect(s.history).toEqual([
      { clipId: s.clipOrder[0].id, playerId: s.clipOrder[0].playerId, guessesUsed: 1, points: 100, solved: true },
    ])
  })

  it('wrong guesses escalate hints and lower points: 50 then 25', () => {
    let s = run()
    s = submitGuess(s, 'wrong-1')
    expect(hintLevel(s)).toBe(1)
    expect(s.phase).toBe('guessing')
    s = submitGuess(s, 'wrong-2')
    expect(hintLevel(s)).toBe(2)
    s = submitGuess(s, currentClip(s).playerId)
    expect(s.score).toBe(POINTS[2])
    expect(s.history[0]).toMatchObject({ guessesUsed: 3, points: 25, solved: true })
  })

  it('second guess correct scores 50', () => {
    let s = run()
    s = submitGuess(s, 'wrong-1')
    s = submitGuess(s, currentClip(s).playerId)
    expect(s.score).toBe(POINTS[1])
  })

  it('three wrong guesses resolves the clip unsolved with 0 points', () => {
    let s = run()
    for (let i = 0; i < MAX_GUESSES; i++) s = submitGuess(s, `wrong-${i}`)
    expect(s.phase).toBe('reveal')
    expect(s.score).toBe(0)
    expect(s.history[0]).toMatchObject({ guessesUsed: 3, points: 0, solved: false })
  })

  it('ignores guesses outside the guessing phase', () => {
    let s = run()
    s = submitGuess(s, currentClip(s).playerId)
    const after = submitGuess(s, 'anything')
    expect(after).toEqual(s)
  })

  it('ignores repeating an already-wrong guess', () => {
    let s = run()
    s = submitGuess(s, 'wrong-1')
    const after = submitGuess(s, 'wrong-1')
    expect(after).toEqual(s)
  })
})

describe('advance', () => {
  it('moves to the next clip after a solved reveal', () => {
    let s = run()
    s = submitGuess(s, currentClip(s).playerId)
    s = advance(s)
    expect(s.phase).toBe('guessing')
    expect(s.index).toBe(1)
    expect(hintLevel(s)).toBe(0)
  })

  it('ends the run after a failed clip', () => {
    let s = run()
    for (let i = 0; i < MAX_GUESSES; i++) s = submitGuess(s, `wrong-${i}`)
    s = advance(s)
    expect(s.phase).toBe('over')
  })

  it('ends the run when the pool is exhausted (perfect run)', () => {
    let s = run()
    for (let i = 0; i < clips.length; i++) {
      s = submitGuess(s, currentClip(s).playerId)
      s = advance(s)
    }
    expect(s.phase).toBe('over')
    expect(s.score).toBe(300)
  })
})

describe('shareText', () => {
  it('maps guess counts to emoji and includes score', () => {
    let s = run()
    s = submitGuess(s, currentClip(s).playerId) // 💯
    s = advance(s)
    s = submitGuess(s, 'w')
    s = submitGuess(s, currentClip(s).playerId) // 🎯
    s = advance(s)
    for (let i = 0; i < MAX_GUESSES; i++) s = submitGuess(s, `w${i}`) // 💀
    s = advance(s)
    expect(shareText(s)).toBe('🏈 ShadowForm — 150 pts, 2 QBs\n💯🎯💀')
  })
})
