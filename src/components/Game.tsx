'use client'

import { useEffect, useRef, useState } from 'react'
import {
  advance, createRun, currentClip, hintLevel, submitGuess,
  type RunState,
} from '@/lib/game'
import { getPlayer, getPlayers, getPoolClips, getSport } from '@/lib/data'
import { loadBest, recordScore } from '@/lib/storage'
import type { SilhouetteVariant } from './PlaceholderSilhouette'
import ClipPlayer from './ClipPlayer'
import DownMarkers from './DownMarkers'
import GuessInput from './GuessInput'
import HintChips from './HintChips'
import RevealCard from './RevealCard'
import GameOver from './GameOver'

const SILHOUETTE_VARIANTS: Record<string, SilhouetteVariant> = {
  golf: 'swing',
}

// Rendered client-only (see GameLoader), so the shuffled run and stored
// best can be created directly in state initializers without SSR mismatch.
export default function Game({ sportId }: { sportId: string }) {
  const sport = getSport(sportId)
  const [state, setState] = useState<RunState>(() => createRun(getPoolClips(sportId)))
  const [best, setBest] = useState(() => loadBest(sportId))
  const recorded = useRef(false)

  const startRun = () => {
    recorded.current = false
    setBest(loadBest(sportId))
    setState(createRun(getPoolClips(sportId)))
  }

  useEffect(() => {
    if (state.phase === 'over' && !recorded.current) {
      recorded.current = true
      recordScore(sportId, state.score)
    }
  }, [state, sportId])

  if (state.phase === 'over') {
    return <GameOver state={state} sport={sport} best={best} onRestart={startRun} />
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
          <span className="text-paper">{state.score}</span> pts · {sport.athleteNoun}{' '}
          {state.index + 1}/{state.clipOrder.length}
        </span>
      </header>

      <ClipPlayer
        src={clip.src}
        seed={clip.playerId}
        variant={SILHOUETTE_VARIANTS[sportId] ?? 'throw'}
        preloadSrc={nextClip?.src}
      />

      {state.phase === 'reveal' ? (
        <RevealCard
          player={player}
          result={lastResult}
          nextLabel={`Next ${sport.athleteNoun}`}
          onNext={() => setState(advance(state))}
        />
      ) : (
        <>
          <DownMarkers level={level} />
          <HintChips player={player} detailLabel={sport.detailLabel} level={level} />
          <div key={level} className={level > 0 ? 'sf-shake mt-auto' : 'mt-auto'}>
            <GuessInput
              key={clip.id}
              players={getPlayers(sportId)}
              placeholder={sport.inputPlaceholder}
              disabledIds={state.wrongGuesses}
              onGuess={(id) => setState(submitGuess(state, id))}
            />
          </div>
        </>
      )}
    </div>
  )
}
