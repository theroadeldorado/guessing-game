'use client'

import { useState, useSyncExternalStore } from 'react'
import PlaceholderSilhouette, { type SilhouetteVariant } from './PlaceholderSilhouette'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  )
}

/**
 * The projection screen: a real clip loops muted, or the placeholder
 * silhouette animates. Reduced-motion users get a paused frame with an
 * explicit play control. `preloadSrc` warms the next clip while guessing.
 */
export default function ClipPlayer({ src, seed, variant, preloadSrc }: {
  src: string
  seed: string
  variant: SilhouetteVariant
  preloadSrc?: string
}) {
  const reducedMotion = useReducedMotion()
  const [playAnyway, setPlayAnyway] = useState(false)

  const isVideo = src !== 'placeholder'
  const paused = reducedMotion && !playAnyway

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-chalk bg-black text-paper">
      {isVideo ? (
        <video
          key={src}
          src={src}
          className="h-full w-full object-contain"
          autoPlay={!paused}
          loop
          muted
          playsInline
        />
      ) : (
        <div className={paused ? 'h-full w-full [&_*]:!animate-none' : 'h-full w-full'}>
          <PlaceholderSilhouette seed={seed} variant={variant} />
        </div>
      )}
      {paused && (
        <button
          onClick={() => setPlayAnyway(true)}
          className="absolute inset-0 grid place-items-center text-4xl text-paper/70"
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
