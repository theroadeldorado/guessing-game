import { NextResponse } from 'next/server'
import {
  devToolsEnabled, listDevClips, setClipCrop, setClipSpeed, setClipSrc, updateManifestEntry,
} from '@/lib/devtools'

export async function GET() {
  if (!devToolsEnabled()) return NextResponse.json({ error: 'dev only' }, { status: 404 })
  return NextResponse.json(listDevClips())
}

/**
 * PATCH { id, source?, start?, end?, crop?, flagged?, speed? }
 * Flagging pulls the clip out of the game (placeholder); unflagging restores
 * the real webm if it exists. `crop` ('auto' | 'cx,cy,zoom') is render-time
 * framing in clips.json. It takes effect immediately, no reprocess needed.
 */
export async function PATCH(req: Request) {
  if (!devToolsEnabled()) return NextResponse.json({ error: 'dev only' }, { status: 404 })
  try {
    const { id, source, start, end, crop, flagged, speed } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const entry = updateManifestEntry(id, { source, start, end, flagged })
    if (crop !== undefined) setClipCrop(id, crop)
    if (speed !== undefined) setClipSpeed(id, Number(speed))
    let src: string | undefined
    if (flagged === true) src = setClipSrc(id, false)
    if (flagged === false) src = setClipSrc(id, true)
    return NextResponse.json({ entry, src })
  } catch (e) {
    // Always answer with JSON so the client shows the reason instead of
    // choking on an empty body ("Unexpected end of JSON input").
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
