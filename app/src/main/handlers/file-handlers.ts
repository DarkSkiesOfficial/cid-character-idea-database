import { ipcMain, dialog, shell } from 'electron'
import { getDataDir } from '../database'
import { IPC } from '../../shared/ipc-channels'

export function registerFileHandlers(): void {
  ipcMain.handle(IPC.FILE_PICK_IMAGES, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Images',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle(IPC.FILE_OPEN_FOLDER, (_, folderPath: string) => {
    shell.openPath(folderPath)
  })

  ipcMain.handle(IPC.FILE_GET_DATA_PATH, () => {
    return getDataDir()
  })
}
