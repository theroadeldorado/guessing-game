'use client'

import { useState } from 'react'
import { shareText, type RunState, type ClipResult, type ShareSport } from '@/lib/game'

const resultEmoji = (r: ClipResult) =>
  !r.solved ? '💀' : r.guessesUsed === 1 ? '💯' : r.guessesUsed === 2 ? '🎯' : '🤏'

/** Final whistle: score, run log, share, run it back. */
export default function GameOver({ state, sport, best, onRestart }: {
  state: RunState
  sport: ShareSport
  best: number
  onRestart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const solved = state.history.filter((r) => r.solved).length
  const isNewBest = state.score >= best && state.score > 0

  const share = async () => {
    await navigator.clipboard.writeText(shareText(state, sport))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="sf-rise mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">Final</p>
      <h2 className="font-display text-7xl uppercase text-paper">
        {state.score}
        <span className="ml-2 text-2xl text-chalk-soft">pts</span>
      </h2>
      <p className="font-mono text-sm text-chalk-soft">
        {solved} {sport.athleteNounPlural} identified
      </p>
      <p className="text-2xl leading-relaxed break-all">{state.history.map(resultEmoji).join('')}</p>
      <p className={`font-mono text-sm ${isNewBest ? 'text-flag' : 'text-chalk-soft'}`}>
        {isNewBest ? '🏆 New best!' : `Best: ${best}`}
      </p>
      <div className="mt-2 flex w-full gap-3">
        <button
          onClick={share}
          className="flex-1 rounded-sm border border-paper/40 px-6 py-3 font-display text-lg uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag"
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button
          onClick={onRestart}
          autoFocus
          className="flex-1 rounded-sm bg-paper px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
        >
          Run it back
        </button>
      </div>
    </div>
  )
}
