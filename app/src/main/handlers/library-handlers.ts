import { ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  copyFileSync, readdirSync, statSync, rmSync
} from 'fs'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import { getDb, getDataDir, switchLibrary, initDatabase } from '../database'
import { backfillImageHashes, backfillThumbnails } from '../backfill'
import { IPC } from '../../shared/ipc-channels'
import type { LibraryEntry, LibraryRegistry } from '../../shared/types'
import { getAppRoot } from '../paths'

// Registry lives in the app root (project root in dev, userData in production)
const REGISTRY_PATH = join(getAppRoot(), 'libraries.json')

function saveRegistry(registry: LibraryRegistry): void {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8')
}

export function loadOrCreateRegistry(defaultDataDir: string): LibraryRegistry {
  if (existsSync(REGISTRY_PATH)) {
    try {
      const raw = readFileSync(REGISTRY_PATH, 'utf-8')
      const registry = JSON.parse(raw) as LibraryRegistry
      if (registry.libraries && registry.libraries.length > 0) {
        return registry
      }
    } catch {
      // Corruption — fall through to create fresh
    }
  }

  // First run: wrap existing data/ as the default library
  const id = randomUUID()
  const registry: LibraryRegistry = {
    version: 1,
    libraries: [{
      id,
      name: 'Main Collection',
      path: defaultDataDir,
      accentColor: '#7c3aed',
      icon: '\u{1F4DA}',
      isDefault: true,
      createdAt: new Date().toISOString()
    }],
    activeLibraryId: id
  }
  saveRegistry(registry)
  return registry
}

function getRegistry(): LibraryRegistry {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8')
  return JSON.parse(raw) as LibraryRegistry
}

function ensureTargetDb(targetPath: string): void {
  const targetDbPath = join(targetPath, 'database.sqlite')
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true })
  }
  if (!existsSync(targetDbPath)) {
    const currentDir = getDataDir()
    initDatabase(targetPath)
    switchLibrary(currentDir)
  }
}

// Copy a character and all its associated data into a target DB
function copyCharacterToTarget(
  characterId: number,
  targetEntry: LibraryEntry
): { newCharacterId: number } {
  const sourceDb = getDb()

  const character = sourceDb.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as Record<string, unknown> | undefined
  if (!character) throw new Error('Character not found')

  const tags = sourceDb.prepare(
    'SELECT t.name, t.category FROM character_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.character_id = ?'
  ).all(characterId) as Array<{ name: string; category: string | null }>

  const groups = sourceDb.prepare(
    'SELECT g.name FROM character_groups cg JOIN groups g ON g.id = cg.group_id WHERE cg.character_id = ?'
  ).all(characterId) as Array<{ name: string }>

  const images = sourceDb.prepare(
    'SELECT * FROM images WHERE character_id = ?'
  ).all(characterId) as Array<Record<string, unknown>>

  const customFieldValues = sourceDb.prepare(
    'SELECT cf.name, cfv.value FROM character_field_values cfv JOIN custom_fields cf ON cf.id = cfv.field_id WHERE cfv.character_id = ?'
  ).all(characterId) as Array<{ name: string; value: string }>

  ensureTargetDb(targetEntry.path)

  const targetDbPath = join(targetEntry.path, 'database.sqlite')
  const targetDb = new Database(targetDbPath)
  targetDb.pragma('journal_mode = WAL')
  targetDb.pragma('foreign_keys = ON')

  try {
    return targetDb.transaction(() => {
      const insertResult = targetDb.prepare(
        `INSERT INTO characters (name, seed_text, image_prompts, priority, status, folder_path, has_images, notes)
         VALUES (?, ?, ?, ?, ?, '', ?, ?)`
      ).run(
        character.name, character.seed_text, character.image_prompts,
        character.priority, character.status, character.has_images, character.notes
      )
      const newCharId = insertResult.lastInsertRowid as number

      const charName = (character.name as string | null) || null
      const folderName = charName
        ? `${newCharId}-${charName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50)}`
        : `${newCharId}`
      const folderPath = join(targetEntry.path, 'characters', folderName)
      mkdirSync(folderPath, { recursive: true })
      targetDb.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(folderPath, newCharId)

      // Copy source folder text files (seed.md, prompts.md, notes.md)
      const sourceFolderPath = character.folder_path as string
      if (sourceFolderPath && existsSync(sourceFolderPath)) {
        const entries = readdirSync(sourceFolderPath)
        for (const entry of entries) {
          const srcPath = join(sourceFolderPath, entry)
          if (statSync(srcPath).isFile()) {
            copyFileSync(srcPath, join(folderPath, entry))
          }
        }
      }

      // Copy images
      const imagesDir = join(folderPath, 'images')
      if (images.length > 0) {
        mkdirSync(imagesDir, { recursive: true })
      }
      for (const img of images) {
        const srcFile = img.file_path as string
        if (!existsSync(srcFile)) continue
        const filename = basename(srcFile)
        const destFile = join(imagesDir, filename)
        copyFileSync(srcFile, destFile)

        let newThumbPath: string | null = null
        const srcThumb = img.thumbnail_path as string | null
        if (srcThumb && existsSync(srcThumb)) {
          const thumbsDir = join(imagesDir, 'thumbs')
          mkdirSync(thumbsDir, { recursive: true })
          const thumbName = basename(srcThumb)
          newThumbPath = join(thumbsDir, thumbName)
          copyFileSync(srcThumb, newThumbPath)
        }

        targetDb.prepare(
          `INSERT INTO images (character_id, file_path, thumbnail_path, is_cover, original_filename, category_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(newCharId, destFile, newThumbPath, img.is_cover, img.original_filename, null)
      }

      for (const tag of tags) {
        targetDb.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)').run(tag.name, tag.category)
        const tagRow = targetDb.prepare('SELECT id FROM tags WHERE name = ?').get(tag.name) as { id: number }
        targetDb.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)').run(newCharId, tagRow.id)
      }

      for (const group of groups) {
        targetDb.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(group.name)
        const groupRow = targetDb.prepare('SELECT id FROM groups WHERE name = ?').get(group.name) as { id: number }
        targetDb.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)').run(newCharId, groupRow.id)
      }

      for (const cfv of customFieldValues) {
        targetDb.prepare('INSERT OR IGNORE INTO custom_fields (name) VALUES (?)').run(cfv.name)
        const fieldRow = targetDb.prepare('SELECT id FROM custom_fields WHERE name = ?').get(cfv.name) as { id: number }
        targetDb.prepare(
          'INSERT OR IGNORE INTO character_field_values (character_id, field_id, value) VALUES (?, ?, ?)'
        ).run(newCharId, fieldRow.id, cfv.value)
      }

      return { newCharacterId: newCharId }
    })()
  } finally {
    targetDb.close()
  }
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(IPC.LIBRARY_GET_ALL, () => {
    if (!existsSync(REGISTRY_PATH)) return { version: 1, libraries: [], activeLibraryId: '' }
    return getRegistry()
  })

  ipcMain.handle(IPC.LIBRARY_GET_ACTIVE, () => {
    if (!existsSync(REGISTRY_PATH)) return null
    const registry = getRegistry()
    return registry.libraries.find(l => l.id === registry.activeLibraryId) || null
  })

  ipcMain.handle(IPC.LIBRARY_SWITCH, (_, libraryId: string) => {
    const registry = getRegistry()
    const entry = registry.libraries.find(l => l.id === libraryId)
    if (!entry) return { error: 'Library not found' }

    if (!existsSync(entry.path)) {
      return { error: `Library folder not found: ${entry.path}` }
    }

    switchLibrary(entry.path)
    registry.activeLibraryId = libraryId
    saveRegistry(registry)

    backfillImageHashes()
    backfillThumbnails()

    return entry
  })

  ipcMain.handle(IPC.LIBRARY_CREATE, (_, opts: {
    name: string
    path: string
    accentColor: string
    icon: string
  }) => {
    const registry = getRegistry()

    if (!existsSync(opts.path)) {
      mkdirSync(opts.path, { recursive: true })
    }

    const id = randomUUID()
    const entry: LibraryEntry = {
      id,
      name: opts.name,
      path: opts.path,
      accentColor: opts.accentColor,
      icon: opts.icon,
      isDefault: false,
      createdAt: new Date().toISOString()
    }

    registry.libraries.push(entry)
    switchLibrary(opts.path)
    registry.activeLibraryId = id
    saveRegistry(registry)

    backfillImageHashes()
    backfillThumbnails()

    return entry
  })

  ipcMain.handle(IPC.LIBRARY_UPDATE, (_, id: string, updates: {
    name?: string
    accentColor?: string
    icon?: string
    isDefault?: boolean
  }) => {
    const registry = getRegistry()
    const entry = registry.libraries.find(l => l.id === id)
    if (!entry) return { error: 'Library not found' }

    if (updates.name !== undefined) entry.name = updates.name
    if (updates.accentColor !== undefined) entry.accentColor = updates.accentColor
    if (updates.icon !== undefined) entry.icon = updates.icon
    if (updates.isDefault) {
      for (const lib of registry.libraries) lib.isDefault = false
      entry.isDefault = true
    }

    saveRegistry(registry)
    return entry
  })

  ipcMain.handle(IPC.LIBRARY_DELETE, (_, id: string, deleteFiles: boolean) => {
    const registry = getRegistry()

    if (registry.libraries.length <= 1) {
      return { error: 'Cannot delete the last library' }
    }
    if (registry.activeLibraryId === id) {
      return { error: 'Cannot delete the active library. Switch to another library first.' }
    }

    const entry = registry.libraries.find(l => l.id === id)
    if (!entry) return { error: 'Library not found' }

    registry.libraries = registry.libraries.filter(l => l.id !== id)

    if (entry.isDefault && registry.libraries.length > 0) {
      registry.libraries[0].isDefault = true
    }

    saveRegistry(registry)

    if (deleteFiles && existsSync(entry.path)) {
      rmSync(entry.path, { recursive: true, force: true })
    }

    return { success: true }
  })

  ipcMain.handle(IPC.LIBRARY_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Library Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.LIBRARY_COPY_CHARACTER, (_, characterId: number, targetLibraryId: string) => {
    const registry = getRegistry()
    const targetEntry = registry.libraries.find(l => l.id === targetLibraryId)
    if (!targetEntry) return { error: 'Target library not found' }

    try {
      return copyCharacterToTarget(characterId, targetEntry)
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.LIBRARY_MOVE_CHARACTER, (_, characterId: number, targetLibraryId: string) => {
    const registry = getRegistry()
    const targetEntry = registry.libraries.find(l => l.id === targetLibraryId)
    if (!targetEntry) return { error: 'Target library not found' }

    const sourceDb = getDb()
    const character = sourceDb.prepare('SELECT folder_path FROM characters WHERE id = ?').get(characterId) as { folder_path: string } | undefined
    if (!character) return { error: 'Character not found' }

    try {
      const result = copyCharacterToTarget(characterId, targetEntry)

      // Delete from source after successful copy
      sourceDb.prepare('DELETE FROM characters WHERE id = ?').run(characterId)
      if (character.folder_path && existsSync(character.folder_path)) {
        rmSync(character.folder_path, { recursive: true, force: true })
      }

      return result
    } catch (err) {
      return { error: (err as Error).message }
    }
  })
}
