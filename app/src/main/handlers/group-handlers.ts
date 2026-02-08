import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { getCharacterWithDetails } from './utils'
import type { CharacterStatus } from '../../shared/types'

export function registerGroupHandlers(): void {
  ipcMain.handle(IPC.DB_GET_ALL_GROUPS, () => {
    const db = getDb()
    return db.prepare(`
      SELECT g.*, COUNT(cg.character_id) as character_count
      FROM groups g
      LEFT JOIN character_groups cg ON cg.group_id = g.id
      GROUP BY g.id
      ORDER BY g.name
    `).all()
  })

  ipcMain.handle(IPC.DB_CREATE_GROUP, (_, name: string) => {
    const db = getDb()
    db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(name.trim())
    return db.prepare('SELECT * FROM groups WHERE name = ?').get(name.trim())
  })

  ipcMain.handle(IPC.DB_DELETE_GROUP, (_, groupId: number) => {
    const db = getDb()
    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId)
    return true
  })

  ipcMain.handle(IPC.DB_ADD_CHARACTER_TO_GROUP, (_, characterId: number, groupName: string) => {
    const db = getDb()
    const trimmed = groupName.trim()
    db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(trimmed)
    const group = db.prepare('SELECT id FROM groups WHERE name = ?').get(trimmed) as { id: number }
    db.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)').run(characterId, group.id)
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_REMOVE_CHARACTER_FROM_GROUP, (_, characterId: number, groupId: number) => {
    const db = getDb()
    db.prepare('DELETE FROM character_groups WHERE character_id = ? AND group_id = ?').run(characterId, groupId)
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.DB_UPDATE_CHARACTER_STATUS, (_, id: number, status: CharacterStatus) => {
    const db = getDb()
    db.prepare("UPDATE characters SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id)
    return getCharacterWithDetails(id)
  })

  ipcMain.handle(IPC.DB_RENAME_GROUP, (_, groupId: number, newName: string) => {
    const db = getDb()
    const trimmed = newName.trim()
    if (!trimmed) return { error: 'Group name cannot be empty' }

    const existing = db.prepare('SELECT id FROM groups WHERE name = ? COLLATE NOCASE AND id != ?').get(trimmed, groupId) as { id: number } | undefined
    if (existing) {
      const merge = db.transaction(() => {
        db.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) SELECT character_id, ? FROM character_groups WHERE group_id = ?').run(existing.id, groupId)
        db.prepare('DELETE FROM character_groups WHERE group_id = ?').run(groupId)
        db.prepare('DELETE FROM groups WHERE id = ?').run(groupId)
      })
      merge()
      return { merged: true, targetId: existing.id }
    }

    db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(trimmed, groupId)
    return { renamed: true }
  })

  ipcMain.handle(IPC.DB_MERGE_GROUPS, (_, sourceGroupId: number, targetGroupId: number) => {
    const db = getDb()
    const merge = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) SELECT character_id, ? FROM character_groups WHERE group_id = ?').run(targetGroupId, sourceGroupId)
      db.prepare('DELETE FROM character_groups WHERE group_id = ?').run(sourceGroupId)
      db.prepare('DELETE FROM groups WHERE id = ?').run(sourceGroupId)
    })
    merge()
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_ADD_TO_GROUP, (_, characterIds: number[], groupName: string) => {
    const db = getDb()
    const trimmed = groupName.trim()
    if (!trimmed) return false

    const batch = db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(trimmed)
      const group = db.prepare('SELECT id FROM groups WHERE name = ?').get(trimmed) as { id: number }
      const insert = db.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)')
      for (const cid of characterIds) {
        insert.run(cid, group.id)
      }
    })
    batch()
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_REMOVE_FROM_GROUP, (_, characterIds: number[], groupId: number) => {
    const db = getDb()
    const placeholders = characterIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM character_groups WHERE group_id = ? AND character_id IN (${placeholders})`).run(groupId, ...characterIds)
    return true
  })
}
