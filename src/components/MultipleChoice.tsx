'use client'

import type { Player } from '@/lib/types'

/**
 * Multiple-choice guess grid — shown in The Range after the first wrong guess.
 * Same contract as GuessInput: a pick calls onGuess(id); already-guessed
 * options render disabled.
 */
export default function MultipleChoice({ options, disabledIds, onGuess }: {
  options: Player[]
  disabledIds: string[]
  onGuess: (playerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((p) => {
        const disabled = disabledIds.includes(p.id)
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onGuess(p.id)}
            className="rounded-sm border border-chalk bg-room-deep px-3 py-3 text-left font-body text-sm text-paper transition-colors hover:border-flag hover:bg-flag hover:text-ink disabled:opacity-40 disabled:hover:border-chalk disabled:hover:bg-room-deep disabled:hover:text-paper"
          >
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
