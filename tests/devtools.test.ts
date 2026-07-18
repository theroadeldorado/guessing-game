import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import { ensurePoolPlayer, setClipCrop, setClipSrc } from '@/lib/devtools'

// clips.json has a row only for has-row-01. no-row-01 exists in the manifest
// but was never seeded into clips.json — the real-world cause of the 500s.
const CLIPS = [{ id: 'has-row-01', playerId: 'has-row', src: '/clips/has-row-01.webm' }]
const MANIFEST = [
  { id: 'has-row-01', playerId: 'has-row', source: '', start: '', end: '', crop: 'auto' },
  { id: 'no-row-01', playerId: 'benched', source: '', start: '', end: '', crop: 'auto' },
  { id: 'orphan-01', playerId: 'ghost', source: '', start: '', end: '', crop: 'auto' },
]
const PLAYERS = [
  { id: 'has-row', name: 'Has Row', sportId: 'golf', inPool: true },
  { id: 'benched', name: 'Benched', sportId: 'golf', inPool: false },
]

let clipsOut: Array<Record<string, unknown>> | null
let playersOut: Array<Record<string, unknown>> | null

beforeEach(() => {
  clipsOut = null
  playersOut = null
  vi.spyOn(fs, 'readdirSync').mockReturnValue(['manifest.golf.json'] as never)
  vi.spyOn(fs, 'existsSync').mockReturnValue(true) // pretend the webm exists
  vi.spyOn(fs, 'readFileSync').mockImplementation((p) => {
    const s = String(p)
    if (s.endsWith('clips.json')) return JSON.stringify(clipsOut ?? CLIPS)
    if (s.endsWith('players.json')) return JSON.stringify(playersOut ?? PLAYERS)
    if (s.includes('manifest.')) return JSON.stringify(MANIFEST)
    throw new Error(`unexpected read: ${s}`)
  })
  vi.spyOn(fs, 'writeFileSync').mockImplementation((p, data) => {
    const parsed = JSON.parse(String(data))
    if (String(p).endsWith('players.json')) playersOut = parsed
    else clipsOut = parsed
  })
})

afterEach(() => vi.restoreAllMocks())

describe('setClip* on a clip with no clips.json row', () => {
  it('setClipCrop is a no-op (no throw, no row created)', () => {
    expect(() => setClipCrop('no-row-01', '0.5,0.4,2')).not.toThrow()
    expect(clipsOut).toBeNull() // never written
  })

  it('setClipSrc creates the row when pointing at a real webm', () => {
    const src = setClipSrc('no-row-01', true)
    expect(src).toBe('/clips/no-row-01.webm')
    expect(clipsOut?.find((c) => c.id === 'no-row-01')).toMatchObject({
      id: 'no-row-01',
      playerId: 'benched',
      src: '/clips/no-row-01.webm',
    })
  })

  it('setClipSrc placeholder on a rowless clip persists nothing', () => {
    const src = setClipSrc('no-row-01', false)
    expect(src).toBe('placeholder')
    expect(clipsOut).toBeNull()
  })
})

describe('ensurePoolPlayer', () => {
  it('promotes a benched player into the pool', () => {
    ensurePoolPlayer('no-row-01') // playerId "benched", inPool:false
    expect(playersOut?.find((p) => p.id === 'benched')).toMatchObject({ inPool: true })
  })

  it('leaves an already-in-pool player untouched (no write)', () => {
    ensurePoolPlayer('has-row-01')
    expect(playersOut).toBeNull()
  })

  it('throws when the player does not exist in players.json', () => {
    expect(() => ensurePoolPlayer('orphan-01')).toThrow(/No player 'ghost'/)
  })
})
