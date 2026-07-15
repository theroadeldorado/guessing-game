import { POINTS } from '@/lib/game'

const DOWNS = ['1ST', '2ND', '3RD']

/**
 * The guess tiers as down-and-distance: 1ST ·100 / 2ND ·50 / 3RD ·25.
 * The live down burns flag-yellow; spent downs are struck through.
 */
export default function DownMarkers({ level }: { level: number }) {
  return (
    <div className="flex gap-2 font-mono text-xs tracking-widest" aria-label={`Guess ${level + 1} of 3`}>
      {DOWNS.map((down, i) => {
        const spent = i < level
        const live = i === level
        return (
          <span
            key={down}
            className={`flex-1 rounded-sm border px-2 py-1.5 text-center transition-colors ${
              live
                ? 'border-flag bg-flag text-ink'
                : spent
                  ? 'border-chalk text-chalk-soft line-through opacity-50'
                  : 'border-chalk text-chalk-soft'
            }`}
          >
            {down} ·{POINTS[i]}
          </span>
        )
      })}
    </div>
  )
}
