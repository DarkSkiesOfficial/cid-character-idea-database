import { ipcMain, shell } from 'electron'
import { join, basename } from 'path'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs'
import { getDb, getDataDir } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { getCharacterWithDetails } from './utils'

function copyFolderSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src)
  for (const entry of entries) {
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    if (statSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

export function registerWorkflowHandlers(): void {
  ipcMain.handle(IPC.WORKFLOW_PULL_OFF_SHELF, (_, characterId: number) => {
    const db = getDb()
    const currentWorkDir = join(getDataDir(), 'current-work')
    if (!existsSync(currentWorkDir)) {
      mkdirSync(currentWorkDir, { recursive: true })
    }

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as
      { id: number; name: string | null; folder_path: string; status: string } | undefined
    if (!character) throw new Error('Character not found')

    db.prepare("UPDATE characters SET status = 'active', updated_at = datetime('now') WHERE id = ?")
      .run(characterId)

    if (character.folder_path && existsSync(character.folder_path)) {
      const folderName = basename(character.folder_path)
      const workFolderPath = join(currentWorkDir, folderName)
      if (!existsSync(workFolderPath)) {
        copyFolderSync(character.folder_path, workFolderPath)
      }
    }

    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.WORKFLOW_RETURN_TO_SHELF, (_, characterId: number) => {
    const db = getDb()
    const character = db.prepare('SELECT folder_path FROM characters WHERE id = ?').get(characterId) as
      { folder_path: string } | undefined

    db.prepare("UPDATE characters SET status = 'waiting', updated_at = datetime('now') WHERE id = ?")
      .run(characterId)

    // Clean up current-work copy
    if (character?.folder_path) {
      const folderName = basename(character.folder_path)
      const workCopy = join(getDataDir(), 'current-work', folderName)
      if (existsSync(workCopy)) {
        try { rmSync(workCopy, { recursive: true, force: true }) } catch (_e) { /* best effort */ }
      }
    }

    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.WORKFLOW_ARCHIVE, (_, characterId: number) => {
    const db = getDb()
    const character = db.prepare('SELECT folder_path FROM characters WHERE id = ?').get(characterId) as
      { folder_path: string } | undefined

    db.prepare("UPDATE characters SET status = 'archived', updated_at = datetime('now') WHERE id = ?")
      .run(characterId)

    // Clean up current-work copy if one exists
    if (character?.folder_path) {
      const folderName = basename(character.folder_path)
      const workCopy = join(getDataDir(), 'current-work', folderName)
      if (existsSync(workCopy)) {
        try { rmSync(workCopy, { recursive: true, force: true }) } catch (_e) { /* best effort */ }
      }
    }

    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.WORKFLOW_UNARCHIVE, (_, characterId: number) => {
    const db = getDb()
    db.prepare("UPDATE characters SET status = 'waiting', updated_at = datetime('now') WHERE id = ?")
      .run(characterId)
    return getCharacterWithDetails(characterId)
  })

  ipcMain.handle(IPC.WORKFLOW_OPEN_CURRENT_WORK, () => {
    const currentWorkDir = join(getDataDir(), 'current-work')
    if (!existsSync(currentWorkDir)) {
      mkdirSync(currentWorkDir, { recursive: true })
    }
    shell.openPath(currentWorkDir)
  })
}
