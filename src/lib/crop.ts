import type { CSSProperties } from 'react'

/**
 * Render-time framing for a clip. The source video is always the whole,
 * letterboxed frame; a crop pans/zooms a square viewport over it purely in CSS
 * (iOS-safe, unlike baking playbackRate). `cx,cy` are the normalized [0,1]
 * center of the viewport in the frame; `zoom >= 1` tightens (1 = whole frame).
 * Serialized in clips.json as 'auto' or 'cx,cy,zoom'.
 */
export interface Crop {
  cx: number
  cy: number
  zoom: number
}

export const AUTO_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function parseCrop(crop?: string): Crop {
  if (!crop || crop === 'auto') return { ...AUTO_CROP }
  const [cx, cy, zoom] = crop.split(',').map(Number)
  return {
    cx: clamp(cx || 0.5, 0, 1),
    cy: clamp(cy || 0.5, 0, 1),
    zoom: clamp(zoom || 1, 1, MAX_ZOOM),
  }
}

export function serializeCrop({ cx, cy, zoom }: Crop): string {
  if (cx === 0.5 && cy === 0.5 && zoom === 1) return 'auto'
  return `${cx.toFixed(3)},${cy.toFixed(3)},${zoom.toFixed(2)}`
}

export const MAX_ZOOM = 6
export const isAuto = (c: Crop) => c.cx === 0.5 && c.cy === 0.5 && c.zoom === 1

/**
 * Absolute-position style for a `<video>` inside a square, overflow-hidden box
 * so the crop's viewport fills the box. `aspect` is the video's intrinsic
 * width/height. At AUTO this reproduces `object-contain` (centered, letterboxed).
 */
export function cropStyle(aspect: number, { cx, cy, zoom }: Crop): CSSProperties {
  const bwf = aspect >= 1 ? 1 : aspect // base fit width, as a fraction of the box
  const bhf = aspect >= 1 ? 1 / aspect : 1
  const dispWf = bwf * zoom
  const dispHf = bhf * zoom
  return {
    position: 'absolute',
    left: `${(0.5 - cx * dispWf) * 100}%`,
    top: `${(0.5 - cy * dispHf) * 100}%`,
    width: `${dispWf * 100}%`,
    height: `${dispHf * 100}%`,
  }
}
