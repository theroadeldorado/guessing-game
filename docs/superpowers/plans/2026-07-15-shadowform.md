# ShadowForm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ShadowForm — an endless score-attack web game where players identify NFL QBs from looping silhouette clips — plus the local Python pipeline that produces those silhouette clips.

**Architecture:** Two independent halves in one repo. The Next.js app (repo root) is fully client-side, deployed to Vercel, and consumes only static JSON data + video assets. The `pipeline/` directory holds local-only Python/ffmpeg tooling (yt-dlp → trim → Robust Video Matting → silhouette WebM/MP4) that writes finished clips into `public/clips/`. Until real clips exist, a deterministic animated-SVG placeholder renders wherever a clip's `src` is `"placeholder"`, so the game is fully playable end-to-end from day one.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), Vitest for unit tests, Python 3.12 + PyTorch (Robust Video Matting) + ffmpeg + yt-dlp for the pipeline.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-shadowform-design.md` — rules are locked: 3 guesses (100/50/25 pts), hint 1 = era after first wrong guess, hint 2 = teams after second, third miss ends the run.
- Name everywhere: **ShadowForm**. localStorage key prefix: `shadowform:`.
- Data model is sport-agnostic (`sportId` on players; sports.json exists from day one).
- No backend: no API routes, no env vars, no database in v1.
- Node 22 locally; app must pass `npm run build` (Vercel deploy target).
- Guesses are only submittable by selecting from autocomplete — no free-text submission.
- Game logic and search are pure functions in `src/lib/`, unit-tested with Vitest. UI components are not unit-tested in v1 (manual + build verification).
- Commit after every task (at minimum).

## File Structure

```
guessing-game/
├── docs/superpowers/...                # specs & plans (exists)
├── pipeline/                           # local-only, never deployed
│   ├── README.md                       # setup + workflow for John
│   ├── requirements.txt
│   ├── manifest.json                   # one entry per clip (source URLs filled in later)
│   └── process.py                      # yt-dlp → trim → RVM → silhouette webm/mp4/poster
├── public/clips/                       # pipeline output (gitignored except .gitkeep)
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # metadata, fonts, shell
│   │   ├── page.tsx                    # renders <Game/>
│   │   └── globals.css
│   ├── components/
│   │   ├── Game.tsx                    # run-state container, wires everything
│   │   ├── ClipPlayer.tsx              # <video> loop OR placeholder SVG
│   │   ├── PlaceholderSilhouette.tsx   # animated SVG figure, seeded by playerId
│   │   ├── GuessInput.tsx              # autocomplete combobox
│   │   ├── HintChips.tsx               # era / teams reveals
│   │   ├── RevealCard.tsx              # answer reveal + next/continue
│   │   └── GameOver.tsx                # score, best, share, play again
│   ├── data/
│   │   ├── sports.json
│   │   ├── players.json                # all QBs (autocomplete); ~50 inPool:true
│   │   └── clips.json                  # one per inPool player; src:"placeholder" until pipeline runs
│   └── lib/
│       ├── types.ts
│       ├── game.ts                     # createRun / submitGuess / advance / shareText
│       ├── search.ts                   # normalize / searchPlayers
│       ├── storage.ts                  # best-score localStorage
│       └── data.ts                     # typed accessors over the JSON
├── tests/
│   ├── game.test.ts
│   ├── search.test.ts
│   └── data.test.ts                    # referential-integrity checks on the JSON
├── vitest.config.ts
└── (create-next-app files: package.json, tsconfig.json, next.config.ts, ...)
```

---

### Task 1: Scaffold Next.js app + Vitest

**Files:**
- Create: entire Next.js scaffold at repo root (create-next-app)
- Create: `vitest.config.ts`
- Modify: `package.json` (test script), `.gitignore` (pipeline artifacts)

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm test` commands; `@/` path alias to `src/`.

- [ ] **Step 1: Scaffold.** create-next-app refuses non-empty dirs only if files conflict; `docs/` and `.git` are fine.

```bash
cd /Users/john/Apps/guessing-game
npx --yes create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
```

If it complains about the non-empty directory, scaffold into a temp dir and move contents:

```bash
npx --yes create-next-app@latest /tmp/claude/sf --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rsync -a /tmp/claude/sf/ /Users/john/Apps/guessing-game/ --exclude .git
```

- [ ] **Step 2: Install Vitest and create config.**

```bash
npm install -D vitest
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Gitignore pipeline artifacts.** Append to `.gitignore`:

```
# pipeline artifacts
pipeline/cache/
pipeline/.venv/
public/clips/*
!public/clips/.gitkeep
```

Create `public/clips/.gitkeep` (empty file).

- [ ] **Step 4: Verify.** `npm run build` → succeeds. `npm test` → "No test files found" is acceptable at this point (exit 1 is fine; note it).

- [ ] **Step 5: Commit.** `git add -A && git commit -m "chore: scaffold Next.js app with Vitest"`

---

### Task 2: Types + game data (players/sports/clips) + integrity tests

**Files:**
- Create: `src/lib/types.ts`, `src/lib/data.ts`
- Create: `src/data/sports.json`, `src/data/players.json`, `src/data/clips.json`
- Test: `tests/data.test.ts`

**Interfaces:**
- Produces: `Sport`, `Player`, `Clip` types; `getPlayers(): Player[]`, `getPoolClips(): Clip[]`, `getPlayer(id: string): Player` from `@/lib/data`.

- [ ] **Step 1: Types.**

```ts
// src/lib/types.ts
export interface Sport {
  id: string
  label: string
}

export interface Player {
  id: string          // kebab-case, e.g. "dan-marino"
  name: string        // display name, e.g. "Dan Marino"
  sportId: string     // "nfl-qb"
  era: string         // hint 1, e.g. "1980s–1990s"
  teams: string[]     // hint 2, primary teams, e.g. ["Dolphins"]
  yearsActive: string // reveal card, e.g. "1983–1999"
  inPool: boolean     // true = has a clip, eligible as an answer
}

export interface Clip {
  id: string          // e.g. "dan-marino-01"
  playerId: string
  src: string         // "/clips/<id>.webm" or "placeholder"
}
```

- [ ] **Step 2: sports.json.**

```json
[{ "id": "nfl-qb", "label": "NFL Quarterbacks" }]
```

- [ ] **Step 3: players.json.** Write from football knowledge (no API). Schema per entry:

```json
{
  "id": "dan-marino",
  "name": "Dan Marino",
  "sportId": "nfl-qb",
  "era": "1980s–1990s",
  "teams": ["Dolphins"],
  "yearsActive": "1983–1999",
  "inPool": true
}
```

**In-pool (50, spanning eras — icons + solid starters):** Johnny Unitas, Bart Starr, Joe Namath, Roger Staubach, Terry Bradshaw, Fran Tarkenton, Ken Stabler, Dan Fouts, Archie Manning, Joe Montana, Dan Marino, John Elway, Jim Kelly, Warren Moon, Boomer Esiason, Randall Cunningham, Phil Simms, Steve Young, Troy Aikman, Brett Favre, Kurt Warner, Peyton Manning, Tom Brady, Drew Brees, Donovan McNabb, Michael Vick, Steve McNair, Ben Roethlisberger, Eli Manning, Philip Rivers, Tony Romo, Aaron Rodgers, Matt Ryan, Cam Newton, Russell Wilson, Andrew Luck, Matthew Stafford, Colin Kaepernick, Kirk Cousins, Dak Prescott, Patrick Mahomes, Josh Allen, Lamar Jackson, Baker Mayfield, Kyler Murray, Joe Burrow, Justin Herbert, Jalen Hurts, Tua Tagovailoa, Brock Purdy.

**Autocomplete-only (`inPool: false`, ~55 more so guesses rarely miss):** Otto Graham, Y.A. Tittle, Sonny Jurgensen, Len Dawson, Bob Griese, Jim Plunkett, Bert Jones, Doug Williams, Jim McMahon, Bernie Kosar, Vinny Testaverde, Ken Anderson, Rich Gannon, Doug Flutie, Mark Brunell, Drew Bledsoe, Kerry Collins, Trent Green, Jake Plummer, Daunte Culpepper, Jeff Garcia, Matt Hasselbeck, Chad Pennington, Marc Bulger, Jake Delhomme, Byron Leftwich, David Carr, Carson Palmer, Alex Smith, Jay Cutler, Ryan Fitzpatrick, Mark Sanchez, Matt Schaub, Andy Dalton, Nick Foles, Teddy Bridgewater, Ryan Tannehill, Blake Bortles, Jameis Winston, Marcus Mariota, Jared Goff, Deshaun Watson, Sam Darnold, Josh McCown, Case Keenum, Geno Smith, Derek Carr, Jordan Love, Justin Fields, Mac Jones, Trevor Lawrence, Zach Wilson, Bryce Young, C.J. Stroud, Anthony Richardson, Will Levis, Bo Nix, Drake Maye, Jayden Daniels, Caleb Williams, Michael Penix Jr., J.J. McCarthy, Robert Griffin III.

Era format: decade span of the player's starting career (e.g. "2010s–2020s"). Teams: primary team(s) only, franchise nickname without city (e.g. `["Colts", "Broncos"]` for Peyton). yearsActive: first–last NFL season ("2017–" style for active players, using 2026 knowledge).

- [ ] **Step 4: clips.json.** One entry per in-pool player, all placeholder for now:

```json
[
  { "id": "johnny-unitas-01", "playerId": "johnny-unitas", "src": "placeholder" },
  { "id": "bart-starr-01", "playerId": "bart-starr", "src": "placeholder" }
]
```

…and so on for all 50 in-pool players (`<player-id>-01` convention).

- [ ] **Step 5: Data accessors.**

```ts
// src/lib/data.ts
import type { Clip, Player, Sport } from './types'
import sportsJson from '@/data/sports.json'
import playersJson from '@/data/players.json'
import clipsJson from '@/data/clips.json'

export function getSports(): Sport[] {
  return sportsJson as Sport[]
}

export function getPlayers(): Player[] {
  return playersJson as Player[]
}

export function getPlayer(id: string): Player {
  const p = getPlayers().find((p) => p.id === id)
  if (!p) throw new Error(`Unknown player: ${id}`)
  return p
}

export function getPoolClips(): Clip[] {
  return clipsJson as Clip[]
}
```

Ensure `tsconfig.json` has `"resolveJsonModule": true` (create-next-app default includes it).

- [ ] **Step 6: Write integrity tests.**

```ts
// tests/data.test.ts
import { describe, expect, it } from 'vitest'
import { getPlayers, getPoolClips } from '@/lib/data'

describe('data integrity', () => {
  const players = getPlayers()
  const clips = getPoolClips()
  const playerIds = new Set(players.map((p) => p.id))

  it('has ~50 in-pool players and a larger autocomplete list', () => {
    const pool = players.filter((p) => p.inPool)
    expect(pool.length).toBeGreaterThanOrEqual(45)
    expect(players.length).toBeGreaterThan(pool.length)
  })

  it('every clip references an existing in-pool player', () => {
    for (const clip of clips) {
      expect(playerIds.has(clip.playerId), `clip ${clip.id}`).toBe(true)
      const player = players.find((p) => p.id === clip.playerId)!
      expect(player.inPool, `${clip.playerId} must be inPool`).toBe(true)
    }
  })

  it('every in-pool player has at least one clip', () => {
    const clipPlayerIds = new Set(clips.map((c) => c.playerId))
    for (const p of players.filter((p) => p.inPool)) {
      expect(clipPlayerIds.has(p.id), `${p.id} missing clip`).toBe(true)
    }
  })

  it('player ids are unique and kebab-case', () => {
    expect(playerIds.size).toBe(players.length)
    for (const p of players) expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('every player has era, teams, and yearsActive', () => {
    for (const p of players) {
      expect(p.era.length, p.id).toBeGreaterThan(0)
      expect(p.teams.length, p.id).toBeGreaterThan(0)
      expect(p.yearsActive.length, p.id).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 7: Run.** `npm test` → all data tests PASS. Fix data until they do.

- [ ] **Step 8: Commit.** `git commit -m "feat: sport-agnostic data model with full QB dataset"`

---

### Task 3: Game engine (TDD)

**Files:**
- Create: `src/lib/game.ts`
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: `Clip` from `@/lib/types`.
- Produces (used by Game.tsx in Task 6):
  - `POINTS: readonly [100, 50, 25]`, `MAX_GUESSES = 3`
  - `createRun(clips: Clip[], rng?: () => number): RunState`
  - `currentClip(state: RunState): Clip`
  - `submitGuess(state: RunState, playerId: string): RunState`
  - `advance(state: RunState): RunState`
  - `hintLevel(state: RunState): number` — 0, 1, or 2
  - `shareText(state: RunState): string`
  - `RunState`, `ClipResult`, `Phase` types

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/game.test.ts
import { describe, expect, it } from 'vitest'
import {
  createRun, currentClip, submitGuess, advance, hintLevel, shareText,
  POINTS, MAX_GUESSES, type RunState,
} from '@/lib/game'
import type { Clip } from '@/lib/types'

const clips: Clip[] = [
  { id: 'a-01', playerId: 'a', src: 'placeholder' },
  { id: 'b-01', playerId: 'b', src: 'placeholder' },
  { id: 'c-01', playerId: 'c', src: 'placeholder' },
]

// rng() = 0 makes Fisher–Yates a no-op-ish deterministic order
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
```

- [ ] **Step 2: Run to verify failure.** `npm test -- tests/game.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement.**

```ts
// src/lib/game.ts
import type { Clip } from './types'

export const POINTS = [100, 50, 25] as const
export const MAX_GUESSES = 3

export type Phase = 'guessing' | 'reveal' | 'over'

export interface ClipResult {
  clipId: string
  playerId: string
  guessesUsed: number
  points: number
  solved: boolean
}

export interface RunState {
  clipOrder: Clip[]
  index: number
  wrongGuesses: string[] // player ids guessed wrong on the current clip
  score: number
  history: ClipResult[]
  phase: Phase
}

export function createRun(clips: Clip[], rng: () => number = Math.random): RunState {
  const order = [...clips]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { clipOrder: order, index: 0, wrongGuesses: [], score: 0, history: [], phase: 'guessing' }
}

export function currentClip(state: RunState): Clip {
  return state.clipOrder[state.index]
}

export function hintLevel(state: RunState): number {
  return state.wrongGuesses.length
}

export function submitGuess(state: RunState, playerId: string): RunState {
  if (state.phase !== 'guessing') return state
  if (state.wrongGuesses.includes(playerId)) return state

  const clip = currentClip(state)
  const guessesUsed = state.wrongGuesses.length + 1

  if (playerId === clip.playerId) {
    const points = POINTS[state.wrongGuesses.length]
    return {
      ...state,
      score: state.score + points,
      history: [...state.history, { clipId: clip.id, playerId: clip.playerId, guessesUsed, points, solved: true }],
      phase: 'reveal',
    }
  }

  const wrongGuesses = [...state.wrongGuesses, playerId]
  if (wrongGuesses.length >= MAX_GUESSES) {
    return {
      ...state,
      wrongGuesses,
      history: [...state.history, { clipId: clip.id, playerId: clip.playerId, guessesUsed, points: 0, solved: false }],
      phase: 'reveal',
    }
  }
  return { ...state, wrongGuesses }
}

export function advance(state: RunState): RunState {
  if (state.phase !== 'reveal') return state
  const last = state.history[state.history.length - 1]
  if (!last.solved || state.index + 1 >= state.clipOrder.length) {
    return { ...state, phase: 'over' }
  }
  return { ...state, index: state.index + 1, wrongGuesses: [], phase: 'guessing' }
}

const RESULT_EMOJI = (r: ClipResult): string =>
  !r.solved ? '💀' : r.guessesUsed === 1 ? '💯' : r.guessesUsed === 2 ? '🎯' : '🤏'

export function shareText(state: RunState): string {
  const solved = state.history.filter((r) => r.solved).length
  const emoji = state.history.map(RESULT_EMOJI).join('')
  return `🏈 ShadowForm — ${state.score} pts, ${solved} QBs\n${emoji}`
}
```

- [ ] **Step 4: Run tests.** `npm test -- tests/game.test.ts` → all PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat: game engine with weighted scoring, hints, and share text"`

---

### Task 4: Fuzzy autocomplete search (TDD)

**Files:**
- Create: `src/lib/search.ts`
- Test: `tests/search.test.ts`

**Interfaces:**
- Consumes: `Player` from `@/lib/types`.
- Produces: `searchPlayers(players: Player[], query: string, limit?: number): Player[]` (default limit 8), `normalize(s: string): string`.

- [ ] **Step 1: Write the failing tests.**

```ts
// tests/search.test.ts
import { describe, expect, it } from 'vitest'
import { normalize, searchPlayers } from '@/lib/search'
import type { Player } from '@/lib/types'

const P = (id: string, name: string): Player => ({
  id, name, sportId: 'nfl-qb', era: 'x', teams: ['X'], yearsActive: 'x', inPool: true,
})

const players = [
  P('dan-marino', 'Dan Marino'),
  P('peyton-manning', 'Peyton Manning'),
  P('eli-manning', 'Eli Manning'),
  P('patrick-mahomes', 'Patrick Mahomes'),
  P('tom-brady', 'Tom Brady'),
]

describe('normalize', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalize('Dàn Márino')).toBe('dan marino')
  })
})

describe('searchPlayers', () => {
  it('returns empty for empty query', () => {
    expect(searchPlayers(players, '')).toEqual([])
    expect(searchPlayers(players, '  ')).toEqual([])
  })

  it('matches word prefixes: "man" finds both Mannings before Mahomes', () => {
    const names = searchPlayers(players, 'man').map((p) => p.name)
    expect(names.slice(0, 2).sort()).toEqual(['Eli Manning', 'Peyton Manning'])
  })

  it('matches full-name prefix highest: "pey" → Peyton first', () => {
    expect(searchPlayers(players, 'pey')[0].name).toBe('Peyton Manning')
  })

  it('tolerates missing letters via subsequence: "mhomes" finds Mahomes', () => {
    expect(searchPlayers(players, 'mhomes').map((p) => p.name)).toContain('Patrick Mahomes')
  })

  it('matches across word boundary: "danmar" finds Dan Marino', () => {
    expect(searchPlayers(players, 'danmar')[0].name).toBe('Dan Marino')
  })

  it('respects limit', () => {
    expect(searchPlayers(players, 'a', 2)).toHaveLength(2)
  })

  it('returns nothing for garbage', () => {
    expect(searchPlayers(players, 'zzzz')).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure.** `npm test -- tests/search.test.ts` → FAIL.

- [ ] **Step 3: Implement.**

```ts
// src/lib/search.ts
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
```

- [ ] **Step 4: Run tests.** `npm test` → all PASS (data + game + search).

- [ ] **Step 5: Commit.** `git commit -m "feat: typo-tolerant fuzzy player search"`

---

### Task 5: Best-score storage helper

**Files:**
- Create: `src/lib/storage.ts`

**Interfaces:**
- Produces: `loadBest(): number`, `recordScore(score: number): number` (persists and returns the new best). SSR-safe: both no-op to 0/score when `window` is undefined.

- [ ] **Step 1: Implement** (thin browser-API wrapper; covered by build + manual verification, not unit tests, per Global Constraints).

```ts
// src/lib/storage.ts
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
```

- [ ] **Step 2: Commit** (fold into Task 6's commit if preferred, otherwise `git commit -m "feat: best-score persistence"`).

---

### Task 6: Game UI

**Files:**
- Create: `src/components/Game.tsx`, `ClipPlayer.tssx→tsx`, `PlaceholderSilhouette.tsx`, `GuessInput.tsx`, `HintChips.tsx`, `RevealCard.tsx`, `GameOver.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: everything from Tasks 2–5 (`createRun`, `submitGuess`, `advance`, `hintLevel`, `currentClip`, `shareText`, `searchPlayers`, `getPlayers`, `getPoolClips`, `getPlayer`, `loadBest`, `recordScore`).
- Produces: a playable game at `/`.

**Note:** invoke the `frontend-design:frontend-design` skill before building these components — the code below defines structure and behavior; visual direction (typography, palette, motion) is set at execution time. Behavioral requirements below are binding; class names are indicative.

- [ ] **Step 1: PlaceholderSilhouette.** Deterministic animated SVG figure (black on light) seeded by `playerId` — hash the id to vary animation duration/arm angle so different players look subtly different in dev. Used whenever `clip.src === 'placeholder'`.

```tsx
// src/components/PlaceholderSilhouette.tsx
'use client'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function PlaceholderSilhouette({ seed }: { seed: string }) {
  const h = hash(seed)
  const dur = 1.2 + (h % 5) * 0.2 // 1.2s–2.0s throw cycle
  const lean = -4 - (h % 7)       // torso lean varies per player
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-label="Silhouette clip placeholder">
      <g fill="currentColor" transform={`rotate(${lean} 100 120)`}>
        <circle cx="100" cy="48" r="16" />
        <rect x="86" y="62" width="28" height="55" rx="10" />
        {/* back leg */}
        <rect x="84" y="112" width="11" height="52" rx="5" transform="rotate(18 90 112)" />
        {/* front leg */}
        <rect x="103" y="112" width="11" height="52" rx="5" transform="rotate(-12 108 112)" />
        {/* off arm */}
        <rect x="76" y="66" width="10" height="40" rx="5" transform="rotate(35 81 66)" />
        {/* throwing arm */}
        <g style={{ transformOrigin: '108px 70px', animation: `sf-throw ${dur}s ease-in-out infinite` }}>
          <rect x="104" y="62" width="10" height="44" rx="5" />
          <ellipse cx="112" cy="110" rx="9" ry="6" />
        </g>
      </g>
    </svg>
  )
}
```

Add to `globals.css`:

```css
@keyframes sf-throw {
  0%, 100% { transform: rotate(150deg); }
  45% { transform: rotate(150deg); }
  70% { transform: rotate(-40deg); }
  85% { transform: rotate(-60deg); }
}
```

- [ ] **Step 2: ClipPlayer.** Requirements: loops muted autoplaying video for real clips; placeholder SVG otherwise; respects `prefers-reduced-motion` (poster + explicit play button); exposes `preloadSrc` prop — renders a hidden `<link rel="preload" as="video">`-style prefetch (implement as a hidden muted `<video preload="auto">`) for the next clip.

```tsx
// src/components/ClipPlayer.tsx
'use client'

import { useEffect, useState } from 'react'
import PlaceholderSilhouette from './PlaceholderSilhouette'

export default function ClipPlayer({ src, seed, preloadSrc }: {
  src: string
  seed: string
  preloadSrc?: string
}) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [playAnyway, setPlayAnyway] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isVideo = src !== 'placeholder'
  const paused = reducedMotion && !playAnyway

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
      {isVideo ? (
        <video
          key={src}
          src={src}
          className="h-full w-full object-cover"
          autoPlay={!paused}
          loop
          muted
          playsInline
        />
      ) : (
        <div className={paused ? 'h-full w-full [&_*]:!animate-none' : 'h-full w-full'}>
          <PlaceholderSilhouette seed={seed} />
        </div>
      )}
      {paused && (
        <button
          onClick={() => setPlayAnyway(true)}
          className="absolute inset-0 grid place-items-center"
          aria-label="Play clip"
        >
          ▶
        </button>
      )}
      {preloadSrc && preloadSrc !== 'placeholder' && (
        <video src={preloadSrc} preload="auto" muted className="hidden" aria-hidden />
      )}
    </div>
  )
}
```

- [ ] **Step 3: GuessInput.** Behavioral requirements (binding):
  - Controlled text input; dropdown shows `searchPlayers(allPlayers, query)` results.
  - Keyboard: ↑/↓ move highlight, Enter selects highlighted, Escape closes.
  - Click/tap selects too. Selecting calls `onGuess(playerId)`, clears input, closes dropdown.
  - **No free-text submit**: Enter with no highlighted suggestion does nothing.
  - Already-wrong player ids (`disabledIds`) render dimmed and are not selectable.
  - Input auto-focuses when a new clip starts (`autoFocus` + `key` remount from parent).

```tsx
// src/components/GuessInput.tsx
'use client'

import { useMemo, useState } from 'react'
import type { Player } from '@/lib/types'
import { searchPlayers } from '@/lib/search'

export default function GuessInput({ players, disabledIds, onGuess }: {
  players: Player[]
  disabledIds: string[]
  onGuess: (playerId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const results = useMemo(() => searchPlayers(players, query), [players, query])

  const select = (p: Player) => {
    if (disabledIds.includes(p.id)) return
    onGuess(p.id)
    setQuery('')
    setHighlight(0)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); select(results[highlight]) }
    else if (e.key === 'Escape') setQuery('')
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={query}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
        onKeyDown={onKeyDown}
        placeholder="Who is this?"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
        className="w-full rounded-xl border px-4 py-3"
      />
      {results.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
          {results.map((p, i) => {
            const disabled = disabledIds.includes(p.id)
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={i === highlight}
                aria-disabled={disabled}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); select(p) }}
                className={`cursor-pointer px-4 py-2 ${i === highlight ? 'bg-neutral-100' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {p.name}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: HintChips, RevealCard, GameOver.** Behavior:
  - `HintChips({ player, level })`: three slots — guesses-remaining indicator is handled in Game; chip 1 (era) revealed at `level >= 1`, chip 2 (teams, joined with " · ") at `level >= 2`; unrevealed chips show as locked ("? Era", "? Teams").
  - `RevealCard({ player, result, onNext })`: player name, `yearsActive`, teams; "+100/+50/+25" if solved, "Run over" styling if not; button label "Next QB →" when solved, "See final score" when not.
  - `GameOver({ state, best, onRestart })`: final score, solved count, best score (highlight "New best!" when `state.score >= best && state.score > 0`), emoji strip from history (same mapping as `shareText`), a Share button that calls `navigator.clipboard.writeText(shareText(state))` and flips its label to "Copied!" for 2s, and a "Play again" button.

```tsx
// src/components/HintChips.tsx
import type { Player } from '@/lib/types'

export default function HintChips({ player, level }: { player: Player; level: number }) {
  const chips = [
    { label: 'Era', value: player.era, unlocked: level >= 1 },
    { label: 'Teams', value: player.teams.join(' · '), unlocked: level >= 2 },
  ]
  return (
    <div className="flex gap-2">
      {chips.map((c) => (
        <span key={c.label} className={`rounded-full border px-3 py-1 text-sm ${c.unlocked ? '' : 'opacity-50'}`}>
          {c.unlocked ? `${c.label}: ${c.value}` : `🔒 ${c.label}`}
        </span>
      ))}
    </div>
  )
}
```

```tsx
// src/components/RevealCard.tsx
import type { Player } from '@/lib/types'
import type { ClipResult } from '@/lib/game'

export default function RevealCard({ player, result, onNext }: {
  player: Player
  result: ClipResult
  onNext: () => void
}) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm uppercase tracking-wide opacity-60">
        {result.solved ? `+${result.points} points` : 'Run over'}
      </p>
      <h2 className="text-3xl font-bold">{player.name}</h2>
      <p className="opacity-70">{player.teams.join(' · ')} · {player.yearsActive}</p>
      <button onClick={onNext} className="rounded-xl border px-6 py-3 font-semibold">
        {result.solved ? 'Next QB →' : 'See final score'}
      </button>
    </div>
  )
}
```

```tsx
// src/components/GameOver.tsx
'use client'

import { useState } from 'react'
import { shareText, type RunState, type ClipResult } from '@/lib/game'

const EMOJI = (r: ClipResult) =>
  !r.solved ? '💀' : r.guessesUsed === 1 ? '💯' : r.guessesUsed === 2 ? '🎯' : '🤏'

export default function GameOver({ state, best, onRestart }: {
  state: RunState
  best: number
  onRestart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const solved = state.history.filter((r) => r.solved).length
  const isNewBest = state.score >= best && state.score > 0

  const share = async () => {
    await navigator.clipboard.writeText(shareText(state))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 text-center">
      <h2 className="text-4xl font-bold">{state.score} pts</h2>
      <p className="opacity-70">{solved} QBs identified</p>
      <p className="text-lg">{state.history.map(EMOJI).join('')}</p>
      <p className="text-sm opacity-60">{isNewBest ? '🏆 New best!' : `Best: ${best}`}</p>
      <div className="flex justify-center gap-3">
        <button onClick={share} className="rounded-xl border px-6 py-3 font-semibold">
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button onClick={onRestart} className="rounded-xl border px-6 py-3 font-semibold">
          Play again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Game container.** Wires state machine to components. Requirements:
  - `createRun(getPoolClips())` on mount / restart (create inside a `useState` initializer? No — `Math.random` in render breaks hydration; initialize `null` on server, create the run in a `useEffect`, render a loading shell until ready).
  - Score + clip counter + guess dots (`●○○` style showing guesses left) always visible during play.
  - On entering `over` phase, call `recordScore(state.score)` once and pass previous best into GameOver.
  - Preload next clip's src via ClipPlayer's `preloadSrc`.
  - Wrong-guess feedback: brief shake/flash on the input area (CSS class toggle).

```tsx
// src/components/Game.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  advance, createRun, currentClip, hintLevel, submitGuess,
  MAX_GUESSES, type RunState,
} from '@/lib/game'
import { getPlayer, getPlayers, getPoolClips } from '@/lib/data'
import { loadBest, recordScore } from '@/lib/storage'
import ClipPlayer from './ClipPlayer'
import GuessInput from './GuessInput'
import HintChips from './HintChips'
import RevealCard from './RevealCard'
import GameOver from './GameOver'

export default function Game() {
  const [state, setState] = useState<RunState | null>(null)
  const [best, setBest] = useState(0)
  const recorded = useRef(false)

  const startRun = () => {
    recorded.current = false
    setBest(loadBest())
    setState(createRun(getPoolClips()))
  }

  useEffect(startRun, [])

  useEffect(() => {
    if (state?.phase === 'over' && !recorded.current) {
      recorded.current = true
      recordScore(state.score)
    }
  }, [state])

  if (!state) return <div className="p-12 text-center opacity-50">Loading…</div>

  if (state.phase === 'over') {
    return <GameOver state={state} best={best} onRestart={startRun} />
  }

  const clip = currentClip(state)
  const player = getPlayer(clip.playerId)
  const nextClip = state.clipOrder[state.index + 1]
  const level = hintLevel(state)
  const lastResult = state.history[state.history.length - 1]

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-sm">
        <span className="font-bold">ShadowForm</span>
        <span>
          {state.score} pts · QB {state.index + 1}/{state.clipOrder.length} ·{' '}
          {'●'.repeat(MAX_GUESSES - level) + '○'.repeat(level)}
        </span>
      </header>

      <ClipPlayer src={clip.src} seed={clip.playerId} preloadSrc={nextClip?.src} />

      {state.phase === 'reveal' ? (
        <RevealCard player={player} result={lastResult} onNext={() => setState(advance(state))} />
      ) : (
        <>
          <HintChips player={player} level={level} />
          <GuessInput
            key={clip.id}
            players={getPlayers()}
            disabledIds={state.wrongGuesses}
            onGuess={(id) => setState(submitGuess(state, id))}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 6: page.tsx / layout.tsx.** Replace scaffold home page with `<Game />`; set metadata title "ShadowForm — guess the QB from the silhouette", description, dark-friendly body styling. Apply the frontend-design pass here (fonts, palette, motion) across globals.css and the components above.

```tsx
// src/app/page.tsx
import Game from '@/components/Game'

export default function Home() {
  return (
    <main className="min-h-dvh">
      <Game />
    </main>
  )
}
```

- [ ] **Step 7: Verify.** `npm run build` passes; `npm test` passes. Then run the dev server and play a full run in the browser (placeholder clips): correct guess scores, wrong guesses unlock era then teams, third miss ends run, share copies text, best persists across reload, play-again works.

- [ ] **Step 8: Commit.** `git commit -m "feat: playable game UI with autocomplete, hints, reveal, and game over"`

---

### Task 7: Silhouette pipeline

**Files:**
- Create: `pipeline/process.py`, `pipeline/manifest.json`, `pipeline/requirements.txt`, `pipeline/README.md`

**Interfaces:**
- Consumes: nothing from the app (fully independent).
- Produces: `public/clips/<id>.webm`, `<id>.mp4`, `<id>.jpg` per manifest entry; after running, John updates `src/data/clips.json` entries from `"placeholder"` to `"/clips/<id>.webm"`.

**Note:** This task can only be *smoke-verified* in this environment (Python syntax, manifest schema, dry-run mode). Full verification (downloading, RVM inference) happens on John's machine with network access — the README is the deliverable that makes that turnkey.

- [ ] **Step 1: requirements.txt**

```
torch
torchvision
av
tqdm
yt-dlp
```

- [ ] **Step 2: manifest.json.** One entry per in-pool player (ids matching `clips.json`), `source`/`start`/`end` left empty for John to fill (finding good, legally-sourced clip timestamps is human curation work):

```json
[
  {
    "id": "dan-marino-01",
    "playerId": "dan-marino",
    "source": "",
    "start": "",
    "end": "",
    "crop": "auto"
  }
]
```

…repeated for all 50 clip ids. Entries with an empty `source` are skipped with a warning.

- [ ] **Step 3: process.py.** Complete implementation:

```python
#!/usr/bin/env python3
"""ShadowForm silhouette pipeline.

manifest.json -> public/clips/<id>.webm + .mp4 + .jpg

Per entry: yt-dlp download (cached) -> ffmpeg trim -> Robust Video Matting
alpha matte -> ffmpeg silhouette composite (black figure, light background).

Usage:
  python process.py            # process all manifest entries with a source
  python process.py --only dan-marino-01
  python process.py --force    # reprocess even if output exists
  python process.py --dry-run  # validate manifest + tool availability only
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "public" / "clips"
MANIFEST = ROOT / "manifest.json"

BG = "0xF5F2EC"  # light background behind the black figure


def run(cmd: list[str]) -> None:
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, capture_output=True)


def download(entry: dict) -> Path:
    raw = CACHE / f"{entry['id']}.source.mp4"
    if raw.exists():
        return raw
    run(["yt-dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4",
         "-o", str(raw), entry["source"]])
    return raw


def trim(entry: dict, raw: Path) -> Path:
    trimmed = CACHE / f"{entry['id']}.trim.mp4"
    run(["ffmpeg", "-y", "-ss", entry["start"], "-to", entry["end"], "-i", str(raw),
         "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", str(trimmed)])
    return trimmed


def matte(entry: dict, trimmed: Path) -> Path:
    """Robust Video Matting -> alpha video (white figure on black)."""
    import torch  # deferred: heavy import
    pha = CACHE / f"{entry['id']}.pha.mp4"
    model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3").eval()
    convert_video = torch.hub.load("PeterL1n/RobustVideoMatting", "converter")
    if torch.backends.mps.is_available():
        model = model.to("mps")
    convert_video(
        model,
        input_source=str(trimmed),
        output_type="video",
        output_alpha=str(pha),
        downsample_ratio=None,  # auto
        seq_chunk=8,
    )
    return pha


def silhouette(entry: dict, pha: Path) -> None:
    """Alpha matte -> black figure on flat light bg; export webm + mp4 + poster."""
    OUT.mkdir(parents=True, exist_ok=True)
    # negate: white-figure-on-black -> black-figure-on-white; then tint bg, square-crop, scale
    vf = f"negate,format=gray,scale=720:720:force_original_aspect_ratio=increase,crop=720:720,eq=contrast=1.15,colorlevels=romax=0.96:gomax=0.95:bomax=0.92"
    webm = OUT / f"{entry['id']}.webm"
    mp4 = OUT / f"{entry['id']}.mp4"
    poster = OUT / f"{entry['id']}.jpg"
    run(["ffmpeg", "-y", "-i", str(pha), "-vf", vf, "-an",
         "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", str(webm)])
    run(["ffmpeg", "-y", "-i", str(pha), "-vf", vf, "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", str(mp4)])
    run(["ffmpeg", "-y", "-i", str(webm), "-vframes", "1", str(poster)])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="process a single clip id")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    entries = json.loads(MANIFEST.read_text())
    for tool in ("ffmpeg", "yt-dlp"):
        if not shutil.which(tool):
            print(f"ERROR: {tool} not found on PATH", file=sys.stderr)
            return 1

    CACHE.mkdir(exist_ok=True)
    done = skipped = 0
    for entry in entries:
        if args.only and entry["id"] != args.only:
            continue
        if not entry.get("source"):
            print(f"~ {entry['id']}: no source URL yet, skipping")
            skipped += 1
            continue
        if not args.force and (OUT / f"{entry['id']}.webm").exists():
            print(f"= {entry['id']}: already processed")
            continue
        if args.dry_run:
            print(f"+ {entry['id']}: would process {entry['source']} [{entry['start']}–{entry['end']}]")
            continue
        print(f"> {entry['id']}")
        raw = download(entry)
        trimmed = trim(entry, raw)
        pha = matte(entry, trimmed)
        silhouette(entry, pha)
        done += 1

    print(f"\nDone: {done} processed, {skipped} awaiting source URLs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: README.md.** Must cover: one-time setup (`python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`, `brew install ffmpeg yt-dlp` if missing); the curation workflow (find a highlight video per QB, pick a 2–4s window isolating the throwing motion — ideally a stable, side-on or three-quarter camera angle with the QB large in frame; paste URL + timestamps into `manifest.json`); running `python process.py`; visually QA-ing output in `public/clips/`; flipping the matching `src/data/clips.json` entry from `"placeholder"` to `"/clips/<id>.webm"`; re-sourcing tips for bad mattes (grainy old footage: try NFL Films retrospectives, avoid multi-person frames — RVM mattes *all* people in frame); and the copyright posture from the spec (well-transformed silhouettes, hobby site, known residual risk).

- [ ] **Step 5: Smoke-verify.** `python3 -c "import ast; ast.parse(open('pipeline/process.py').read())"` → no error. `python3 pipeline/process.py --dry-run` → runs, reports all entries "no source URL yet" (yt-dlp missing is acceptable in dry-run only if the check is reached after; if the tool check fires first, temporarily verify with ffmpeg-only check — acceptable to reorder the tool check after `--dry-run` handling; do NOT install torch in this environment).

  ⚠️ Note: the tool check in `main()` runs before dry-run handling and `yt-dlp` is not installed in this environment — reorder so `--dry-run` validates the manifest without requiring yt-dlp, e.g. skip the `yt-dlp` availability check when `args.dry_run` is set.

- [ ] **Step 6: Commit.** `git commit -m "feat: silhouette pipeline (yt-dlp + RVM + ffmpeg)"`

---

### Task 8: Production build, README, deploy prep

**Files:**
- Create: `README.md` (root)
- Modify: whatever `npm run build` / `npx eslint` flags

**Interfaces:**
- Consumes: everything.
- Produces: deployable repo.

- [ ] **Step 1: Root README.** Short: what ShadowForm is, `npm install && npm run dev`, `npm test`, pointer to `pipeline/README.md` for content workflow, deploy note (`npx vercel` → follow prompts; or connect the repo in the Vercel dashboard).

- [ ] **Step 2: Full verification.**

```bash
npm test          # all suites pass
npm run lint      # clean
npm run build     # production build succeeds
```

- [ ] **Step 3: Play-test the production build.** `npm run build && npm run start`, play a complete run end-to-end in the browser. Verify the verify-skill checklist: scoring math visible on screen matches engine, hints unlock in order, share text lands on clipboard, best score survives reload.

- [ ] **Step 4: Commit.** `git commit -m "docs: README and deploy prep"`

- [ ] **Step 5: Report to John.** Final message covers: what's playable now (placeholder silhouettes), the one human task remaining (fill manifest source URLs + timestamps, run pipeline, flip clips.json), and how to deploy (`npx vercel`, no env vars needed).

---

## Self-Review (completed)

- **Spec coverage:** rules (3 guesses, 100/50/25, era→teams hints, run-end) → Task 3; autocomplete-no-spelling → Task 4 + GuessInput's no-free-text rule; localStorage best + share → Tasks 5/6; sport-agnostic data → Task 2; pipeline (manifest, yt-dlp, RVM, ffmpeg, WebM+MP4, idempotent) → Task 7; Vercel/static/no-backend → Tasks 1/8; preloading + reduced-motion → Task 6. Spec's "Claude pre-fills candidate source URLs" is deliberately narrowed to "manifest scaffolded, URLs curated by John" — URL/timestamp accuracy can't be verified without watching footage; flagged in Task 8's report.
- **Placeholder scan:** all code steps carry complete code; Task 2's player list is enumerated by name with exact schema; Task 7 step 4 specifies README content as a requirements list (prose deliverable).
- **Type consistency:** `RunState`/`ClipResult`/`Phase` names match across Tasks 3 and 6; `searchPlayers` signature matches between Tasks 4 and 6; `recordScore`/`loadBest` match between Tasks 5 and 6; clip id convention `<player-id>-01` consistent across Tasks 2 and 7.
