'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  foldResult,
  golfDate,
  weekdayName,
  type DailyGuessResult,
  type DailyHoleView,
  type DailyProgress,
} from '@/lib/daily'
import { getSport } from '@/lib/data'
import type { Named } from '@/lib/search'
import {
  clearDailyActive,
  loadDaily,
  loadDailyActive,
  saveDaily,
  saveDailyActive,
} from '@/lib/storage'
import ClipPlayer from '@/components/ClipPlayer'
import GuessInput from '@/components/GuessInput'
import DailyRecap from './DailyRecap'

const postGuesses = (guesses: string[]): Promise<DailyGuessResult> =>
  fetch('/api/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guesses }),
  }).then((r) => r.json())

export default function DailyGame() {
  const today = useMemo(() => golfDate(), [])
  const prev = useMemo(() => loadDaily('golf'), [])
  const alreadyPlayed = prev?.lastDate === today

  const [hole, setHole] = useState<DailyHoleView | null>(null)
  const [field, setField] = useState<Named[]>([])
  const [guesses, setGuesses] = useState<string[]>([])
  const [result, setResult] = useState<DailyGuessResult | null>(null)
  const [progress, setProgress] = useState<DailyProgress | null>(prev)
  const [justFinished, setJustFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  const folded = useRef(false)

  // Load today's hole (answer stays on the server), resuming any saved guesses.
  useEffect(() => {
    if (alreadyPlayed) return
    let cancelled = false
    ;(async () => {
      const view: DailyHoleView = await fetch('/api/daily').then((r) => r.json())
      if (cancelled) return
      setHole(view)
      const active = loadDailyActive('golf')
      const resume = active?.date === today && active.guesses.length ? active.guesses : []
      if (resume.length) {
        const res = await postGuesses(resume)
        if (cancelled) return
        setGuesses(resume)
        setResult(res)
        setField(res.phase === 'done' ? [] : res.field)
      } else {
        setField(view.field)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [alreadyPlayed, today])

  // Fold a finished hole into the streak exactly once.
  useEffect(() => {
    if (result?.phase === 'done' && !folded.current) {
      folded.current = true
      const next = foldResult(prev, today, {
        par: result.par,
        yards: result.yards,
        strokes: result.strokes,
        solved: result.solved,
        scoreToPar: result.scoreToPar,
        player: result.answer ?? '—',
      })
      saveDaily('golf', next)
      clearDailyActive('golf')
      setProgress(next)
      setJustFinished(true)
    }
  }, [result, prev, today])

  const guess = useCallback(
    async (id: string) => {
      if (busy || guesses.includes(id)) return
      setBusy(true)
      const next = [...guesses, id]
      setGuesses(next)
      saveDailyActive('golf', { date: today, guesses: next })
      try {
        const res = await postGuesses(next)
        setResult(res)
        if (res.phase !== 'done') setField(res.field)
      } finally {
        setBusy(false)
      }
    },
    [busy, guesses, today],
  )

  if (alreadyPlayed && progress) return <DailyRecap progress={progress} justFinished={false} />
  if (justFinished && progress) return <DailyRecap progress={progress} justFinished />
  if (!hole) {
    return <div className="p-16 text-center font-mono text-sm text-chalk-soft">Walking to the tee…</div>
  }

  const sport = getSport('golf')
  const left = hole.budget - guesses.length

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-5">
      <header className="flex items-baseline justify-between border-b border-chalk pb-3">
        <Link href="/" className="font-display text-xl uppercase tracking-wide text-paper">
          Shadow<span className="text-flag">Form</span>
        </Link>
        <span className="font-mono text-sm text-chalk-soft">
          {weekdayName(today)} · Par {hole.par} ·{' '}
          <span className="text-paper">
            {left} {left === 1 ? 'shot' : 'shots'} left
          </span>
        </span>
      </header>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">
        Daily Round · {hole.yards} yd
      </p>

      <ClipPlayer src={hole.video} seed="daily" variant="swing" crop={hole.crop} />

      <div key={guesses.length} className={guesses.length > 0 ? 'sf-shake mt-auto' : 'mt-auto'}>
        <GuessInput
          players={field}
          placeholder={sport.inputPlaceholder}
          disabledIds={guesses}
          onGuess={guess}
        />
      </div>
    </div>
  )
}
