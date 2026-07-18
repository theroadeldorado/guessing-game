import { describe, expect, it } from 'vitest'
import { getPlayers, multipleChoiceOptions } from '@/lib/data'

describe('multipleChoiceOptions', () => {
  const golf = getPlayers('golf')
  const correct = golf.find((p) => p.era === '2010s–2020s')!.id // a well-populated era

  it('returns exactly `count` distinct options including the answer', () => {
    const opts = multipleChoiceOptions('golf', correct, 12, 'clip-1')
    expect(opts).toHaveLength(12)
    expect(new Set(opts.map((p) => p.id)).size).toBe(12)
    expect(opts.some((p) => p.id === correct)).toBe(true)
  })

  it('is deterministic for a given seed', () => {
    const a = multipleChoiceOptions('golf', correct, 12, 'clip-1')
    const b = multipleChoiceOptions('golf', correct, 12, 'clip-1')
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id))
  })

  it('prefers same-era distractors', () => {
    const era = golf.find((p) => p.id === correct)!.era
    const opts = multipleChoiceOptions('golf', correct, 12, 'clip-1').filter((p) => p.id !== correct)
    const sameEra = opts.filter((p) => p.era === era).length
    expect(sameEra).toBeGreaterThanOrEqual(6) // majority share the exact era
  })

  it('still fills the grid for a sparse era via decade fallback', () => {
    const sparse = golf.find((p) => p.era === '2000s')?.id
    if (sparse) {
      expect(multipleChoiceOptions('golf', sparse, 12, 'clip-x')).toHaveLength(12)
    }
  })
})
