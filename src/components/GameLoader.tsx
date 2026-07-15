'use client'

import dynamic from 'next/dynamic'

// The game is fully client-side (shuffled runs, localStorage), so skip SSR
// entirely rather than rendering a throwaway server shell.
const Game = dynamic(() => import('./Game'), {
  ssr: false,
  loading: () => (
    <div className="p-16 text-center font-mono text-sm text-chalk-soft">Rolling tape…</div>
  ),
})

export default Game
