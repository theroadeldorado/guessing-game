import type { Metadata } from 'next'
import Game from '@/components/GameLoader'

export const metadata: Metadata = {
  title: 'The Range — ShadowForm',
  description: 'Name as many golfers as you can from their silhouette. How long can you keep the run alive?',
}

export default function RangePage() {
  return (
    <main className="min-h-dvh">
      <Game />
    </main>
  )
}
