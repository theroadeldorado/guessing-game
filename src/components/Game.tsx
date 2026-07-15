'use client'

import { useEffect, useRef, useState } from 'react'
import {
  advance, createRun, currentClip, hintLevel, submitGuess,
  type RunState,
} from '@/lib/game'
import { getPlayer, getPlayers, getPoolClips } from '@/lib/data'
import { loadBest, recordScore } from '@/lib/storage'
import ClipPlayer from './ClipPlayer'
import DownMarkers from './DownMarkers'
import GuessInput from './GuessInput'
import HintChips from './HintChips'
import RevealCard from './RevealCard'
import GameOver from './GameOver'

// Rendered client-only (see GameLoader), so the shuffled run and stored
// best can be created directly in state initializers without SSR mismatch.
export default function Game() {
  const [state, setState] = useState<RunState>(() => createRun(getPoolClips()))
  const [best, setBest] = useState(loadBest)
  const recorded = useRef(false)

  const startRun = () => {
    recorded.current = false
    setBest(loadBest())
    setState(createRun(getPoolClips()))
  }

  useEffect(() => {
    if (state.phase === 'over' && !recorded.current) {
      recorded.current = true
      recordScore(state.score)
    }
  }, [state])

  if (state.phase === 'over') {
    return <GameOver state={state} best={best} onRestart={startRun} />
  }

  const clip = currentClip(state)
  const player = getPlayer(clip.playerId)
  const nextClip = state.clipOrder[state.index + 1]
  const level = hintLevel(state)
  const lastResult = state.history[state.history.length - 1]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5">
      <header className="flex items-baseline justify-between border-b border-chalk pb-3">
        <span className="font-display text-xl uppercase tracking-wide text-paper">
          Shadow<span className="text-flag">Form</span>
        </span>
        <span className="font-mono text-sm text-chalk-soft">
          <span className="text-paper">{state.score}</span> pts · QB {state.index + 1}/
          {state.clipOrder.length}
        </span>
      </header>

      <ClipPlayer src={clip.src} seed={clip.playerId} preloadSrc={nextClip?.src} />

      {state.phase === 'reveal' ? (
        <RevealCard player={player} result={lastResult} onNext={() => setState(advance(state))} />
      ) : (
        <>
          <DownMarkers level={level} />
          <HintChips player={player} level={level} />
          <div key={level} className={level > 0 ? 'sf-shake mt-auto' : 'mt-auto'}>
            <GuessInput
              key={clip.id}
              players={getPlayers()}
              disabledIds={state.wrongGuesses}
              onGuess={(id) => setState(submitGuess(state, id))}
            />
          </div>
        </>
      )}
    </div>
  )
}
