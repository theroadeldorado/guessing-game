import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { devToolsEnabled, ensurePoolPlayer, setClipSrc, updateManifestEntry } from '@/lib/devtools'

const execFileAsync = promisify(execFile)

/**
 * POST { id } — run the silhouette pipeline for one clip (--only id --force)
 * and, on success, point clips.json at the fresh webm and clear the flag.
 * Downloads + matting can take a couple of minutes on a new source; window
 * tweaks on an existing source finish in seconds thanks to the matte cache.
 */
export async function POST(req: Request) {
  if (!devToolsEnabled()) {
    return NextResponse.json({ error: 'dev only' }, { status: 404 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Reprocessing means "make this clip playable" — require (and, if benched,
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
      ['process.py', '--only', id, '--force'],
      { cwd: pipeline, timeout: 5 * 60 * 1000 },
    )
    const log = (stdout + stderr).trim()
    if (/FAILED/.test(log)) {
      return NextResponse.json({ ok: false, log: log.slice(-2000) }, { status: 500 })
    }
    updateManifestEntry(id, { flagged: false })
    const src = setClipSrc(id, true)
    return NextResponse.json({ ok: true, src, log: log.slice(-2000) })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string }
    const log = `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message
    return NextResponse.json({ ok: false, log: log.slice(-2000) }, { status: 500 })
  }
}
