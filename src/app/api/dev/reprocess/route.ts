import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { devToolsEnabled, ensurePoolPlayer, manifestEntry, setClipSpeed, setClipSrc } from '@/lib/devtools'

const execFileAsync = promisify(execFile)

/**
 * POST { id }: run the silhouette pipeline for one clip (--only id --force).
 * The flag is PRESERVED: a flagged clip stays flagged (out of the game pool)
 * so it can be reviewed in /dev and released manually; only unflagged clips go
 * live. Downloads + matting take a couple of minutes on a new source; window
 * tweaks on an existing source finish in seconds thanks to the matte cache.
 */
export async function POST(req: Request) {
  if (!devToolsEnabled()) {
    return NextResponse.json({ error: 'dev only' }, { status: 404 })
  }
  const { id, speed } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // Bake speed is passed straight to the pipeline: a brand-new clip has no
  // clips.json row yet, so process.py can't look its speed up there (it would
  // fall back to the 4x default and import way too fast). Persisted below once
  // the row exists so later window-only reprocesses keep it.
  const bakeSpeed = Number.isFinite(Number(speed)) && Number(speed) > 0 ? Number(speed) : undefined

  // Reprocessing means "make this clip playable", so require (and, if benched,
  // promote) a pool player before spending minutes on download + matting.
  try {
    ensurePoolPlayer(id)
  } catch (e) {
    return NextResponse.json({ ok: false, log: (e as Error).message }, { status: 400 })
  }

  const pipeline = path.join(process.cwd(), 'pipeline')
  const python = path.join(pipeline, '.venv', 'bin', 'python')
  try {
    const { stdout, stderr } = await execFileAsync(
      python,
      ['process.py', '--only', id, '--force',
        ...(bakeSpeed !== undefined ? ['--speed', String(bakeSpeed)] : [])],
      { cwd: pipeline, timeout: 5 * 60 * 1000 },
    )
    const log = (stdout + stderr).trim()
    if (/FAILED/.test(log)) {
      return NextResponse.json({ ok: false, log: log.slice(-2000) }, { status: 500 })
    }
    // Keep the flag as-is: flagged clips stay out of the pool (placeholder src)
    // but the fresh webm sits on disk for review; unflagged clips go live.
    const flagged = !!manifestEntry(id)?.flagged
    const src = setClipSrc(id, !flagged)
    // Persist the speed now that the clips.json row exists, so a later
    // window-only reprocess (no --speed) still bakes at the same rate.
    if (bakeSpeed !== undefined) setClipSpeed(id, bakeSpeed)
    return NextResponse.json({
      ok: true,
      src,
      flagged,
      file: `/clips/${id}.webm`,
      log: log.slice(-2000),
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string }
    const log = `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message
    return NextResponse.json({ ok: false, log: log.slice(-2000) }, { status: 500 })
  }
}
