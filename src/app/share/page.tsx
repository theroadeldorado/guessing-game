import type { Metadata } from 'next'
import Link from 'next/link'
import { getSport } from '@/lib/data'
import { parseShareData, resultsEmoji, shareQuery } from '@/lib/share'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') u.set(k, v)
  return u
}

function sportNoun(sportId: string, solved: number): string {
  try {
    const s = getSport(sportId)
    return (solved === 1 ? s.athleteNoun : s.athleteNounPlural).toLowerCase()
  } catch {
    return 'athletes'
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const d = parseShareData(toParams(await searchParams))
  const ogUrl = `/api/og?${shareQuery(d)}`
  const title = `ShadowForm — ${d.score} pts`
  const description = `I ID'd ${d.solved} ${sportNoun(d.sport, d.solved)} for ${d.score} pts. Think you can beat my run?`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  }
}

export default async function SharePage({ searchParams }: { searchParams: SearchParams }) {
  const d = parseShareData(toParams(await searchParams))
  const ogUrl = `/api/og?${shareQuery(d)}`

  return (
    <main className="sf-rise mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">
        A ShadowForm run
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogUrl}
        alt={`ShadowForm — ${d.score} points, ${d.solved} ${sportNoun(d.sport, d.solved)} identified`}
        width={1200}
        height={630}
        className="w-full rounded-md border border-chalk"
      />
      <p className="text-xl leading-relaxed text-paper">
        Someone just went <span className="font-display text-flag">{d.score} pts</span>.
        {' '}Your turn.
      </p>
      {d.results && (
        <p className="break-all text-2xl leading-relaxed">{resultsEmoji(d.results)}</p>
      )}
      <Link
        href="/"
        className="mt-2 rounded-sm bg-paper px-8 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
      >
        Play ShadowForm
      </Link>
    </main>
  )
}
