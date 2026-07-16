'use client'

import { useMemo, useState } from 'react'
import type { Player } from '@/lib/types'
import { searchPlayers } from '@/lib/search'

/**
 * Autocomplete combobox. Guesses can only be submitted by selecting a
 * suggestion (keyboard or pointer) — free text never submits, so spelling
 * never costs a guess. Already-guessed players render dimmed and inert.
 */
export default function GuessInput({ players, placeholder, disabledIds, onGuess }: {
  players: Player[]
  placeholder: string
  disabledIds: string[]
  onGuess: (playerId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const results = useMemo(() => searchPlayers(players, query), [players, query])

  const select = (p: Player) => {
    if (disabledIds.includes(p.id)) return
    onGuess(p.id)
    setQuery('')
    setHighlight(0)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && results[highlight]) {
      e.preventDefault()
      select(results[highlight])
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="athlete-listbox"
        aria-autocomplete="list"
        aria-label="Guess the athlete"
        className="w-full rounded-sm border border-chalk bg-room-deep px-4 py-3 text-paper placeholder:text-chalk-soft focus:border-flag focus:outline-none"
      />
      {results.length > 0 && (
        <ul
          id="athlete-listbox"
          role="listbox"
          className="absolute bottom-full z-10 mb-1 max-h-64 w-full overflow-y-auto rounded-sm border border-chalk bg-room-deep shadow-xl"
        >
          {results.map((p, i) => {
            const disabled = disabledIds.includes(p.id)
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={i === highlight}
                aria-disabled={disabled}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(p)
                }}
                className={`cursor-pointer px-4 py-2.5 ${i === highlight ? 'bg-flag text-ink' : 'text-paper'} ${
                  disabled ? 'cursor-not-allowed opacity-40' : ''
                }`}
              >
                {p.name}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
