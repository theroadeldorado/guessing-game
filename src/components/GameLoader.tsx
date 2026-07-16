'use client'

import dynamic from 'next/dynamic'
import { getActiveSports } from '@/lib/data'

// The game is fully client-side (shuffled runs, localStorage), so skip SSR
// entirely rather than rendering a throwaway server shell.
const loading = () => (
  <div className="p-16 text-center font-mono text-sm text-chalk-soft">Rolling tape…</div>
)

const Game = dynamic(() => import('./Game'), { ssr: false, loading })
const SportPicker = dynamic(() => import('./SportPicker'), { ssr: false, loading })

export default function GameLoader() {
  const sports = getActiveSports()
  if (sports.length === 1) return <Game sportId={sports[0].id} />
  return <SportPicker sports={sports} />
}
