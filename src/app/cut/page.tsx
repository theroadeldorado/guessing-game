import type { Metadata } from 'next'
import Game from '@/components/GameLoader'

export const metadata: Metadata = {
  title: 'The Cut | ShadowForm',
  description:
    'How many golfers can you name from their silhouette before you miss the cut? Stack points and see how long your run lasts.',
}

export default function CutPage() {
  return (
    <main className="min-h-dvh">
      <Game />
    </main>
  )
}
