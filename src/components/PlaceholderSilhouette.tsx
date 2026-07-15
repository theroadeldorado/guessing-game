'use client'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Dev stand-in for a real silhouette clip: a black figure mid-throw on the
 * paper field, arm cycling on a loop. Seeded by playerId so each QB's
 * placeholder differs slightly in tempo and lean.
 */
export default function PlaceholderSilhouette({ seed }: { seed: string }) {
  const h = hash(seed)
  const dur = 1.2 + (h % 5) * 0.2 // 1.2s–2.0s throw cycle
  const lean = -4 - (h % 7) // torso lean varies per player
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-label="Silhouette clip placeholder">
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
    </svg>
  )
}
