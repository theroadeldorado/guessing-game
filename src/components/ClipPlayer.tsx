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

const swapExt = (src: string, ext: string) => src.replace(/\.webm(?=[?#]|$)/, ext)

/** Full-speed and slo-mo are separate pipeline exports (<id> / <id>-slo) —
 * playbackRate is unreliable on iOS, so the toggle swaps files instead. */
const sloVariant = (src: string) => swapExt(src, '-slo.webm')

/**
 * We serve the H.264 MP4 directly instead of offering both formats via
 * <source>. Since iOS 17.4 Safari reports VP9 WebM as playable and *selects*
 * the .webm, then fails to decode it reliably — and <source> fallback only
 * fires at selection time, not on decode failure. The pipeline exports a
 * matching MP4 (avc1 / yuv420p / faststart / no audio) for every clip, and
 * H.264 MP4 plays on every current browser, so there's no reason to gamble on
 * WebM selection. Verified server-side: video/mp4 with byte-range (206) support.
 */
const mp4Variant = (src: string) => swapExt(src, '.mp4')

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
  const activeSrc = mp4Variant(slowMo ? sloVariant(src) : src)
  // Framing is a CSS viewport transform; AUTO clips keep the plain object-contain
  // path (unchanged), so only deliberately-cropped clips take the transform.
  const framing = parseCrop(crop)
  const cropped = !isAuto(framing)

  // iOS blocks even muted autoplay in Low Power Mode — fall back to a tap. Set
  // muted before play() and wait for playable data, which iOS wants before it
  // will honor a programmatic play().
  useEffect(() => {
    if (!isVideo || paused) return
    const v = videoRef.current
    if (!v) return
    setNeedsTap(false)
    v.defaultMuted = true
    v.muted = true
    const start = () => void v.play().catch(() => setNeedsTap(true))
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) start()
    else v.addEventListener('canplay', start, { once: true })
    return () => v.removeEventListener('canplay', start)
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
          src={activeSrc}
          className={cropped ? 'absolute' : 'h-full w-full object-contain'}
          style={cropped ? cropStyle(aspect, framing) : undefined}
          poster={swapExt(src, '.jpg')}
          preload="auto"
          autoPlay={!paused}
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (cropped && v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight)
          }}
          onEnded={(e) => {
            // Belt-and-suspenders: some iOS builds drop the loop on muted inline video.
            const v = e.currentTarget
            v.currentTime = 0
            void v.play().catch(() => setNeedsTap(true))
          }}
          onError={(e) => {
            const v = e.currentTarget
            console.error('clip playback failed', {
              currentSrc: v.currentSrc,
              code: v.error?.code,
              message: v.error?.message,
            })
          }}
        />
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
        <video
          src={mp4Variant(preloadSrc)}
          preload="metadata"
          muted
          playsInline
          className="hidden"
          aria-hidden
        />
      )}
    </div>
  )
}
