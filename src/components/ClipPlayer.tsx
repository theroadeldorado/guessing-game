'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PlaceholderSilhouette, { type SilhouetteVariant } from './PlaceholderSilhouette'
import { cropStyle, isAuto, parseCrop } from '@/lib/crop'

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

/** Full-speed and slo-mo are separate pipeline exports (<id> / <id>-slo) —
 * playbackRate is unreliable on iOS, so the toggle swaps files instead. */
const sloVariant = (src: string) => src.replace(/\.webm$/, '-slo.webm')

/** Both-format sources: Safari (especially iOS) can't decode VP9 WebM and
 * needs the H.264 MP4 the pipeline exports alongside every clip. The explicit
 * `codecs="vp9"` is load-bearing — without it iOS Safari reports generic
 * `video/webm` as playable, *selects* the WebM, then fails to decode it (source
 * fallback only fires at selection time, not on decode failure). Naming the
 * codec makes canPlayType return "" on iOS so it falls through to the MP4. */
function Sources({ webm }: { webm: string }) {
  return (
    <>
      <source src={webm} type='video/webm; codecs="vp9"' />
      <source src={webm.replace(/\.webm$/, '.mp4')} type="video/mp4" />
    </>
  )
}

/**
 * The projection screen: a real clip loops muted (full speed by default,
 * slo-mo on toggle), or the placeholder silhouette animates. Reduced-motion
 * users get a poster with an explicit play control; blocked autoplay (iOS
 * Low Power Mode) falls back to tap-to-play. `preloadSrc` warms the next
 * clip while guessing.
 */
export default function ClipPlayer({ src, seed, variant, preloadSrc, crop }: {
  src: string
  seed: string
  variant: SilhouetteVariant
  preloadSrc?: string
  crop?: string
}) {
  const reducedMotion = useReducedMotion()
  const [playAnyway, setPlayAnyway] = useState(false)
  const [slowMo, setSlowMo] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [aspect, setAspect] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideo = src !== 'placeholder'
  const paused = reducedMotion && !playAnyway
  const activeSrc = slowMo ? sloVariant(src) : src
  // Framing is a CSS viewport transform; AUTO clips keep the plain object-contain
  // path (unchanged), so only deliberately-cropped clips take the transform.
  const framing = parseCrop(crop)
  const cropped = !isAuto(framing)

  // iOS blocks even muted autoplay in Low Power Mode — fall back to a tap.
  useEffect(() => {
    if (!isVideo || paused) return
    setNeedsTap(false)
    const v = videoRef.current
    v?.play().catch(() => setNeedsTap(true))
  }, [isVideo, paused, activeSrc])

  const tapToPlay = () => {
    videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true))
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-chalk bg-black text-paper">
      {isVideo ? (
        <video
          ref={videoRef}
          key={activeSrc}
          className={cropped ? 'absolute' : 'h-full w-full object-contain'}
          style={cropped ? cropStyle(aspect, framing) : undefined}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (cropped && v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight)
          }}
          poster={src.replace(/\.webm$/, '.jpg')}
          autoPlay={!paused}
          loop
          muted
          playsInline
        >
          <Sources webm={activeSrc} />
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
      {isVideo && !paused && needsTap && (
        <button
          onClick={tapToPlay}
          className="absolute inset-0 grid place-items-center text-4xl text-paper/70"
          aria-label="Play clip"
        >
          ▶
        </button>
      )}
      {preloadSrc && preloadSrc !== 'placeholder' && (
        <video preload="auto" muted className="hidden" aria-hidden>
          <Sources webm={preloadSrc} />
        </video>
      )}
    </div>
  )
}
