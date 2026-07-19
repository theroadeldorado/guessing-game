import type { Clip, Player } from './types'
import { getPlayer, getPlayers, getPoolClips } from './data'
import { clipAlias } from './clipalias'
import { hashSeed, mulberry32, shuffle } from './rng'
import type { Named } from './search'

/**
 * Daily Round: one hole a day. Guesses = strokes; the selectable field halves
 * on each wrong guess. Par by weekday (Sun 3 / Wed 5 / else 4); you get par+1
 * guesses. Solve within budget (best case a bogey) or it's a double bogey and
 * the streak is over. All pure/deterministic so it unit-tests and every player
 * gets the same hole each day.
 */

/** The rotation's day zero (local). dayIndex counts whole days from here. */
export const EPOCH = '2026-07-18'

export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export type ScoreLabel =
  | 'Hole in One'
  | 'Albatross'
  | 'Eagle'
  | 'Birdie'
  | 'Par'
  | 'Bogey'
  | 'Double Bogey'

export interface DailyHole {
  date: string // YYYY-MM-DD
  weekday: number // 0=Sun..6=Sat
  par: number // 3 | 4 | 5
  yards: number
  clip: Clip
  budget: number // par + 1 guesses
}

export interface DailyState {
  hole: DailyHole
  guesses: string[] // player ids guessed, in order (all wrong until phase 'done')
  solved: boolean
  strokes: number // guesses used to solve (0 until solved)
  phase: 'guessing' | 'done'
}

// ---- dates ----------------------------------------------------------------

/** Local YYYY-MM-DD for a Date. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole days from `a` to `b` (both YYYY-MM-DD), computed in UTC to dodge DST. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export const isYesterday = (prev: string, today: string) => daysBetween(prev, today) === 1

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export const weekdayName = (dateStr: string): (typeof WEEKDAYS)[number] =>
  WEEKDAYS[weekdayOf(dateStr)]

// ---- the hole -------------------------------------------------------------

export function parForDate(dateStr: string): number {
  const wd = weekdayOf(dateStr)
  return wd === 0 ? 3 : wd === 3 ? 5 : 4 // Sun par 3, Wed par 5, else par 4
}

const YARD_BANDS: Record<number, [number, number]> = {
  3: [150, 240],
  4: [350, 470],
  5: [520, 610],
}

export function yardsForDate(dateStr: string, par: number): number {
  const [lo, hi] = YARD_BANDS[par] ?? [400, 460]
  const r = mulberry32(hashSeed(`yards:${dateStr}`))()
  return Math.round((lo + r * (hi - lo)) / 5) * 5 // nearest 5 yards
}

/**
 * The clip for a date: a non-repeating rotation. Each cycle is a full seeded
 * permutation of the pool, so every golfer is used once before any repeat.
 */
export function dailyClip(dateStr: string, pool: Clip[] = getPoolClips('golf')): Clip {
  const n = pool.length
  const idx = daysBetween(EPOCH, dateStr)
  const cycle = Math.floor(idx / n)
  const pos = ((idx % n) + n) % n // Euclidean, safe for dates before EPOCH
  return shuffle(pool, mulberry32(hashSeed(`cycle:${cycle}`)))[pos]
}

export function holeForDate(dateStr: string, pool?: Clip[]): DailyHole {
  const par = parForDate(dateStr)
  return {
    date: dateStr,
    weekday: weekdayOf(dateStr),
    par,
    yards: yardsForDate(dateStr, par),
    clip: dailyClip(dateStr, pool),
    budget: par + 1,
  }
}

export function startDaily(dateStr: string = dateKey(), pool?: Clip[]): DailyState {
  return { hole: holeForDate(dateStr, pool), guesses: [], solved: false, strokes: 0, phase: 'guessing' }
}

/** Rebuild today's state by replaying persisted guesses (survives a refresh). */
export function resumeDaily(dateStr: string, guesses: string[], pool?: Clip[]): DailyState {
  let state = startDaily(dateStr, pool)
  for (const id of guesses) {
    if (state.phase !== 'guessing') break
    state = submitDailyGuess(state, id)
  }
  return state
}

export function submitDailyGuess(state: DailyState, id: string): DailyState {
  if (state.phase !== 'guessing' || state.guesses.includes(id)) return state
  const guesses = [...state.guesses, id]
  if (id === state.hole.clip.playerId) {
    return { ...state, guesses, solved: true, strokes: guesses.length, phase: 'done' }
  }
  const done = guesses.length >= state.hole.budget
  return { ...state, guesses, phase: done ? 'done' : 'guessing' }
}

/**
 * The selectable golfers for the current guess; the field halved once per
 * wrong guess so far, always including the correct answer. Nested and stable
 * per hole (later fields are subsets of earlier ones). Membership only; the
 * search box re-sorts. Feed the result to GuessInput's `players` prop.
 */
export function narrowedField(state: DailyState, all: Player[]): Player[] {
  const correctId = state.hole.clip.playerId
  const correct = all.find((p) => p.id === correctId)
  if (!correct) return all
  const others = shuffle(
    all.filter((p) => p.id !== correctId),
    mulberry32(hashSeed(`field:${state.hole.date}`)),
  )
  let size = others.length
  for (let i = 0; i < state.guesses.length; i++) size = Math.max(1, Math.ceil(size / 2))
  return [correct, ...others.slice(0, size)]
}

// ---- scoring --------------------------------------------------------------

export function labelFor(solved: boolean, strokes: number, par: number): ScoreLabel {
  if (!solved) return 'Double Bogey'
  if (strokes === 1) return 'Hole in One'
  const rel = strokes - par
  if (rel <= -3) return 'Albatross'
  if (rel === -2) return 'Eagle'
  if (rel === -1) return 'Birdie'
  if (rel === 0) return 'Par'
  return 'Bogey'
}

/** Strokes−par. A missed hole is a double bogey (+2). */
export const scoreToPar = (state: DailyState): number =>
  state.solved ? state.strokes - state.hole.par : 2

export const scoreLabel = (state: DailyState): ScoreLabel =>
  labelFor(state.solved, state.solved ? state.strokes : state.hole.par + 2, state.hole.par)

// ---- streak progress (pure; storage.ts handles localStorage) --------------

export interface DailyResult {
  date: string
  par: number
  yards: number
  strokes: number
  solved: boolean
  scoreToPar: number
  player: string // the answer, revealed on the recap
}

export interface DailyProgress {
  lastDate: string // date of the last completed hole
  streak: number // holes made in a row (only successes count)
  toPar: number // cumulative strokes-to-par over those made holes
  alive: boolean // false once a hole is failed; next day starts a new streak
  lastResult: DailyResult
}

/** Fold a finished hole (already reduced to plain facts) into the streak. A
 *  miss ends the streak; a skipped day starts fresh even after a success. */
export function foldResult(
  prev: DailyProgress | null,
  today: string,
  r: Omit<DailyResult, 'date'>,
): DailyProgress {
  const continues = !!prev && prev.alive && isYesterday(prev.lastDate, today)
  const base = continues ? prev! : { streak: 0, toPar: 0 }
  return {
    lastDate: today,
    streak: r.solved ? base.streak + 1 : base.streak,
    toPar: r.solved ? base.toPar + r.scoreToPar : base.toPar,
    alive: r.solved,
    lastResult: { ...r, date: today },
  }
}

export function applyResult(
  prev: DailyProgress | null,
  today: string,
  state: DailyState,
): DailyProgress {
  return foldResult(prev, today, {
    par: state.hole.par,
    yards: state.hole.yards,
    strokes: state.solved ? state.strokes : state.hole.par + 2,
    solved: state.solved,
    scoreToPar: scoreToPar(state),
    player: getPlayer(state.hole.clip.playerId).name,
  })
}

// ---- server-side play (answer never reaches the client) -------------------

/** Guessable options for the current guess: slim {id,name}, narrowed field. */
function fieldFor(state: DailyState): Named[] {
  return narrowedField(state, getPlayers('golf')).map((p) => ({ id: p.id, name: p.name }))
}

/** Client-safe view of today's hole: everything to play EXCEPT the answer. */
export interface DailyHoleView {
  date: string
  weekday: number
  par: number
  yards: number
  budget: number
  video: string
  crop?: string
  field: Named[]
}

/**
 * Opaque per-day token for the daily video URL. Deliberately NOT the clip's
 * normal alias (which is in the bundled clips.json), so a bundle reader can't
 * map today's video back to the golfer. Resolved server-side in proxy.ts.
 */
export function dailyVideoToken(date: string): string {
  return clipAlias(`daily-v1:${date}`)
}

export function dailyHoleView(date: string = golfDate()): DailyHoleView {
  const state = startDaily(date)
  const h = state.hole
  return {
    date: h.date,
    weekday: h.weekday,
    par: h.par,
    yards: h.yards,
    budget: h.budget,
    video: `/c/daily/${dailyVideoToken(h.date)}.webm`,
    crop: h.clip.crop,
    field: fieldFor(state),
  }
}

/** Server-authoritative result for a guess history; the answer only appears
 *  once the hole is done (solved, or the budget is spent). */
export interface DailyGuessResult {
  phase: 'guessing' | 'done'
  solved: boolean
  guesses: number
  budget: number
  strokes: number
  scoreToPar: number
  par: number
  yards: number
  weekday: number
  field: Named[]
  answer?: string
}

export function dailyGuessResult(date: string, guesses: string[]): DailyGuessResult {
  const state = resumeDaily(date, guesses)
  const done = state.phase === 'done'
  return {
    phase: state.phase,
    solved: state.solved,
    guesses: state.guesses.length,
    budget: state.hole.budget,
    strokes: done ? (state.solved ? state.strokes : state.hole.par + 2) : state.guesses.length,
    scoreToPar: done ? scoreToPar(state) : 0,
    par: state.hole.par,
    yards: state.hole.yards,
    weekday: state.hole.weekday,
    field: done ? [] : fieldFor(state),
    answer: done ? getPlayer(state.hole.clip.playerId).name : undefined,
  }
}

// ---- tee time: the golf day flips at 5am US Eastern -----------------------

const TEE_HOUR = 5
const TZ = 'America/New_York'

/** Wall-clock components for `now` in US Eastern (DST-correct via Intl). */
function etParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const hour = get('hour')
  return { y: get('year'), mo: get('month'), d: get('day'), h: hour === 24 ? 0 : hour, mi: get('minute') }
}

/** Today's puzzle date: the ET date, shifted so the day flips at 5am ET, so
 *  everyone worldwide is on the same hole and it rolls over at the tee time. */
export function golfDate(now: Date = new Date()): string {
  const { y, mo, d, h } = etParts(now)
  const shifted = new Date(Date.UTC(y, mo - 1, d, h - TEE_HOUR)) // <5am ET → previous day
  const p = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`
}

/** Milliseconds until the next 5am ET tee time. */
export function msToNextTee(now: Date = new Date()): number {
  const { y, mo, d, h, mi } = etParts(now)
  const nowWall = Date.UTC(y, mo - 1, d, h, mi)
  let next = Date.UTC(y, mo - 1, d, TEE_HOUR, 0)
  if (nowWall >= next) next = Date.UTC(y, mo - 1, d + 1, TEE_HOUR, 0)
  return next - nowWall
}

/** "13h 9m" until the next tee time. */
export function teeCountdown(now: Date = new Date()): string {
  const ms = Math.max(0, msToNextTee(now))
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

// ---- sharing (spoiler-free, never leaks the day's answer) -----------------

export interface DailyShare {
  weekday: number
  par: number
  yards: number
  scoreToPar: number // the hole's score to par
  solved: boolean
  streak: number
  toPar: number // cumulative streak score to par
}

const SCORE_EMOJI: Record<ScoreLabel, string> = {
  'Hole in One': '🕳️',
  Albatross: '🦅',
  Eagle: '🦅',
  Birdie: '🐦',
  Par: '⛳',
  Bogey: '😬',
  'Double Bogey': '💀',
}

export const toParText = (toPar: number): string =>
  toPar === 0 ? 'even' : toPar < 0 ? `${-toPar} under` : `${toPar} over`

export function toDailyShare(p: DailyProgress): DailyShare {
  const r = p.lastResult
  return {
    weekday: weekdayOf(r.date),
    par: r.par,
    yards: r.yards,
    scoreToPar: r.scoreToPar,
    solved: r.solved,
    streak: p.streak,
    toPar: p.toPar,
  }
}

export function dailyShareQuery(s: DailyShare): string {
  return new URLSearchParams({
    d: '1',
    wd: String(s.weekday),
    par: String(s.par),
    y: String(s.yards),
    sc: String(s.scoreToPar),
    sv: s.solved ? '1' : '0',
    st: String(s.streak),
    tp: String(s.toPar),
  }).toString()
}

export function parseDailyShare(p: URLSearchParams): DailyShare {
  const int = (k: string, def: number, min: number, max: number) => {
    const n = Math.trunc(Number(p.get(k)))
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
  }
  return {
    weekday: int('wd', 6, 0, 6),
    par: int('par', 4, 3, 5),
    yards: int('y', 400, 50, 900),
    scoreToPar: int('sc', 0, -5, 9),
    solved: p.get('sv') === '1',
    streak: int('st', 0, 0, 99999),
    toPar: int('tp', 0, -99999, 99999),
  }
}

/** The strokes a share implies, for label + scorecard mark. */
export const shareStrokes = (s: DailyShare): number =>
  s.solved ? s.par + s.scoreToPar : s.par + 2

/** Challenge copy for the native share sheet, no answer ever. */
export function dailyShareText(s: DailyShare): string {
  const label = labelFor(s.solved, shareStrokes(s), s.par)
  const emoji = SCORE_EMOJI[label] ?? '⛳'
  const day = WEEKDAYS[((s.weekday % 7) + 7) % 7]
  return [
    `ShadowForm Daily: ${label} ${emoji} on today's ${day} par ${s.par}`,
    `Streak ${s.streak} · ${toParText(s.toPar)}`,
    'Keep your streak alive:',
  ].join('\n')
}
