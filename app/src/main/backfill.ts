import { existsSync } from 'fs'
import { getDb } from './database'
import { computeByteHash, computePerceptualHash, getImageDimensions } from './image-hasher'
import { generateThumbnail } from './handlers/image-handlers'

export function backfillImageHashes(): void {
  const db = getDb()
  const unhashed = db.prepare(
    'SELECT id, file_path FROM images WHERE byte_hash IS NULL'
  ).all() as Array<{ id: number; file_path: string }>

  if (unhashed.length === 0) return

  console.log(`Backfilling hashes for ${unhashed.length} images...`)
  for (const img of unhashed) {
    if (!existsSync(img.file_path)) continue
    try {
      const byteHash = computeByteHash(img.file_path)
      const phash = computePerceptualHash(img.file_path)
      const dimensions = getImageDimensions(img.file_path)
      db.prepare(
        'UPDATE images SET byte_hash = ?, phash = ?, width = ?, height = ? WHERE id = ?'
      ).run(byteHash, phash, dimensions?.width ?? null, dimensions?.height ?? null, img.id)
    } catch {
      // Skip images that can't be read
    }
  }
  console.log('Hash backfill complete.')
}

export function backfillThumbnails(): void {
  const db = getDb()
  const BATCH_SIZE = 50

  const missing = db.prepare(
    `SELECT id, file_path FROM images WHERE thumbnail_path IS NULL LIMIT ${BATCH_SIZE}`
  ).all() as Array<{ id: number; file_path: string }>

  if (missing.length === 0) return

  console.log(`Generating thumbnails for images (batch of ${missing.length})...`)
  const updateThumb = db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?')

  for (const img of missing) {
    if (!existsSync(img.file_path)) continue
    try {
      const thumbPath = generateThumbnail(img.file_path)
      if (thumbPath) {
        updateThumb.run(thumbPath, img.id)
      }
    } catch {
      // Skip unreadable images
    }
  }

  // Check if more remain and schedule another batch
  const remaining = db.prepare(
    'SELECT COUNT(*) as count FROM images WHERE thumbnail_path IS NULL'
  ).get() as { count: number }

  if (remaining.count > 0) {
    console.log(`${remaining.count} images remaining for thumbnail generation...`)
    setTimeout(backfillThumbnails, 100)
  } else {
    console.log('Thumbnail generation complete.')
  }
}
