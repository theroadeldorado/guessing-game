'use client'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export type SilhouetteVariant = 'throw' | 'swing'

function ThrowFigure({ seed }: { seed: string }) {
  const h = hash(seed)
  const dur = 1.2 + (h % 5) * 0.2 // 1.2s–2.0s throw cycle
  const lean = -4 - (h % 7) // torso lean varies per player
  return (
    <g fill="currentColor" transform={`rotate(${lean} 100 120)`}>
      <circle cx="100" cy="48" r="16" />
      <rect x="86" y="62" width="28" height="55" rx="10" />
      {/* back leg */}
      <rect x="84" y="112" width="11" height="52" rx="5" transform="rotate(18 90 112)" />
      {/* front leg */}
      <rect x="103" y="112" width="11" height="52" rx="5" transform="rotate(-12 108 112)" />
      {/* off arm */}
      <rect x="76" y="66" width="10" height="40" rx="5" transform="rotate(35 81 66)" />
      {/* throwing arm */}
      <g style={{ transformOrigin: '108px 70px', animation: `sf-throw ${dur}s ease-in-out infinite` }}>
        <rect x="104" y="62" width="10" height="44" rx="5" />
        <ellipse cx="112" cy="110" rx="9" ry="6" />
      </g>
    </g>
  )
}

function SwingFigure({ seed }: { seed: string }) {
  const h = hash(seed)
  const dur = 1.8 + (h % 5) * 0.25 // 1.8s–2.8s swing cycle
  const stance = -2 - (h % 5) // address posture varies per player
  return (
    <g fill="currentColor" transform={`rotate(${stance} 100 120)`}>
      <circle cx="96" cy="52" r="15" />
      {/* torso, tilted over the ball */}
      <rect x="84" y="64" width="26" height="52" rx="10" transform="rotate(12 97 90)" />
      {/* back leg */}
      <rect x="82" y="110" width="11" height="54" rx="5" transform="rotate(8 88 110)" />
      {/* front leg */}
      <rect x="100" y="110" width="11" height="54" rx="5" transform="rotate(-6 106 110)" />
      {/* arms + club, swinging from the shoulders */}
      <g style={{ transformOrigin: '100px 74px', animation: `sf-swing ${dur}s ease-in-out infinite` }}>
        <rect x="96" y="68" width="9" height="38" rx="4" transform="rotate(-8 100 74)" />
        {/* club shaft */}
        <rect x="99" y="100" width="5" height="58" rx="2" transform="rotate(-14 101 104)" />
        {/* club head */}
        <ellipse cx="116" cy="158" rx="10" ry="5" transform="rotate(-14 101 104)" />
      </g>
      {/* ball */}
      <circle cx="122" cy="168" r="4" />
    </g>
  )
}

/**
 * Dev stand-in for a real silhouette clip: a black figure on the paper
 * field cycling its sport's signature motion. Seeded by playerId so each
 * athlete's placeholder differs slightly in tempo and posture.
 */
export default function PlaceholderSilhouette({ seed, variant = 'throw' }: {
  seed: string
  variant?: SilhouetteVariant
}) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-label="Silhouette clip placeholder">
      {variant === 'swing' ? <SwingFigure seed={seed} /> : <ThrowFigure seed={seed} />}
    </svg>
  )
}
