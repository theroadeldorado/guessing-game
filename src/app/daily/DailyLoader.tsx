'use client'

import dynamic from 'next/dynamic'

// Reads localStorage in its initializers, so skip SSR entirely (mirrors GameLoader).
const loading = () => (
  <div className="p-16 text-center font-mono text-sm text-chalk-soft">Walking to the tee…</div>
)

const DailyGame = dynamic(() => import('./DailyGame'), { ssr: false, loading })

export default function DailyLoader() {
  return <DailyGame />
}
