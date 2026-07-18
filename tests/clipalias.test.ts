import { describe, expect, it } from 'vitest'
import { clipAlias } from '@/lib/clipalias'
import { getPoolClips } from '@/lib/data'

describe('clipAlias', () => {
  it('is deterministic and never contains the player name', () => {
    expect(clipAlias('tiger-woods-01')).toBe(clipAlias('tiger-woods-01'))
    expect(clipAlias('tiger-woods-01')).not.toContain('tiger')
    expect(clipAlias('tiger-woods-01')).not.toContain('woods')
  })

  it('differs per id and never collides across the pool', () => {
    const ids = getPoolClips('golf').map((c) => c.id)
    const aliases = ids.map(clipAlias)
    expect(new Set(aliases).size).toBe(ids.length)
  })
})
