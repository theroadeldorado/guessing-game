const BEST_KEY = 'shadowform:best'

export function loadBest(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(BEST_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function recordScore(score: number): number {
  const best = Math.max(loadBest(), score)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BEST_KEY, String(best))
  }
  return best
}
