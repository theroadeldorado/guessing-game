'use client'

import { useState } from 'react'
import type { Sport } from '@/lib/types'
import Game from './Game'

/**
 * Entry point when more than one sport is active: pick a sport, then play.
 * With a single active sport the caller skips this and mounts Game directly.
 */
export default function SportPicker({ sports }: { sports: Sport[] }) {
  const [sportId, setSportId] = useState<string | null>(null)

  if (sportId) return <Game sportId={sportId} />

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-center font-display text-3xl uppercase tracking-wide text-paper">
        Shadow<span className="text-flag">Form</span>
      </h1>
      <p className="text-center font-mono text-sm text-chalk-soft">Pick your film session</p>
      <div className="mt-4 flex flex-col gap-3">
        {sports.map((s) => (
          <button
            key={s.id}
            onClick={() => setSportId(s.id)}
            className="rounded-sm border border-chalk px-6 py-4 text-left font-display text-xl uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag"
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
