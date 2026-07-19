import type { Metadata } from 'next'
import Link from 'next/link'
import {
  dailyShareQuery,
  labelFor,
  parseDailyShare,
  shareStrokes,
  toParText,
} from '@/lib/daily'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') u.set(k, v)
  return u
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams
}): Promise<Metadata> {
  const s = parseDailyShare(toParams(await searchParams))
  const ogUrl = `/api/og?${dailyShareQuery(s)}`
  const label = labelFor(s.solved, shareStrokes(s), s.par)
  const title = `ShadowForm Daily: ${label}`
  const description = `Streak ${s.streak} · ${toParText(s.toPar)}. Think you can keep yours alive?`
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

export default async function DailySharePage({ searchParams }: { searchParams: SearchParams }) {
  const s = parseDailyShare(toParams(await searchParams))
  const ogUrl = `/api/og?${dailyShareQuery(s)}`
  const label = labelFor(s.solved, shareStrokes(s), s.par)

  return (
    <main className="sf-rise mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-chalk-soft">
        A ShadowForm Daily Round
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogUrl}
        alt={`ShadowForm Daily: ${label}, streak ${s.streak}`}
        width={1200}
        height={630}
        className="w-full rounded-md border border-chalk"
      />
      <p className="text-xl leading-relaxed text-paper">
        Someone just carded a <span className="font-display text-flag">{label}</span>.
        {' '}Your tee time&apos;s waiting.
      </p>
      <Link
        href="/daily"
        className="mt-2 rounded-sm bg-paper px-8 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:bg-flag"
      >
        Play today&apos;s hole
      </Link>
    </main>
  )
}
