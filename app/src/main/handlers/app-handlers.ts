import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, rmSync, mkdirSync, readdirSync } from 'fs'
import { getDb, getDataDir } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { checkForDuplicates } from '../duplicate-checker'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.CHECK_DUPLICATES, (_, seedText: string) => {
    return checkForDuplicates(seedText)
  })

  ipcMain.handle(IPC.APP_GET_STATS, () => {
    const db = getDb()
    const totalChars = (db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }).count
    const withImages = (db.prepare('SELECT COUNT(*) as count FROM characters WHERE has_images = 1').get() as { count: number }).count
    const withNames = (db.prepare("SELECT COUNT(*) as count FROM characters WHERE name IS NOT NULL AND name != ''").get() as { count: number }).count
    const totalTags = (db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number }).count
    const totalImages = (db.prepare('SELECT COUNT(*) as count FROM images').get() as { count: number }).count
    const totalGroups = (db.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number }).count

    const waiting = (db.prepare("SELECT COUNT(*) as count FROM characters WHERE status = 'waiting'").get() as { count: number }).count
    const active = (db.prepare("SELECT COUNT(*) as count FROM characters WHERE status = 'active'").get() as { count: number }).count
    const archived = (db.prepare("SELECT COUNT(*) as count FROM characters WHERE status = 'archived'").get() as { count: number }).count

    return { totalChars, withImages, withNames, totalTags, totalImages, totalGroups, waiting, active, archived }
  })

  ipcMain.handle(IPC.APP_CLEAR_LIBRARY, () => {
    const db = getDb()
    const dataDir = getDataDir()
    const clear = db.transaction(() => {
      db.prepare('DELETE FROM images').run()
      db.prepare('DELETE FROM character_tags').run()
      db.prepare('DELETE FROM character_groups').run()
      db.prepare('DELETE FROM character_field_values').run()
      db.prepare('DELETE FROM characters').run()
      db.prepare('DELETE FROM tags').run()
      db.prepare('DELETE FROM groups').run()
      db.prepare('DELETE FROM custom_fields').run()
      // Reset autoincrement so next character starts at 0001
      db.prepare("DELETE FROM sqlite_sequence WHERE name='characters'").run()
    })
    clear()

    const charsDir = join(dataDir, 'characters')
    if (existsSync(charsDir)) {
      rmSync(charsDir, { recursive: true, force: true })
      mkdirSync(charsDir, { recursive: true })
    }

    // Also clean current-work
    const currentWorkDir = join(dataDir, 'current-work')
    if (existsSync(currentWorkDir)) {
      rmSync(currentWorkDir, { recursive: true, force: true })
      mkdirSync(currentWorkDir, { recursive: true })
    }

    return true
  })

  ipcMain.handle(IPC.APP_GET_BACKGROUNDS, () => {
    const dataDir = getDataDir()
    const backgroundsDir = join(dataDir, 'backgrounds')
    if (!existsSync(backgroundsDir)) return []
    const files = readdirSync(backgroundsDir)
    return files
      .filter((f) => IMAGE_EXTS.has(f.substring(f.lastIndexOf('.')).toLowerCase()))
      .map((f) => join(backgroundsDir, f))
  })

  ipcMain.handle(IPC.APP_TOGGLE_FULLSCREEN, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(!win.isFullScreen())
      return win.isFullScreen()
    }
    return false
  })

  ipcMain.handle(IPC.APP_IS_FULLSCREEN, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isFullScreen() ?? false
  })
}
