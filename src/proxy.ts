import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import clipsJson from '@/data/clips.json'
import { clipAlias } from '@/lib/clipalias'

// Opaque alias -> real clip id, precomputed from the pool. The public URL is
// `/c/<alias><-slo?>.<ext>`; we rewrite it to the static `/clips/<id>…` file so
// the video filename never leaks the answer, while CDN caching and HTTP range
// (which iOS needs) are preserved by the static rewrite target.
const aliasToId = new Map<string, string>()
for (const c of clipsJson as { id: string }[]) aliasToId.set(clipAlias(c.id), c.id)

const CLIP_RE = /^\/c\/([a-z0-9]+)(-slo)?\.(webm|mp4|jpg)$/

export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(CLIP_RE)
  if (!match) return NextResponse.next()
  const [, alias, slo = '', ext] = match
  const id = aliasToId.get(alias)
  if (!id) return new NextResponse('Not found', { status: 404 })
  const url = request.nextUrl.clone()
  url.pathname = `/clips/${id}${slo}.${ext}`
  return NextResponse.rewrite(url)
}

export const config = { matcher: '/c/:path*' }
