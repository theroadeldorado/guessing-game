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

const resultEmoji = (r: ClipResult): string =>
  !r.solved ? '💀' : r.guessesUsed === 1 ? '💯' : r.guessesUsed === 2 ? '🎯' : '🤏'

export function shareText(state: RunState): string {
  const solved = state.history.filter((r) => r.solved).length
  const emoji = state.history.map(resultEmoji).join('')
  return `🏈 ShadowForm — ${state.score} pts, ${solved} QBs\n${emoji}`
}
