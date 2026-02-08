import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync, renameSync } from 'fs'
import { getDb } from '../database'
import type {
  Character,
  CharacterWithDetails,
  Tag,
  Group,
  CharacterImage,
  CustomFieldValue
} from '../../shared/types'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

export function ensureCharacterFolder(dataDir: string, id: number, name: string | null): string {
  const slug = name ? slugify(name) : 'unnamed'
  const folderName = `${String(id).padStart(4, '0')}-${slug}`
  const folderPath = join(dataDir, 'characters', folderName)

  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true })
  }
  if (!existsSync(join(folderPath, 'images'))) {
    mkdirSync(join(folderPath, 'images'), { recursive: true })
  }

  return folderPath
}

export function writeCharacterFiles(folderPath: string, data: { seed_text?: string; image_prompts?: string | null; notes?: string | null }): void {
  if (data.seed_text !== undefined) {
    writeFileSync(join(folderPath, 'seed.md'), data.seed_text || '', 'utf-8')
  }
  if (data.image_prompts !== undefined) {
    writeFileSync(join(folderPath, 'prompts.md'), data.image_prompts || '', 'utf-8')
  }
  if (data.notes !== undefined) {
    writeFileSync(join(folderPath, 'notes.md'), data.notes || '', 'utf-8')
  }
}

export function renameCharacterFolder(dataDir: string, id: number, oldFolderPath: string, newName: string | null): string {
  const db = getDb()
  const slug = newName ? slugify(newName) : 'unnamed'
  const folderName = `${String(id).padStart(4, '0')}-${slug}`
  const newFolderPath = join(dataDir, 'characters', folderName)

  if (newFolderPath === oldFolderPath) return oldFolderPath
  if (!existsSync(oldFolderPath)) return oldFolderPath

  renameSync(oldFolderPath, newFolderPath)

  db.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(newFolderPath, id)

  const images = db.prepare('SELECT id, file_path FROM images WHERE character_id = ?').all(id) as { id: number; file_path: string }[]
  const updateImage = db.prepare('UPDATE images SET file_path = ? WHERE id = ?')
  for (const img of images) {
    if (img.file_path.startsWith(oldFolderPath)) {
      const relativePart = img.file_path.substring(oldFolderPath.length)
      updateImage.run(newFolderPath + relativePart, img.id)
    }
  }

  return newFolderPath
}

export function getCharacterWithDetails(id: number): CharacterWithDetails | null {
  const db = getDb()

  db.prepare("UPDATE characters SET last_viewed_at = datetime('now') WHERE id = ?").run(id)

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character | undefined
  if (!character) return null

  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN character_tags ct ON ct.tag_id = t.id
    WHERE ct.character_id = ?
    ORDER BY t.category, t.name
  `).all(id) as Tag[]

  const images = db.prepare(`
    SELECT i.*, cc.name as category_name
    FROM images i
    LEFT JOIN content_categories cc ON cc.id = i.category_id
    WHERE i.character_id = ?
    ORDER BY i.is_cover DESC, i.id ASC
  `).all(id) as CharacterImage[]

  const cover = images.find((img) => img.is_cover) || images[0] || null

  const groups = db.prepare(`
    SELECT g.* FROM groups g
    JOIN character_groups cg ON cg.group_id = g.id
    WHERE cg.character_id = ?
    ORDER BY g.name
  `).all(id) as Group[]

  const customFieldValues = db.prepare(`
    SELECT cfv.field_id, cf.name as field_name, cfv.value
    FROM character_field_values cfv
    JOIN custom_fields cf ON cf.id = cfv.field_id
    WHERE cfv.character_id = ?
    ORDER BY cf.sort_order, cf.name
  `).all(id) as CustomFieldValue[]

  return {
    ...character,
    has_images: !!character.has_images,
    tags,
    images,
    cover_image: cover,
    groups,
    custom_field_values: customFieldValues
  }
}
