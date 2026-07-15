'use client'

import { useEffect, useState } from 'react'
import PlaceholderSilhouette from './PlaceholderSilhouette'

/**
 * The projection screen: a real clip loops muted, or the placeholder
 * silhouette animates. Reduced-motion users get a paused frame with an
 * explicit play control. `preloadSrc` warms the next clip while guessing.
 */
export default function ClipPlayer({ src, seed, preloadSrc }: {
  src: string
  seed: string
  preloadSrc?: string
}) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [playAnyway, setPlayAnyway] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isVideo = src !== 'placeholder'
  const paused = reducedMotion && !playAnyway

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-paper text-ink shadow-[0_0_60px_rgba(245,242,236,0.08)]">
      {isVideo ? (
        <video
          key={src}
          src={src}
          className="h-full w-full object-cover"
          autoPlay={!paused}
          loop
          muted
          playsInline
        />
      ) : (
        <div className={paused ? 'h-full w-full [&_*]:!animate-none' : 'h-full w-full'}>
          <PlaceholderSilhouette seed={seed} />
        </div>
      )}
      {paused && (
        <button
          onClick={() => setPlayAnyway(true)}
          className="absolute inset-0 grid place-items-center text-4xl text-ink/70"
          aria-label="Play clip"
        >
          ▶
        </button>
      )}
      {preloadSrc && preloadSrc !== 'placeholder' && (
        <video src={preloadSrc} preload="auto" muted className="hidden" aria-hidden />
      )}
    </div>
  )
}
