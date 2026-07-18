import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSport } from '@/lib/data'
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

/**
 * The shareable result card. Rendered from URL params (no DB) so the same image
 * serves both the link's OG/Twitter preview and the file attached to the native
 * share sheet. Colored pips instead of emoji — on-brand, and no twemoji fetch.
 * Satori is strict: every element with >1 child must be display:flex.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const isResult = params.has('s')
  const d = parseShareData(params)
  let sport
  try {
    sport = getSport(d.sport)
  } catch {
    sport = getSport('golf')
  }
  const anton = await readFile(join(process.cwd(), 'assets', 'Anton-Regular.ttf'))
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
