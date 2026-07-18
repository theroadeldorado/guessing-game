import type { ClipResult, RunState } from './game'

/** Canonical site URL (the www apex redirects here, so OG/share URLs point
 *  straight at it — no redirect for social scrapers to choke on). Override with
 *  NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.shadowformgame.com'
).replace(/\/+$/, '')
/** Bare host for display on the card — drops protocol and a leading www. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/^www\./, '')

/**
 * A finished run, packed compactly enough to live in a share URL (no database).
 * `results` is one digit per clip: 0 = missed, 1/2/3 = guesses used to solve.
 */
export interface ShareData {
  sport: string
  score: number
  solved: number
  results: string
}

export type Outcome = 'ace' | 'good' | 'squeak' | 'miss'

const digitFor = (r: ClipResult): string => (!r.solved ? '0' : String(r.guessesUsed))

export const outcomeOf = (digit: string): Outcome =>
  digit === '1' ? 'ace' : digit === '2' ? 'good' : digit === '3' ? 'squeak' : 'miss'

export const OUTCOME_EMOJI: Record<Outcome, string> = {
  ace: '💯',
  good: '🎯',
  squeak: '🤏',
  miss: '💀',
}

export const resultsEmoji = (results: string): string =>
  [...results].map((d) => OUTCOME_EMOJI[outcomeOf(d)]).join('')

export function toShareData(state: RunState, sportId: string): ShareData {
  return {
    sport: sportId,
    score: state.score,
    solved: state.history.filter((r) => r.solved).length,
    results: state.history.map(digitFor).join(''),
  }
}

/** Query string for a share URL: `?g=golf&s=45&n=5&r=13230`. */
export function shareQuery(d: ShareData): string {
  return new URLSearchParams({
    g: d.sport,
    s: String(d.score),
    n: String(d.solved),
    r: d.results,
  }).toString()
}

/** Parse + hard-clamp share params (they come from an untrusted URL). */
export function parseShareData(sp: URLSearchParams): ShareData {
  const int = (v: string | null, max: number) => {
    const n = Math.trunc(Number(v))
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0
  }
  return {
    sport: (sp.get('g') || 'golf').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'golf',
    score: int(sp.get('s'), 99999),
    solved: int(sp.get('n'), 999),
    results: (sp.get('r') || '').replace(/[^0-3]/g, '').slice(0, 240),
  }
}

export interface ShareSportMeta {
  emoji: string
  athleteNoun: string
  athleteNounPlural: string
}

/** Challenge-framed message for the native share sheet / clipboard. */
export function shareText(d: ShareData, sport: ShareSportMeta): string {
  const noun = d.solved === 1 ? sport.athleteNoun : sport.athleteNounPlural
  const streak = resultsEmoji(d.results)
  return [
    `I ID'd ${d.solved} ${noun.toLowerCase()} for ${d.score} pts on ShadowForm ${sport.emoji}`,
    streak,
    'Think you can beat my run?',
  ].join('\n')
}
