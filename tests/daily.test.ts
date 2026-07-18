import { describe, expect, it } from 'vitest'
import {
  EPOCH,
  applyResult,
  dailyClip,
  dailyShareQuery,
  daysBetween,
  golfDate,
  isYesterday,
  labelFor,
  msToNextTee,
  narrowedField,
  parForDate,
  parseDailyShare,
  scoreToPar,
  shareStrokes,
  startDaily,
  submitDailyGuess,
  type DailyShare,
  type DailyState,
} from '@/lib/daily'
import { getPlayers, getPoolClips } from '@/lib/data'

const [ey, em, ed] = EPOCH.split('-').map(Number)
const offsetKey = (i: number): string => {
  const d = new Date(Date.UTC(ey, em - 1, ed + i))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

describe('dates', () => {
  it('daysBetween / isYesterday', () => {
    expect(daysBetween('2026-07-18', '2026-07-20')).toBe(2)
    expect(daysBetween('2026-07-20', '2026-07-18')).toBe(-2)
    expect(isYesterday('2026-07-19', '2026-07-20')).toBe(true)
    expect(isYesterday('2026-07-18', '2026-07-20')).toBe(false)
  })

  it('par: Sun=3, Wed=5, otherwise 4', () => {
    for (let i = 0; i < 14; i++) {
      const key = offsetKey(i)
      const wd = new Date(Date.UTC(ey, em - 1, ed + i)).getUTCDay()
      const expected = wd === 0 ? 3 : wd === 3 ? 5 : 4
      expect(parForDate(key), key).toBe(expected)
    }
  })
})

describe('scoring labels', () => {
  it('maps strokes-to-par to golf terms', () => {
    expect(labelFor(true, 1, 3)).toBe('Hole in One')
    expect(labelFor(true, 1, 4)).toBe('Hole in One')
    expect(labelFor(true, 2, 4)).toBe('Eagle')
    expect(labelFor(true, 2, 5)).toBe('Albatross') // -3
    expect(labelFor(true, 3, 4)).toBe('Birdie')
    expect(labelFor(true, 4, 4)).toBe('Par')
    expect(labelFor(true, 5, 4)).toBe('Bogey')
    expect(labelFor(false, 6, 4)).toBe('Double Bogey')
  })
})

describe('submitDailyGuess + scoreToPar', () => {
  const pool = getPoolClips('golf')
  const holeAt = (key: string) => startDaily(key, pool)

  it('solving records strokes and ends the hole', () => {
    const s0 = holeAt('2026-07-20') // par 4, budget 5
    const answer = s0.hole.clip.playerId
    const s1 = submitDailyGuess(s0, answer)
    expect(s1.solved).toBe(true)
    expect(s1.strokes).toBe(1)
    expect(s1.phase).toBe('done')
    expect(scoreToPar(s1)).toBe(1 - s1.hole.par)
  })

  it('running out of budget is a double bogey and ends the hole', () => {
    let s = holeAt('2026-07-20') // par 4 → budget 5
    const wrong = getPlayers('golf')
      .filter((p) => p.id !== s.hole.clip.playerId)
      .slice(0, s.hole.budget)
      .map((p) => p.id)
    for (const id of wrong) s = submitDailyGuess(s, id)
    expect(s.guesses).toHaveLength(s.hole.budget)
    expect(s.solved).toBe(false)
    expect(s.phase).toBe('done')
    expect(scoreToPar(s)).toBe(2) // double bogey
  })

  it('ignores duplicate and post-completion guesses', () => {
    const s0 = holeAt('2026-07-20')
    const wrongId = getPlayers('golf').find((p) => p.id !== s0.hole.clip.playerId)!.id
    const s1 = submitDailyGuess(s0, wrongId)
    expect(submitDailyGuess(s1, wrongId)).toBe(s1) // duplicate no-op
    const solved = submitDailyGuess(s1, s0.hole.clip.playerId)
    expect(submitDailyGuess(solved, wrongId)).toBe(solved) // done no-op
  })
})

describe('dailyClip rotation', () => {
  const pool = getPoolClips('golf')

  it('is deterministic per date', () => {
    expect(dailyClip('2026-08-01', pool).id).toBe(dailyClip('2026-08-01', pool).id)
  })

  it('uses every clip once before repeating (one full cycle)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < pool.length; i++) {
      const id = dailyClip(offsetKey(i), pool).id
      expect(seen.has(id), `repeat at day ${i}`).toBe(false)
      seen.add(id)
    }
    expect(seen.size).toBe(pool.length)
  })

  it('reshuffles into a new full permutation next cycle', () => {
    const first = Array.from({ length: pool.length }, (_, i) => dailyClip(offsetKey(i), pool).id)
    const second = Array.from({ length: pool.length }, (_, i) =>
      dailyClip(offsetKey(pool.length + i), pool).id,
    )
    expect(new Set(second).size).toBe(pool.length) // still a full permutation
    expect(second).not.toEqual(first) // but a different order
  })
})

describe('narrowedField', () => {
  it('halves each wrong guess, always keeps the answer, and is nested', () => {
    const all = getPlayers('golf')
    const s0 = startDaily('2026-07-20', getPoolClips('golf'))
    const answer = s0.hole.clip.playerId
    const f0 = narrowedField(s0, all)
    expect(f0).toHaveLength(all.length)

    const wrong = all.filter((p) => p.id !== answer).map((p) => p.id)
    const s1 = submitDailyGuess(s0, wrong[0])
    const s2 = submitDailyGuess(s1, wrong[1])
    const f1 = narrowedField(s1, all)
    const f2 = narrowedField(s2, all)

    expect(f1.length).toBeLessThan(f0.length)
    expect(f2.length).toBeLessThan(f1.length)
    expect(f1.some((p) => p.id === answer)).toBe(true)
    expect(f2.some((p) => p.id === answer)).toBe(true)
    const ids1 = new Set(f1.map((p) => p.id))
    expect(f2.every((p) => ids1.has(p.id))).toBe(true) // nested subset
  })
})

describe('applyResult streak transitions', () => {
  const pid = getPlayers('golf')[0].id
  const finished = (opts: {
    date: string
    par: number
    solved: boolean
    strokes: number
  }): DailyState => ({
    hole: {
      date: opts.date,
      weekday: 1,
      par: opts.par,
      yards: 400,
      clip: { id: `${pid}-01`, playerId: pid, src: '/x.webm' },
      budget: opts.par + 1,
    },
    guesses: [],
    solved: opts.solved,
    strokes: opts.strokes,
    phase: 'done',
  })

  it('fresh streak from nothing', () => {
    const p = applyResult(null, '2026-07-20', finished({ date: '2026-07-20', par: 4, solved: true, strokes: 3 }))
    expect(p.streak).toBe(1)
    expect(p.alive).toBe(true)
    expect(p.toPar).toBe(-1) // birdie
    expect(p.lastResult.player).toBe(getPlayers('golf')[0].name)
  })

  it('continues on consecutive day', () => {
    const day1 = applyResult(null, '2026-07-20', finished({ date: '2026-07-20', par: 4, solved: true, strokes: 3 }))
    const day2 = applyResult(day1, '2026-07-21', finished({ date: '2026-07-21', par: 4, solved: true, strokes: 2 }))
    expect(day2.streak).toBe(2)
    expect(day2.toPar).toBe(-1 + -2)
  })

  it('a missed day starts fresh even on a make', () => {
    const day1 = applyResult(null, '2026-07-20', finished({ date: '2026-07-20', par: 4, solved: true, strokes: 3 }))
    const day3 = applyResult(day1, '2026-07-22', finished({ date: '2026-07-22', par: 4, solved: true, strokes: 3 }))
    expect(day3.streak).toBe(1)
    expect(day3.toPar).toBe(-1)
  })

  it('a failed hole ends the streak without adding to it', () => {
    const day1 = applyResult(null, '2026-07-20', finished({ date: '2026-07-20', par: 4, solved: true, strokes: 3 }))
    const day2 = applyResult(day1, '2026-07-21', finished({ date: '2026-07-21', par: 4, solved: false, strokes: 6 }))
    expect(day2.alive).toBe(false)
    expect(day2.streak).toBe(1) // unchanged
    expect(day2.toPar).toBe(-1) // unchanged
    expect(day2.lastResult.scoreToPar).toBe(2) // double bogey shown
  })
})

describe('tee time (5am US Eastern)', () => {
  it('the golf day flips at 5am ET — summer (EDT = UTC-4, tee at 09:00 UTC)', () => {
    expect(golfDate(new Date('2026-07-18T08:59:00Z'))).toBe('2026-07-17') // 04:59 EDT
    expect(golfDate(new Date('2026-07-18T09:01:00Z'))).toBe('2026-07-18') // 05:01 EDT
  })

  it('handles DST — winter (EST = UTC-5, tee at 10:00 UTC)', () => {
    expect(golfDate(new Date('2026-01-15T09:59:00Z'))).toBe('2026-01-14') // 04:59 EST
    expect(golfDate(new Date('2026-01-15T10:01:00Z'))).toBe('2026-01-15') // 05:01 EST
  })

  it('counts down to the next tee', () => {
    expect(msToNextTee(new Date('2026-07-18T08:30:00Z'))).toBe(30 * 60_000) // 30 min to 5am EDT
    expect(msToNextTee(new Date('2026-07-18T09:00:00Z'))).toBe(24 * 3_600_000) // at 5am → full day
  })
})

describe('daily share (spoiler-free)', () => {
  const sample: DailyShare = {
    weekday: 6,
    par: 4,
    yards: 440,
    scoreToPar: -2,
    solved: true,
    streak: 2,
    toPar: -5,
  }

  it('round-trips through the URL query', () => {
    const parsed = parseDailyShare(new URLSearchParams(dailyShareQuery(sample)))
    expect(parsed).toEqual(sample)
  })

  it('derives strokes from par and score', () => {
    expect(shareStrokes(sample)).toBe(2) // par 4, -2 → 2 strokes
    expect(shareStrokes({ ...sample, solved: false })).toBe(6) // fail → double bogey
  })

  it('clamps hostile params', () => {
    const p = parseDailyShare(new URLSearchParams('wd=99&par=9&y=-5&sc=zzz&st=-1'))
    expect(p.weekday).toBeLessThanOrEqual(6)
    expect(p.par).toBeLessThanOrEqual(5)
    expect(p.yards).toBeGreaterThanOrEqual(50)
    expect(Number.isFinite(p.scoreToPar)).toBe(true)
    expect(p.streak).toBeGreaterThanOrEqual(0)
  })
})
