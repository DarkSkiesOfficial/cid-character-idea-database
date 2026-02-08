import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.DB_GET_SETTINGS, () => {
    const db = getDb()
    return db.prepare('SELECT key, value FROM settings').all()
  })

  ipcMain.handle(IPC.DB_SET_SETTING, (_, key: string, value: string) => {
    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    return true
  })

  // Filter presets (stored as JSON in settings table with key prefix 'filter_preset:')
  ipcMain.handle(IPC.FILTER_GET_PRESETS, () => {
    const db = getDb()
    const rows = db
      .prepare("SELECT key, value FROM settings WHERE key LIKE 'filter_preset:%'")
      .all() as { key: string; value: string }[]
    return rows.map((r) => JSON.parse(r.value))
  })

  ipcMain.handle(
    IPC.FILTER_SAVE_PRESET,
    (_, preset: { id: string; name: string; filter: unknown; statusFilter?: string; createdAt: string }) => {
      const db = getDb()
      const key = `filter_preset:${preset.id}`
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        key,
        JSON.stringify(preset)
      )
      return true
    }
  )

  ipcMain.handle(IPC.FILTER_DELETE_PRESET, (_, presetId: string) => {
    const db = getDb()
    db.prepare("DELETE FROM settings WHERE key = ?").run(`filter_preset:${presetId}`)
    return true
  })
}
