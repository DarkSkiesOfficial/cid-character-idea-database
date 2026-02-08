import { ipcMain, nativeImage } from 'electron'
import { join, basename, extname, dirname } from 'path'
import { mkdirSync, existsSync, copyFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { getCharacterWithDetails, slugify } from './utils'
import { computeByteHash, computePerceptualHash, getImageDimensions, hashSimilarity } from '../image-hasher'
import type { Character, CharacterImage } from '../../shared/types'

export interface AddImageOptions {
  deleteSource?: boolean
  categoryId?: number
}

const SIMILARITY_THRESHOLD = 0.9
const THUMB_MAX_WIDTH = 400
const THUMB_JPEG_QUALITY = 80

export function generateThumbnail(sourcePath: string): string | null {
  try {
    const img = nativeImage.createFromPath(sourcePath)
    if (img.isEmpty()) return null

    const size = img.getSize()
    if (size.width <= THUMB_MAX_WIDTH) return null

    const resized = img.resize({ width: THUMB_MAX_WIDTH, quality: 'good' })
    const jpegBuffer = resized.toJPEG(THUMB_JPEG_QUALITY)

    const dir = dirname(sourcePath)
    const thumbsDir = join(dir, 'thumbs')
    if (!existsSync(thumbsDir)) mkdirSync(thumbsDir, { recursive: true })

    const nameWithoutExt = basename(sourcePath, extname(sourcePath))
    const thumbPath = join(thumbsDir, `${nameWithoutExt}_thumb.jpg`)

    writeFileSync(thumbPath, jpegBuffer)
    return thumbPath
  } catch {
    return null
  }
}

export function registerImageHandlers(): void {
  ipcMain.handle(IPC.DB_CHECK_IMAGE_DUPLICATES, (_, sourcePath: string) => {
    const db = getDb()
    const byteHash = computeByteHash(sourcePath)
    const phash = computePerceptualHash(sourcePath)

    // Check exact byte-identical matches first
    const exactMatches = db.prepare(`
      SELECT i.*, c.name as character_name
      FROM images i
      JOIN characters c ON c.id = i.character_id
      WHERE i.byte_hash = ?
    `).all(byteHash) as Array<CharacterImage & { character_name: string | null }>

    if (exactMatches.length > 0) {
      return exactMatches.map((m) => ({
        type: 'exact' as const,
        imageId: m.id,
        characterId: m.character_id,
        characterName: m.character_name,
        filePath: m.file_path,
        similarity: 1.0
      }))
    }

    // Check perceptual similarity
    if (!phash) return []

    const allHashes = db.prepare(`
      SELECT i.id, i.character_id, i.file_path, i.phash, c.name as character_name
      FROM images i
      JOIN characters c ON c.id = i.character_id
      WHERE i.phash IS NOT NULL
    `).all() as Array<{ id: number; character_id: number; file_path: string; phash: string; character_name: string | null }>

    const similar: Array<{
      type: 'similar'
      imageId: number
      characterId: number
      characterName: string | null
      filePath: string
      similarity: number
    }> = []

    for (const row of allHashes) {
      const sim = hashSimilarity(phash, row.phash)
      if (sim >= SIMILARITY_THRESHOLD) {
        similar.push({
          type: 'similar',
          imageId: row.id,
          characterId: row.character_id,
          characterName: row.character_name,
          filePath: row.file_path,
          similarity: sim
        })
      }
    }

    // Sort by similarity descending
    similar.sort((a, b) => b.similarity - a.similarity)
    return similar
  })

  ipcMain.handle(IPC.DB_ADD_IMAGE, (_, characterId: number, sourcePath: string, options?: AddImageOptions) => {
    const db = getDb()
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as Character
    if (!character) throw new Error('Character not found')

    const folder = character.folder_path

    // Determine target subfolder based on category
    let imagesDir = join(folder, 'images')
    if (options?.categoryId) {
      const category = db.prepare('SELECT slug, is_image_type FROM content_categories WHERE id = ?')
        .get(options.categoryId) as { slug: string; is_image_type: number } | undefined
      if (category) {
        imagesDir = category.is_image_type
          ? join(folder, 'images', category.slug)
          : join(folder, category.slug)
      }
    }
    if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

    // Generate clean sequential filename
    const ext = extname(sourcePath).toLowerCase()
    const originalFilename = basename(sourcePath)
    const slug = character.name ? slugify(character.name) : 'unnamed'
    const existingCount = (db.prepare('SELECT COUNT(*) as count FROM images WHERE character_id = ?')
      .get(characterId) as { count: number }).count
    let sequentialFilename = `${slug}-${String(existingCount + 1).padStart(3, '0')}${ext}`
    let destPath = join(imagesDir, sequentialFilename)

    // Handle collision
    if (existsSync(destPath)) {
      sequentialFilename = `${slug}-${String(existingCount + 1).padStart(3, '0')}-${Date.now()}${ext}`
      destPath = join(imagesDir, sequentialFilename)
    }

    copyFileSync(sourcePath, destPath)

    // Delete source after verified copy if opted in
    if (options?.deleteSource) {
      try {
        const sourceStats = statSync(sourcePath)
        const destStats = statSync(destPath)
        if (destStats.size === sourceStats.size) {
          unlinkSync(sourcePath)
        }
      } catch {
        // Silently fail on delete — the import itself succeeded
      }
    }

    // Compute hashes, dimensions, and thumbnail for the newly copied file
    const byteHash = computeByteHash(destPath)
    const phash = computePerceptualHash(destPath)
    const dimensions = getImageDimensions(destPath)
    const thumbnailPath = generateThumbnail(destPath)

    const hasOtherImages = db.prepare('SELECT COUNT(*) as count FROM images WHERE character_id = ?')
      .get(characterId) as { count: number }
    const isCover = hasOtherImages.count === 0 ? 1 : 0

    db.prepare(`
      INSERT INTO images (character_id, file_path, thumbnail_path, is_cover, original_filename, byte_hash, phash, width, height, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      characterId, destPath, thumbnailPath, isCover, originalFilename,
      byteHash, phash,
      dimensions?.width ?? null, dimensions?.height ?? null,
      options?.categoryId ?? null
    )

    db.prepare("UPDATE characters SET has_images = 1, updated_at = datetime('now') WHERE id = ?").run(characterId)

    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_SET_COVER_IMAGE, (_, characterId: number, imageId: number) => {
    const db = getDb()
    db.prepare('UPDATE images SET is_cover = 0 WHERE character_id = ?').run(characterId)
    db.prepare('UPDATE images SET is_cover = 1 WHERE id = ? AND character_id = ?').run(imageId, characterId)
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_REMOVE_IMAGE, (_, imageId: number) => {
    const db = getDb()
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as CharacterImage | undefined
    if (!image) return

    db.prepare('DELETE FROM images WHERE id = ?').run(imageId)

    // Delete the actual file and thumbnail from disk
    try { if (image.file_path && existsSync(image.file_path)) unlinkSync(image.file_path) } catch (_e) { /* file already gone */ }
    try {
      if ((image as any).thumbnail_path && existsSync((image as any).thumbnail_path)) unlinkSync((image as any).thumbnail_path)
    } catch (_e) { /* thumbnail already gone */ }

    const remaining = db.prepare('SELECT COUNT(*) as count FROM images WHERE character_id = ?')
      .get(image.character_id) as { count: number }

    if (remaining.count === 0) {
      db.prepare("UPDATE characters SET has_images = 0, updated_at = datetime('now') WHERE id = ?").run(image.character_id)
    }

    return getCharacterWithDetails(image.character_id)
  })

  // Reindex all existing images that don't have hashes yet
  ipcMain.handle(IPC.DB_REINDEX_IMAGE_HASHES, () => {
    const db = getDb()
    const images = db.prepare(
      'SELECT id, file_path FROM images WHERE byte_hash IS NULL OR phash IS NULL'
    ).all() as Array<{ id: number; file_path: string }>

    let indexed = 0
    for (const img of images) {
      if (!existsSync(img.file_path)) continue

      const byteHash = computeByteHash(img.file_path)
      const phash = computePerceptualHash(img.file_path)
      const dimensions = getImageDimensions(img.file_path)

      db.prepare(`
        UPDATE images SET byte_hash = ?, phash = ?, width = ?, height = ?
        WHERE id = ?
      `).run(
        byteHash, phash,
        dimensions?.width ?? null, dimensions?.height ?? null,
        img.id
      )
      indexed++
    }

    return { indexed, total: images.length }
  })

  // Generate thumbnails for images that don't have them
  ipcMain.handle(IPC.DB_GENERATE_THUMBNAILS, () => {
    const db = getDb()
    const images = db.prepare(
      'SELECT id, file_path FROM images WHERE thumbnail_path IS NULL'
    ).all() as Array<{ id: number; file_path: string }>

    let generated = 0
    const updateThumb = db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?')

    const batch = db.transaction(() => {
      for (const img of images) {
        if (!existsSync(img.file_path)) continue
        const thumbPath = generateThumbnail(img.file_path)
        if (thumbPath) {
          updateThumb.run(thumbPath, img.id)
          generated++
        }
      }
    })
    batch()

    return { generated, total: images.length }
  })
}
