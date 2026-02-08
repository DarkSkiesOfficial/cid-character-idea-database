import { ipcMain } from 'electron'
import { join, extname, basename } from 'path'
import { mkdirSync, existsSync, renameSync } from 'fs'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { slugify, getCharacterWithDetails } from './utils'
import type { ContentCategory } from '../../shared/types'

export function registerCategoryHandlers(): void {
  ipcMain.handle(IPC.DB_GET_ALL_CATEGORIES, () => {
    const db = getDb()
    return db.prepare(
      'SELECT * FROM content_categories ORDER BY name ASC'
    ).all() as ContentCategory[]
  })

  ipcMain.handle(IPC.DB_CREATE_CATEGORY, (_, name: string, isImageType: boolean) => {
    const db = getDb()
    const slug = slugify(name)

    db.prepare(`
      INSERT INTO content_categories (name, slug, is_image_type)
      VALUES (?, ?, ?)
    `).run(name, slug, isImageType ? 1 : 0)

    const created = db.prepare(
      'SELECT * FROM content_categories WHERE slug = ?'
    ).get(slug) as ContentCategory

    return created
  })

  ipcMain.handle(IPC.DB_DELETE_CATEGORY, (_, categoryId: number) => {
    const db = getDb()
    // Unlink images from this category (sets category_id to NULL) — they stay in their current disk location
    db.prepare('UPDATE images SET category_id = NULL WHERE category_id = ?').run(categoryId)
    db.prepare('DELETE FROM content_categories WHERE id = ?').run(categoryId)
    return true
  })

  ipcMain.handle(IPC.DB_SET_IMAGE_CATEGORY, (_, imageId: number, categoryId: number | null) => {
    const db = getDb()
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as {
      id: number; character_id: number; file_path: string; category_id: number | null;
      original_filename: string
    } | undefined
    if (!image) throw new Error('Image not found')

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(image.character_id) as {
      id: number; folder_path: string; name: string | null
    }

    // Figure out destination folder
    // Image-type categories nest under images/ (e.g., images/swimsuit/)
    // Non-image categories are siblings to images/ (e.g., songs/)
    let destDir: string
    if (categoryId === null) {
      destDir = join(character.folder_path, 'images')
    } else {
      const category = db.prepare('SELECT * FROM content_categories WHERE id = ?').get(categoryId) as ContentCategory | undefined
      if (!category) throw new Error('Category not found')
      destDir = category.is_image_type
        ? join(character.folder_path, 'images', category.slug)
        : join(character.folder_path, category.slug)
    }

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    // Move the file on disk
    const filename = basename(image.file_path)
    let destPath = join(destDir, filename)

    // Handle collision if file exists at destination
    if (destPath !== image.file_path && existsSync(destPath)) {
      const ext = extname(filename)
      const base = basename(filename, ext)
      destPath = join(destDir, `${base}-${Date.now()}${ext}`)
    }

    if (destPath !== image.file_path) {
      renameSync(image.file_path, destPath)
    }

    // Update DB
    db.prepare('UPDATE images SET category_id = ?, file_path = ? WHERE id = ?')
      .run(categoryId, destPath, imageId)

    return getCharacterWithDetails(image.character_id)
  })
}
