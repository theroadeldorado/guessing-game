import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSport } from '@/lib/data'
import { labelFor, parseDailyShare, shareStrokes, toParText, WEEKDAYS } from '@/lib/daily'
import { outcomeOf, parseShareData, SITE_HOST } from '@/lib/share'

// ShadowForm palette (globals.css)
const ROOM = '#17140f'
const PAPER = '#f5f2ec'
const FLAG = '#ffc53d'
const CHALK = 'rgba(245, 242, 236, 0.14)'
const CHALK_SOFT = 'rgba(245, 242, 236, 0.55)'

const PIP: Record<string, { background: string; border?: string }> = {
  ace: { background: FLAG },
  good: { background: PAPER },
  squeak: { background: 'rgba(245, 242, 236, 0.45)' },
  miss: { background: 'transparent', border: `3px solid ${CHALK}` },
}

export const contentType = 'image/png'
const SIZE = { width: 1200, height: 630 }

const RED = '#f87171'

/** Golf-scorecard mark for the OG card: circle(s) under par, square(s) over. */
function scoreMarkOG(toPar: number, strokes: number) {
  const color = toPar < 0 ? FLAG : toPar > 0 ? RED : PAPER
  const shaped = toPar <= -1 || toPar >= 1
  const doubled = toPar <= -2 || toPar >= 2
  const radius = toPar <= -1 ? 999 : 22
  return (
    <div
      style={{
        position: 'relative',
        width: 168,
        height: 168,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}
    >
      {shaped && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: `10px solid ${color}`, borderRadius: radius }}
        />
      )}
      {doubled && (
        <div
          style={{ position: 'absolute', top: 17, left: 17, right: 17, bottom: 17, border: `10px solid ${color}`, borderRadius: toPar <= -1 ? 999 : 13 }}
        />
      )}
      <div style={{ fontSize: 108 }}>{String(strokes)}</div>
    </div>
  )
}

/** The Daily Round result card — spoiler-free (score + streak, never the golfer). */
async function renderDaily(params: URLSearchParams, anton: Buffer) {
  const s = parseDailyShare(params)
  const strokes = shareStrokes(s)
  const label = labelFor(s.solved, strokes, s.par)
  const day = WEEKDAYS[((s.weekday % 7) + 7) % 7]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: ROOM,
          padding: 64,
          fontFamily: 'Anton',
          color: PAPER,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontSize: 48, letterSpacing: 2 }}>
            <span>SHADOW</span>
            <span style={{ color: FLAG }}>FORM</span>
          </div>
          <div style={{ fontSize: 24, color: CHALK_SOFT, letterSpacing: 4 }}>DAILY ROUND</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 28, color: CHALK_SOFT, letterSpacing: 4, marginBottom: 14 }}>
            {`${day} · ${s.yards} YD · PAR ${s.par}`}
          </div>
          {scoreMarkOG(s.scoreToPar, strokes)}
          <div style={{ fontSize: 72, marginTop: 10 }}>{label.toUpperCase()}</div>
          <div style={{ fontSize: 36, color: s.toPar < 0 ? FLAG : CHALK_SOFT, marginTop: 4 }}>
            {`STREAK ${s.streak} · ${toParText(s.toPar).toUpperCase()}`}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 42, letterSpacing: 1 }}>KEEP YOUR STREAK</div>
          <div style={{ fontSize: 32, color: FLAG }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    { ...SIZE, fonts: [{ name: 'Anton', data: anton, weight: 400, style: 'normal' }] },
  )
}

/**
 * The shareable result card. Rendered from URL params (no DB) so the same image
 * serves both the link's OG/Twitter preview and the file attached to the native
 * share sheet. Colored pips instead of emoji — on-brand, and no twemoji fetch.
 * Satori is strict: every element with >1 child must be display:flex.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const anton = await readFile(join(process.cwd(), 'assets', 'Anton-Regular.ttf'))

  if (params.has('d')) return renderDaily(params, anton)

  const isResult = params.has('s')
  const d = parseShareData(params)
  let sport
  try {
    sport = getSport(d.sport)
  } catch {
    sport = getSport('golf')
  }
  const noun = d.solved === 1 ? sport.athleteNoun : sport.athleteNounPlural
  const pips = [...d.results].slice(0, 60)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: ROOM,
          padding: 72,
          fontFamily: 'Anton',
          color: PAPER,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: 52, letterSpacing: 2 }}>
              <span>SHADOW</span>
              <span style={{ color: FLAG }}>FORM</span>
            </div>
            <div style={{ fontSize: 26, color: CHALK_SOFT, letterSpacing: 4 }}>
              {sport.label.toUpperCase()}
            </div>
          </div>
          <div style={{ height: 3, background: CHALK, marginTop: 24 }} />
        </div>

        {/* middle — result card, or brand tagline when there's no score */}
        {isResult ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: 230, lineHeight: 1 }}>{String(d.score)}</div>
              <div style={{ fontSize: 56, color: CHALK_SOFT, marginLeft: 20 }}>PTS</div>
            </div>
            <div style={{ fontSize: 34, color: CHALK_SOFT, marginTop: 10 }}>
              {`${d.solved} ${noun.toLowerCase()} identified`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 30 }}>
              {pips.map((digit, i) => {
                const style = PIP[outcomeOf(digit)]
                return (
                  <div
                    key={i}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      marginRight: 12,
                      marginBottom: 12,
                      background: style.background,
                      ...(style.border ? { border: style.border } : {}),
                    }}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 96, lineHeight: 1.05, maxWidth: 940 }}>
              GUESS THE ATHLETE FROM THE SILHOUETTE
            </div>
            <div style={{ fontSize: 34, color: CHALK_SOFT, marginTop: 22 }}>
              Three guesses. How long can you keep the run alive?
            </div>
          </div>
        )}

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 46, letterSpacing: 1 }}>
            {isResult ? 'CAN YOU BEAT IT?' : 'PLAY FREE'}
          </div>
          <div style={{ fontSize: 34, color: FLAG }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [{ name: 'Anton', data: anton, weight: 400, style: 'normal' }],
    },
  )
}
