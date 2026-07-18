import type { DailyProgress } from './daily'

const bestKey = (sportId: string) => `shadowform:best:${sportId}`

export function loadBest(sportId: string): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(bestKey(sportId))
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function recordScore(sportId: string, score: number): number {
  const best = Math.max(loadBest(sportId), score)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(bestKey(sportId), String(best))
  }
  return best
}

const dailyKey = (sportId: string) => `shadowform:daily:${sportId}`

export function loadDaily(sportId: string): DailyProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(dailyKey(sportId))
    return raw ? (JSON.parse(raw) as DailyProgress) : null
  } catch {
    return null
  }
}

export function saveDaily(sportId: string, progress: DailyProgress): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(dailyKey(sportId), JSON.stringify(progress))
  }
}

/** In-progress guesses for today's hole, so a refresh can't reset the budget. */
export interface DailyActive {
  date: string
  guesses: string[]
}

const dailyActiveKey = (sportId: string) => `shadowform:daily-active:${sportId}`

export function loadDailyActive(sportId: string): DailyActive | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(dailyActiveKey(sportId))
    return raw ? (JSON.parse(raw) as DailyActive) : null
  } catch {
    return null
  }
}

export function saveDailyActive(sportId: string, active: DailyActive): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(dailyActiveKey(sportId), JSON.stringify(active))
  }
}

export function clearDailyActive(sportId: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(dailyActiveKey(sportId))
  }
}
