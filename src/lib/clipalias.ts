import { hashSeed } from './rng'

const SALT = 'sf-clip-v1:'

/**
 * Opaque, stable alias for a clip id, used as the public video URL so the
 * filename never spells out the answer (e.g. `/c/<alias>.webm` instead of
 * `/clips/tiger-woods-01.webm`). Two hashes concatenated: collision-proof for
 * a pool of this size. `proxy.ts` maps it back to the real file server-side.
 */
export function clipAlias(id: string): string {
  return hashSeed(id).toString(36) + hashSeed(SALT + id).toString(36)
}
