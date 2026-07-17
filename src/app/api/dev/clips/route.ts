import { NextResponse } from 'next/server'
import {
  devToolsEnabled, listDevClips, setClipSpeed, setClipSrc, updateManifestEntry,
} from '@/lib/devtools'

export async function GET() {
  if (!devToolsEnabled()) return NextResponse.json({ error: 'dev only' }, { status: 404 })
  return NextResponse.json(listDevClips())
}

/**
 * PATCH { id, source?, start?, end?, flagged? }
 * Flagging pulls the clip out of the game (placeholder); unflagging restores
 * the real webm if it exists.
 */
export async function PATCH(req: Request) {
  if (!devToolsEnabled()) return NextResponse.json({ error: 'dev only' }, { status: 404 })
  const { id, source, start, end, flagged, speed } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const entry = updateManifestEntry(id, { source, start, end, flagged })
  if (speed !== undefined) setClipSpeed(id, Number(speed))
  let src: string | undefined
  if (flagged === true) src = setClipSrc(id, false)
  if (flagged === false) src = setClipSrc(id, true)
  return NextResponse.json({ entry, src })
}
