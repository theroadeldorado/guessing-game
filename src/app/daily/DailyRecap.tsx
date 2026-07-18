'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  dailyShareQuery,
  dailyShareText,
  labelFor,
  teeCountdown,
  toDailyShare,
  toParText,
  weekdayName,
  type DailyProgress,
} from '@/lib/daily'
import { SITE_URL } from '@/lib/share'
import ScoreMark from '@/components/ScoreMark'

/** Sunday-broadcast single-hole scorecard shown after (or on revisiting) the
 *  day's hole. `justFinished` distinguishes a fresh finish from a locked revisit. */
export default function DailyRecap({
  progress,
  justFinished,
}: {
  progress: DailyProgress
  justFinished: boolean
}) {
  const r = progress.lastResult
  const label = labelFor(r.solved, r.strokes, r.par)
  const [countdown, setCountdown] = useState(teeCountdown)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setCountdown(teeCountdown()), 30_000)
    return () => clearInterval(t)
  }, [])

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL
      const url = `${origin}/daily/share?${dailyShareQuery(toDailyShare(progress))}`
      const message = dailyShareText(toDailyShare(progress))
      if (navigator.share) {
        await navigator.share({ text: message, url })
        return
      }
      await navigator.clipboard.writeText(`${message}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // dismissed / failed — no-op
    } finally {
      setSharing(false)
    }
  }

  return (
    <main className="sf-rise mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-12 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">
        Daily Round · {justFinished ? 'Final' : 'Today'}
      </p>

      <p className="font-mono text-sm uppercase tracking-[0.2em] text-chalk-soft">
        {weekdayName(r.date)} · {r.yards} yd · Par {r.par}
      </p>

      <div className="flex flex-col items-center gap-2">
        <ScoreMark toPar={r.scoreToPar}>{r.strokes}</ScoreMark>
        <p className="font-display text-3xl uppercase text-paper">{label}</p>
      </div>

      <p className="font-mono text-sm text-chalk-soft">
        {r.solved ? (
          <>
            Solved in{' '}
            <span className="text-paper">
              {r.strokes} {r.strokes === 1 ? 'guess' : 'guesses'}
            </span>{' '}
            · <span className="text-paper">{r.player}</span>
          </>
        ) : (
          <>
            It was <span className="text-paper">{r.player}</span>
          </>
        )}
      </p>

      <div className="w-full rounded-sm border border-chalk px-4 py-4">
        {progress.alive ? (
          <p className="font-display text-2xl uppercase text-paper">
            Streak {progress.streak}{' '}
            <span className="text-flag">· {toParText(progress.toPar).toUpperCase()}</span>
          </p>
        ) : (
          <p className="font-display text-2xl uppercase text-red-400">
            Streak over
            {progress.streak > 0 && (
              <span className="text-chalk-soft"> · {progress.streak} made</span>
            )}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-chalk-soft">
          {progress.alive
            ? `Back tomorrow to keep it alive · next tee time in ${countdown}`
            : `New streak tees off tomorrow · in ${countdown}`}
        </p>
      </div>

      <div className="flex w-full gap-3">
        <button
          onClick={share}
          disabled={sharing}
          className="flex-1 rounded-sm border border-paper/40 px-6 py-3 font-display text-lg uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag disabled:opacity-50"
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
        <Link
          href="/"
          className="flex-1 rounded-sm bg-paper px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
        >
          Play the Range
        </Link>
      </div>
    </main>
  )
}
