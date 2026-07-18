import type { ReactNode } from 'react'

/**
 * Golf-scorecard notation around a number (the strokes taken):
 *   ≤ −2  double circle (eagle / albatross / ace)
 *   −1    single circle (birdie)
 *    0    bare number   (par)
 *   +1    single square (bogey)
 *   ≥ +2  double square (double bogey)
 * Gold under par, red over, paper at par.
 */
export default function ScoreMark({ toPar, children }: { toPar: number; children: ReactNode }) {
  const color = toPar < 0 ? 'text-flag' : toPar > 0 ? 'text-red-400' : 'text-paper'
  const isCircle = toPar <= -1
  const isSquare = toPar >= 1
  const doubled = toPar <= -2 || toPar >= 2
  const round = isCircle ? 'rounded-full' : 'rounded-[3px]'

  return (
    <div className={`relative grid h-20 w-20 place-items-center ${color}`}>
      {(isCircle || isSquare) && (
        <span className={`pointer-events-none absolute inset-0 border-[3px] border-current ${round}`} />
      )}
      {doubled && (
        <span className={`pointer-events-none absolute inset-2 border-[3px] border-current ${round}`} />
      )}
      <span className="font-display text-4xl leading-none">{children}</span>
    </div>
  )
}
