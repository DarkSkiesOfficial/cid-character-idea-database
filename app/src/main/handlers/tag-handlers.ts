import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { getCharacterWithDetails } from './utils'

export function registerTagHandlers(): void {
  ipcMain.handle(IPC.DB_GET_ALL_TAGS, () => {
    const db = getDb()
    return db.prepare(`
      SELECT t.*, COUNT(ct.character_id) as character_count
      FROM tags t
      LEFT JOIN character_tags ct ON ct.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.category, t.name
    `).all()
  })

  ipcMain.handle(IPC.DB_CREATE_TAG, (_, name: string) => {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, NULL)').run(name.trim().toLowerCase())
  })

  ipcMain.handle(IPC.DB_ADD_TAG_TO_CHARACTER, (_, characterId: number, tagName: string, category?: string) => {
    const db = getDb()
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)')
    insertTag.run(tagName.trim().toLowerCase(), category || null)

    const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName.trim().toLowerCase()) as { id: number }

    db.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)').run(characterId, tag.id)

    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_REMOVE_TAG_FROM_CHARACTER, (_, characterId: number, tagId: number) => {
    const db = getDb()
    db.prepare('DELETE FROM character_tags WHERE character_id = ? AND tag_id = ?').run(characterId, tagId)
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_DELETE_TAG, (_, tagId: number) => {
    const db = getDb()
    db.prepare('DELETE FROM character_tags WHERE tag_id = ?').run(tagId)
    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
    return true
  })

  ipcMain.handle(IPC.DB_RENAME_TAG, (_, tagId: number, newName: string) => {
    const db = getDb()
    const trimmed = newName.trim().toLowerCase()
    if (!trimmed) return { error: 'Tag name cannot be empty' }

    const existing = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(trimmed, tagId) as { id: number } | undefined
    if (existing) {
      // Name collision — auto-merge into the existing tag
      const merge = db.transaction(() => {
        db.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) SELECT character_id, ? FROM character_tags WHERE tag_id = ?').run(existing.id, tagId)
        db.prepare('DELETE FROM character_tags WHERE tag_id = ?').run(tagId)
        db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
      })
      merge()
      return { merged: true, targetId: existing.id }
    }

    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(trimmed, tagId)
    return { renamed: true }
  })

  ipcMain.handle(IPC.DB_MERGE_TAGS, (_, sourceTagId: number, targetTagId: number) => {
    const db = getDb()
    const merge = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) SELECT character_id, ? FROM character_tags WHERE tag_id = ?').run(targetTagId, sourceTagId)
      db.prepare('DELETE FROM character_tags WHERE tag_id = ?').run(sourceTagId)
      db.prepare('DELETE FROM tags WHERE id = ?').run(sourceTagId)
    })
    merge()
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_ADD_TAG, (_, characterIds: number[], tagName: string) => {
    const db = getDb()
    const trimmed = tagName.trim().toLowerCase()
    if (!trimmed) return false

    const batch = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, NULL)').run(trimmed)
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: number }
      const insert = db.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)')
      for (const cid of characterIds) {
        insert.run(cid, tag.id)
      }
    })
    batch()
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_REMOVE_TAG, (_, characterIds: number[], tagId: number) => {
    const db = getDb()
    const placeholders = characterIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM character_tags WHERE tag_id = ? AND character_id IN (${placeholders})`).run(tagId, ...characterIds)
    return true
  })
}
