import { ipcMain, dialog } from 'electron'
import { getDb, getDataDir } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { parseSeedFile } from '../seed-parser'
import { ensureCharacterFolder, writeCharacterFiles } from './utils'

export function registerImportHandlers(): void {
  ipcMain.handle(IPC.IMPORT_PARSE_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Seed File',
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    return parseSeedFile(result.filePaths[0])
  })

  ipcMain.handle(IPC.IMPORT_COMMIT, (_, entries: Array<{ raw_text: string; name: string | null }>) => {
    const db = getDb()
    const dataDir = getDataDir()
    const insertChar = db.prepare(`
      INSERT INTO characters (name, seed_text, folder_path)
      VALUES (?, ?, '')
    `)
    const updateFolder = db.prepare('UPDATE characters SET folder_path = ? WHERE id = ?')

    const transaction = db.transaction((items: Array<{ raw_text: string; name: string | null }>) => {
      const created: number[] = []
      for (const item of items) {
        const result = insertChar.run(item.name, item.raw_text)
        const id = result.lastInsertRowid as number
        const folderPath = ensureCharacterFolder(dataDir, id, item.name)
        updateFolder.run(folderPath, id)
        writeCharacterFiles(folderPath, { seed_text: item.raw_text })
        created.push(id)
      }
      return created
    })

    return transaction(entries)
  })
}
