import { NextResponse } from 'next/server'
import { dailyGuessResult, dailyHoleView, golfDate } from '@/lib/daily'

// The Daily Round runs server-side so the answer never reaches the browser.
// GET  -> today's hole (video + par + field), no golfer.
// POST { date, guesses } -> right/wrong + next field; the answer is returned
// only once the hole is done (solved or the budget is spent).

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(dailyHoleView())
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const guesses: string[] = Array.isArray(body?.guesses)
    ? body.guesses.filter((g: unknown): g is string => typeof g === 'string').slice(0, 12)
    : []
  // Always score against today's hole regardless of a client-supplied date, so
  // a stale/forged date can't pull a different day's answer.
  return NextResponse.json(dailyGuessResult(golfDate(), guesses))
}
