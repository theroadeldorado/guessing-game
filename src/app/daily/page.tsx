import type { Metadata } from 'next'
import DailyLoader from './DailyLoader'

export const metadata: Metadata = {
  title: 'Daily Round — ShadowForm',
  description: "One silhouette a day. Guess it in par to keep your streak alive.",
}

export default function DailyPage() {
  return (
    <main className="min-h-dvh">
      <DailyLoader />
    </main>
  )
}
