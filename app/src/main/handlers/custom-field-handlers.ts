import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { getCharacterWithDetails } from './utils'

export function registerCustomFieldHandlers(): void {
  ipcMain.handle(IPC.DB_GET_ALL_CUSTOM_FIELDS, () => {
    const db = getDb()
    return db.prepare(`
      SELECT cf.*, COUNT(CASE WHEN cfv.value != '' THEN 1 END) as usage_count
      FROM custom_fields cf
      LEFT JOIN character_field_values cfv ON cfv.field_id = cf.id
      GROUP BY cf.id
      ORDER BY cf.sort_order, cf.name
    `).all()
  })

  ipcMain.handle(IPC.DB_CREATE_CUSTOM_FIELD, (_, name: string) => {
    const db = getDb()
    const trimmed = name.trim()
    if (!trimmed) return { error: 'Field name cannot be empty' }

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_order FROM custom_fields').get() as { max_order: number | null }
    const nextOrder = (maxOrder.max_order ?? -1) + 1

    db.prepare('INSERT OR IGNORE INTO custom_fields (name, sort_order) VALUES (?, ?)').run(trimmed, nextOrder)
    return db.prepare('SELECT * FROM custom_fields WHERE name = ? COLLATE NOCASE').get(trimmed)
  })

  ipcMain.handle(IPC.DB_RENAME_CUSTOM_FIELD, (_, fieldId: number, newName: string) => {
    const db = getDb()
    const trimmed = newName.trim()
    if (!trimmed) return { error: 'Field name cannot be empty' }

    const existing = db.prepare('SELECT id FROM custom_fields WHERE name = ? COLLATE NOCASE AND id != ?').get(trimmed, fieldId) as { id: number } | undefined
    if (existing) {
      return { error: 'A field with that name already exists' }
    }

    db.prepare('UPDATE custom_fields SET name = ? WHERE id = ?').run(trimmed, fieldId)
    return { renamed: true }
  })

  ipcMain.handle(IPC.DB_DELETE_CUSTOM_FIELD, (_, fieldId: number) => {
    const db = getDb()
    db.prepare('DELETE FROM custom_fields WHERE id = ?').run(fieldId)
    return true
  })

  ipcMain.handle(IPC.DB_REORDER_CUSTOM_FIELDS, (_, orderedIds: number[]) => {
    const db = getDb()
    const reorder = db.transaction(() => {
      const update = db.prepare('UPDATE custom_fields SET sort_order = ? WHERE id = ?')
      for (let i = 0; i < orderedIds.length; i++) {
        update.run(i, orderedIds[i])
      }
    })
    reorder()
    return true
  })

  ipcMain.handle(IPC.DB_UPDATE_CUSTOM_FIELD, (_, fieldId: number, updates: { show_on_card?: boolean }) => {
    const db = getDb()
    if (updates.show_on_card !== undefined) {
      db.prepare('UPDATE custom_fields SET show_on_card = ? WHERE id = ?').run(updates.show_on_card ? 1 : 0, fieldId)
    }
    return db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(fieldId)
  })

  ipcMain.handle(IPC.DB_SET_CUSTOM_FIELD_VALUE, (_, characterId: number, fieldId: number, value: string) => {
    const db = getDb()
    const trimmed = value.trim()
    if (!trimmed) {
      db.prepare('DELETE FROM character_field_values WHERE character_id = ? AND field_id = ?').run(characterId, fieldId)
    } else {
      db.prepare('INSERT OR REPLACE INTO character_field_values (character_id, field_id, value) VALUES (?, ?, ?)').run(characterId, fieldId, trimmed)
    }
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_BATCH_SET_CUSTOM_FIELD, (_, characterIds: number[], fieldId: number, value: string) => {
    const db = getDb()
    const trimmed = value.trim()
    const batch = db.transaction(() => {
      if (!trimmed) {
        const del = db.prepare('DELETE FROM character_field_values WHERE character_id = ? AND field_id = ?')
        for (const cid of characterIds) {
          del.run(cid, fieldId)
        }
      } else {
        const upsert = db.prepare('INSERT OR REPLACE INTO character_field_values (character_id, field_id, value) VALUES (?, ?, ?)')
        for (const cid of characterIds) {
          upsert.run(cid, fieldId, trimmed)
        }
      }
    })
    batch()
    return true
  })
}
