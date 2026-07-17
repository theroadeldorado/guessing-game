'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface DevClip {
  id: string
  playerId: string
  playerName: string
  sportId: string
  source: string
  start: string
  end: string
  flagged?: boolean
  src: string
  speed?: number
}

type Filter = 'all' | 'real' | 'flagged' | 'placeholder'

export default function ClipReviewer() {
  const [clips, setClips] = useState<DevClip[]>([])
  const [filter, setFilter] = useState<Filter>('real')
  const [bust, setBust] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/dev/clips')
      .then((res) => res.json())
      .then(setClips)
  }, [])

  const counts = useMemo(
    () => ({
      all: clips.length,
      real: clips.filter((c) => c.src !== 'placeholder').length,
      flagged: clips.filter((c) => c.flagged).length,
      placeholder: clips.filter((c) => c.src === 'placeholder' && !c.flagged).length,
    }),
    [clips],
  )

  const visible = clips.filter((c) =>
    filter === 'all'
      ? true
      : filter === 'real'
        ? c.src !== 'placeholder'
        : filter === 'flagged'
          ? c.flagged
          : c.src === 'placeholder' && !c.flagged,
  )

  return (
    <main className="min-h-dvh p-4">
      <header className="mx-auto mb-4 flex max-w-6xl flex-wrap items-baseline gap-4">
        <h1 className="font-display text-2xl uppercase tracking-wide text-paper">
          Clip review <span className="text-flag">/dev</span>
        </h1>
        <nav className="flex gap-2 font-mono text-xs">
          {(['real', 'flagged', 'placeholder', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-sm border px-3 py-1.5 uppercase tracking-wider ${
                filter === f ? 'border-flag bg-flag text-ink' : 'border-chalk text-chalk-soft'
              }`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </nav>
        <p className="font-mono text-xs text-chalk-soft">
          Flag pulls a clip out of the game. Edit source/start/end, then Save & reprocess.
        </p>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {visible.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            bust={bust[clip.id]}
            onChanged={(patch) =>
              setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, ...patch } : c)))
            }
            onReprocessed={() => setBust((b) => ({ ...b, [clip.id]: Date.now() }))}
          />
        ))}
      </div>
    </main>
  )
}

function ClipCard({ clip, bust, onChanged, onReprocessed }: {
  clip: DevClip
  bust?: number
  onChanged: (patch: Partial<DevClip>) => void
  onReprocessed: () => void
}) {
  const [source, setSource] = useState(clip.source)
  const [start, setStart] = useState(clip.start)
  const [end, setEnd] = useState(clip.end)
  const [speed, setSpeed] = useState(String(clip.speed ?? 4))
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // preview at the game's full-speed rate so speed tuning is live
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = Number(speed) || 4
  }, [speed])

  const dirty =
    source !== clip.source ||
    start !== clip.start ||
    end !== clip.end ||
    Number(speed) !== (clip.speed ?? 4)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/dev/clips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clip.id, ...body }),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
    return res.json()
  }

  const toggleFlag = async () => {
    setBusy(true)
    setStatus('')
    try {
      const next = !clip.flagged
      const { src } = await patch({ flagged: next })
      onChanged({ flagged: next, src })
      setStatus(next ? 'Flagged — placeholder in game' : 'Unflagged')
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setStatus('')
    try {
      await patch({ source, start, end, speed: Number(speed) || 4 })
      onChanged({ source, start, end, speed: Number(speed) || 4 })
      setStatus('Saved')
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const reprocess = async () => {
    setBusy(true)
    setStatus('Saving…')
    try {
      await patch({ source, start, end, speed: Number(speed) || 4 })
      onChanged({ source, start, end, speed: Number(speed) || 4 })
      setStatus('Reprocessing… (new sources take a minute or two)')
      const res = await fetch('/api/dev/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clip.id }),
      })
      const data = await res.json()
      if (!data.ok) {
        setStatus(`Pipeline failed — see log in terminal.\n${(data.log ?? '').split('\n').slice(-3).join('\n')}`)
        return
      }
      onChanged({ flagged: false, src: data.src })
      onReprocessed()
      setStatus('Reprocessed ✓')
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const videoSrc = clip.src !== 'placeholder' ? `${clip.src}${bust ? `?v=${bust}` : ''}` : null

  return (
    <div
      className={`flex flex-col gap-2 rounded-sm border p-3 ${
        clip.flagged ? 'border-red-400/60' : 'border-chalk'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-lg uppercase tracking-wide text-paper">
          {clip.playerName}
        </span>
        <span className="font-mono text-[10px] text-chalk-soft">{clip.sportId}</span>
      </div>
      <div className="aspect-square w-full overflow-hidden rounded-sm border border-chalk bg-black">
        {videoSrc ? (
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            className="h-full w-full object-contain"
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={() => {
              if (videoRef.current) videoRef.current.playbackRate = Number(speed) || 4
            }}
          />
        ) : (
          <div className="grid h-full place-items-center font-mono text-xs text-chalk-soft">
            {clip.flagged ? '🚩 flagged' : 'placeholder'}
          </div>
        )}
      </div>
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="YouTube URL"
        className="w-full rounded-sm border border-chalk bg-room-deep px-2 py-1.5 font-mono text-xs text-paper placeholder:text-chalk-soft focus:border-flag focus:outline-none"
      />
      <div className="flex gap-2">
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="start (00:00:04)"
          className="min-w-0 flex-1 rounded-sm border border-chalk bg-room-deep px-2 py-1.5 font-mono text-xs text-paper placeholder:text-chalk-soft focus:border-flag focus:outline-none"
        />
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="end (blank = +4s)"
          className="min-w-0 flex-1 rounded-sm border border-chalk bg-room-deep px-2 py-1.5 font-mono text-xs text-paper placeholder:text-chalk-soft focus:border-flag focus:outline-none"
        />
        <label className="flex items-center gap-1 font-mono text-xs text-chalk-soft">
          <input
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            type="number"
            min="0.25"
            step="0.25"
            title="playbackRate approximating real time"
            className="w-14 rounded-sm border border-chalk bg-room-deep px-2 py-1.5 text-paper focus:border-flag focus:outline-none"
          />
          ×
        </label>
      </div>
      <div className="flex gap-2 font-mono text-xs">
        <button
          onClick={toggleFlag}
          disabled={busy}
          className="rounded-sm border border-chalk px-2 py-1.5 text-chalk-soft hover:border-red-400 hover:text-red-400 disabled:opacity-40"
        >
          {clip.flagged ? 'Unflag' : '🚩 Flag'}
        </button>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="rounded-sm border border-chalk px-2 py-1.5 text-chalk-soft hover:border-paper hover:text-paper disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={reprocess}
          disabled={busy || !source}
          className="flex-1 rounded-sm border border-flag/60 px-2 py-1.5 text-flag hover:bg-flag hover:text-ink disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Save & reprocess'}
        </button>
      </div>
      {status && <p className="whitespace-pre-wrap font-mono text-[11px] text-chalk-soft">{status}</p>}
    </div>
  )
}
