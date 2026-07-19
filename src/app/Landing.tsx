'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { golfDate, teeCountdown, toParText } from '@/lib/daily'
import { loadDaily } from '@/lib/storage'

/** Home: pick a mode. The daily card reflects whether today's hole is done. */
export default function Landing() {
  const [daily, setDaily] = useState<{
    played: boolean
    countdown: string
    streak: number
    toPar: number
    alive: boolean
  } | null>(null)

  useEffect(() => {
    // localStorage is only available post-mount (SSR-safe): read it once here.
    const p = loadDaily('golf')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDaily({
      played: !!p && p.lastDate === golfDate(),
      countdown: teeCountdown(),
      streak: p?.streak ?? 0,
      toPar: p?.toPar ?? 0,
      alive: p?.alive ?? false,
    })
  }, [])

  const played = daily?.played ?? false

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="font-display text-5xl uppercase tracking-wide text-paper">
          Shadow<span className="text-flag">Form</span>
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-soft">
          Guess the golfer from the swing
        </p>
      </header>

      {/* Daily Round */}
      <section className="flex flex-col gap-3 rounded-sm border border-chalk p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl uppercase text-paper">Daily Round</h2>
          {daily && daily.alive && daily.streak > 0 && (
            <span className="font-mono text-xs text-flag">
              🔥 {daily.streak} · {toParText(daily.toPar)}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-chalk-soft">
          One swing a day. Name the golfer under par to card a birdie or better and grow your
          streak. One blow-up hole and you&apos;re back to the first tee tomorrow.
        </p>
        {played ? (
          <>
            <Link
              href="/daily"
              className="block rounded-sm border border-paper/40 px-6 py-3 text-center font-display text-lg uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag"
            >
              See today&apos;s result
            </Link>
            <p className="text-center font-mono text-xs text-chalk-soft">
              Played today · check back at the next tee time
              {daily ? ` in ${daily.countdown}` : ''}
            </p>
          </>
        ) : (
          <Link
            href="/daily"
            className="block rounded-sm bg-paper px-6 py-3 text-center font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
          >
            Play today&apos;s hole
          </Link>
        )}
      </section>

      {/* The Cut */}
      <section className="flex flex-col gap-3 rounded-sm border border-chalk p-5">
        <h2 className="font-display text-2xl uppercase text-paper">The Cut</h2>
        <p className="text-sm leading-relaxed text-chalk-soft">
          How many golfers can you name before you miss the cut? Every silhouette you nail stacks
          points and keeps your run alive. Type to search, then it&apos;s multiple choice once you
          slip. One bad read and you&apos;re cut.
        </p>
        <Link
          href="/cut"
          className="block rounded-sm bg-paper px-6 py-3 text-center font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
        >
          Make the Cut
        </Link>
      </section>

      <footer className="mt-2 text-center">
        <Link
          href="/privacy"
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-soft transition-colors hover:text-flag"
        >
          Privacy
        </Link>
      </footer>
    </main>
  )
}
