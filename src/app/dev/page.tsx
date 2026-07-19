import { notFound } from 'next/navigation'
import { devToolsEnabled } from '@/lib/devtools'
import ClipReviewer from './ClipReviewer'

export const metadata = { title: 'ShadowForm clip review' }

export default function DevPage() {
  if (!devToolsEnabled()) notFound()
  return <ClipReviewer />
}
