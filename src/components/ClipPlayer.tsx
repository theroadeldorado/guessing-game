'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

export const DEFAULT_FULL_SPEED = 4 // most source footage is ~4x slow-mo

/**
 * The projection screen: a real clip loops muted, or the placeholder
 * silhouette animates. Source footage is mostly slow-mo, so real clips play
 * at `speed` (approximating real time) by default with a slo-mo toggle.
 * Reduced-motion users get a paused frame with an explicit play control.
 * `preloadSrc` warms the next clip while guessing.
 */
export default function ClipPlayer({ src, seed, variant, speed, preloadSrc }: {
  src: string
  seed: string
  variant: SilhouetteVariant
  speed?: number
  preloadSrc?: string
}) {
  const reducedMotion = useReducedMotion()
  const [playAnyway, setPlayAnyway] = useState(false)
  const [slowMo, setSlowMo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideo = src !== 'placeholder'
  const paused = reducedMotion && !playAnyway
  const rate = slowMo ? 1 : (speed ?? DEFAULT_FULL_SPEED)

  const applyRate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    // defaultPlaybackRate too: loading a resource resets playbackRate, and
    // cached videos can finish loading before the loadedmetadata handler
    // attaches — the default survives that reset.
    v.defaultPlaybackRate = rate
    v.playbackRate = rate
  }, [rate])

  useEffect(applyRate, [applyRate, src])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-chalk bg-black text-paper">
      {isVideo ? (
        // <source> pair, not a bare src: Safari (especially iOS) can't decode
        // VP9 WebM and needs the H.264 MP4 the pipeline exports alongside it.
        <video
          ref={videoRef}
          key={src}
          className="h-full w-full object-contain"
          poster={src.replace(/\.webm$/, '.jpg')}
          autoPlay={!paused}
          loop
          muted
          playsInline
          onLoadedMetadata={applyRate}
        >
          <source src={src} type="video/webm" />
          <source src={src.replace(/\.webm$/, '.mp4')} type="video/mp4" />
        </video>
      ) : (
        <div className={paused ? 'h-full w-full [&_*]:!animate-none' : 'h-full w-full'}>
          <PlaceholderSilhouette seed={seed} variant={variant} />
        </div>
      )}
      {isVideo && !paused && (
        <button
          onClick={() => setSlowMo((s) => !s)}
          className={`absolute right-2 bottom-2 rounded-sm border px-2.5 py-1 font-mono text-[11px] tracking-wider ${
            slowMo
              ? 'border-flag bg-flag text-ink'
              : 'border-chalk bg-black/60 text-chalk-soft hover:border-paper hover:text-paper'
          }`}
          aria-pressed={slowMo}
        >
          {slowMo ? '🐌 SLO-MO' : 'SLO-MO'}
        </button>
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
        <video preload="auto" muted className="hidden" aria-hidden>
          <source src={preloadSrc} type="video/webm" />
          <source src={preloadSrc.replace(/\.webm$/, '.mp4')} type="video/mp4" />
        </video>
      )}
    </div>
  )
}
