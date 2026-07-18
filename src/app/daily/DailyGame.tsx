'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  applyResult,
  golfDate,
  narrowedField,
  resumeDaily,
  startDaily,
  submitDailyGuess,
  weekdayName,
  type DailyProgress,
  type DailyState,
} from '@/lib/daily'
import { getPlayer, getPlayers, getSport } from '@/lib/data'
import {
  clearDailyActive,
  loadDaily,
  loadDailyActive,
  saveDaily,
  saveDailyActive,
} from '@/lib/storage'
import ClipPlayer from '@/components/ClipPlayer'
import GuessInput from '@/components/GuessInput'
import HintChips from '@/components/HintChips'
import DailyRecap from './DailyRecap'

export default function DailyGame() {
  const today = useMemo(() => golfDate(), [])
  const prev = useMemo(() => loadDaily('golf'), [])
  const alreadyPlayed = prev?.lastDate === today

  const [state, setState] = useState<DailyState | null>(() => {
    if (alreadyPlayed) return null
    // Resume in-progress guesses so a refresh can't reset the budget.
    const active = loadDailyActive('golf')
    if (active && active.date === today && active.guesses.length) {
      return resumeDaily(today, active.guesses)
    }
    return startDaily(today)
  })
  const [progress, setProgress] = useState<DailyProgress | null>(prev)
  const [justFinished, setJustFinished] = useState(false)
  const saved = useRef(false)

  // Persist the running guesses each turn (survives a refresh mid-hole).
  useEffect(() => {
    if (state && state.phase === 'guessing') {
      saveDailyActive('golf', { date: today, guesses: state.guesses })
    }
  }, [state, today])

  // Fold the finished hole into the streak exactly once.
  useEffect(() => {
    if (state?.phase === 'done' && !saved.current) {
      saved.current = true
      const next = applyResult(prev, today, state)
      saveDaily('golf', next)
      clearDailyActive('golf')
      setProgress(next)
      setJustFinished(true)
    }
  }, [state, prev, today])

  // Already played today, or just finished → the recap (play locked till tomorrow).
  if (alreadyPlayed && progress) return <DailyRecap progress={progress} justFinished={false} />
  if (justFinished && progress) return <DailyRecap progress={progress} justFinished />
  if (!state) return null

  const sport = getSport('golf')
  const player = getPlayer(state.hole.clip.playerId)
  const field = narrowedField(state, getPlayers('golf'))
  const used = state.guesses.length
  const left = state.hole.budget - used

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5">
      <header className="flex items-baseline justify-between border-b border-chalk pb-3">
        <Link href="/" className="font-display text-xl uppercase tracking-wide text-paper">
          Shadow<span className="text-flag">Form</span>
        </Link>
        <span className="font-mono text-sm text-chalk-soft">
          {weekdayName(today)} · Par {state.hole.par} ·{' '}
          <span className="text-paper">
            {left} {left === 1 ? 'shot' : 'shots'} left
          </span>
        </span>
      </header>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">
        Daily Round · {state.hole.yards} yd
      </p>

      <ClipPlayer src={state.hole.clip.src} seed={player.id} variant="swing" crop={state.hole.clip.crop} />

      <HintChips player={player} detailLabel={sport.detailLabel} level={Math.min(used, 2)} />

      <div key={used} className={used > 0 ? 'sf-shake mt-auto' : 'mt-auto'}>
        <GuessInput
          players={field}
          placeholder={sport.inputPlaceholder}
          disabledIds={state.guesses}
          onGuess={(id) => setState((s) => (s ? submitDailyGuess(s, id) : s))}
        />
      </div>
    </div>
  )
}
