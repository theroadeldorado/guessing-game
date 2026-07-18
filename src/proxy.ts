import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import clipsJson from '@/data/clips.json'
import { clipAlias } from '@/lib/clipalias'
import { dailyClip, dailyVideoToken, golfDate } from '@/lib/daily'

// Opaque alias -> real clip id, precomputed from the pool. The public URL is
// `/c/<alias><-slo?>.<ext>`; we rewrite it to the static `/clips/<id>…` file so
// the video filename never leaks the answer, while CDN caching and HTTP range
// (which iOS needs) are preserved by the static rewrite target.
const aliasToId = new Map<string, string>()
for (const c of clipsJson as { id: string }[]) aliasToId.set(clipAlias(c.id), c.id)

const CLIP_RE = /^\/c\/([a-z0-9]+)(-slo)?\.(webm|mp4|jpg)$/
// The daily video lives under a per-day token (not a clips.json alias) so it
// can't be mapped to the golfer from the bundle; resolve it to today's clip.
const DAILY_RE = /^\/c\/daily\/([a-z0-9]+)(-slo)?\.(webm|mp4|jpg)$/

function rewriteTo(request: NextRequest, id: string, slo: string, ext: string) {
  const url = request.nextUrl.clone()
  url.pathname = `/clips/${id}${slo}.${ext}`
  return NextResponse.rewrite(url)
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const daily = path.match(DAILY_RE)
  if (daily) {
    const [, token, slo = '', ext] = daily
    const date = golfDate()
    if (token !== dailyVideoToken(date)) return new NextResponse('Not found', { status: 404 })
    return rewriteTo(request, dailyClip(date).id, slo, ext)
  }

  const match = path.match(CLIP_RE)
  if (!match) return NextResponse.next()
  const [, alias, slo = '', ext] = match
  const id = aliasToId.get(alias)
  if (!id) return new NextResponse('Not found', { status: 404 })
  return rewriteTo(request, id, slo, ext)
}

export const config = { matcher: '/c/:path*' }
