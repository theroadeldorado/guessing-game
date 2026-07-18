'use client'

import { useState } from 'react'
import type { ClipResult, RunState } from '@/lib/game'
import { shareQuery, shareText, SITE_URL, toShareData } from '@/lib/share'

const resultEmoji = (r: ClipResult) =>
  !r.solved ? '💀' : r.guessesUsed === 1 ? '💯' : r.guessesUsed === 2 ? '🎯' : '🤏'

interface ShareSport {
  id: string
  emoji: string
  athleteNoun: string
  athleteNounPlural: string
}

/** Final whistle: score, run log, share, run it back. */
export default function GameOver({ state, sport, best, onRestart }: {
  state: RunState
  sport: ShareSport
  best: number
  onRestart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const solved = state.history.filter((r) => r.solved).length
  const isNewBest = state.score >= best && state.score > 0

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const data = toShareData(state, sport.id)
      const query = shareQuery(data)
      const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL
      const url = `${origin}/share?${query}`
      const message = shareText(data, sport)

      // Best case (mobile): attach the result card image + link to the native
      // share sheet, so it lands in Messages/WhatsApp/etc. exactly like a text.
      try {
        const res = await fetch(`/api/og?${query}`)
        if (res.ok && typeof File !== 'undefined') {
          const file = new File([await res.blob()], 'shadowform.png', { type: 'image/png' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: `${message}\n${url}` })
            return
          }
        }
      } catch {
        // fall through to link-only share / copy
      }

      if (navigator.share) {
        await navigator.share({ text: message, url })
        return
      }

      await navigator.clipboard.writeText(`${message}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // user dismissed the share sheet, or share failed — no-op
    } finally {
      setSharing(false)
    }
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
          disabled={sharing}
          className="flex-1 rounded-sm border border-paper/40 px-6 py-3 font-display text-lg uppercase tracking-wide text-paper transition-colors hover:border-flag hover:text-flag disabled:opacity-50"
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
