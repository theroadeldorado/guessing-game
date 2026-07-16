import type { Player } from '@/lib/types'
import type { ClipResult } from '@/lib/game'

/** The answer, film-room style: point stamp, nameplate, career line. */
export default function RevealCard({ player, result, nextLabel, onNext }: {
  player: Player
  result: ClipResult
  nextLabel: string
  onNext: () => void
}) {
  return (
    <div className="sf-rise space-y-3 py-2 text-center">
      <p
        className={`sf-stamp inline-block rounded-sm border-2 px-3 py-1 font-mono text-sm font-bold tracking-widest ${
          result.solved ? 'border-flag text-flag' : 'border-red-400 text-red-400'
        }`}
      >
        {result.solved ? `+${result.points} PTS` : 'RUN OVER'}
      </p>
      <h2 className="font-display text-4xl uppercase tracking-wide text-paper">{player.name}</h2>
      <p className="font-mono text-sm text-chalk-soft">
        {player.detail.join(' · ')} · {player.yearsActive}
      </p>
      <button
        onClick={onNext}
        autoFocus
        className="mt-2 w-full rounded-sm bg-paper px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
      >
        {result.solved ? `${nextLabel} →` : 'See final score'}
      </button>
    </div>
  )
}
