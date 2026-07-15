import type { Player } from './types'

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function isSubsequence(query: string, target: string): boolean {
  let qi = 0
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++
  }
  return qi === query.length
}

function score(query: string, name: string): number {
  const q = query.replace(/\s+/g, ' ').trim()
  const full = normalize(name)
  const squashedFull = full.replace(/[\s.'-]/g, '')
  const squashedQuery = q.replace(/[\s.'-]/g, '')
  if (full.startsWith(q) || squashedFull.startsWith(squashedQuery)) return 100
  if (full.split(' ').some((w) => w.startsWith(q))) return 80
  if (squashedFull.includes(squashedQuery)) return 60
  if (isSubsequence(squashedQuery, squashedFull)) return 30
  return -1
}

export function searchPlayers(players: Player[], query: string, limit = 8): Player[] {
  const q = normalize(query).trim()
  if (!q) return []
  return players
    .map((p) => ({ p, s: score(q, p.name) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p)
}
