import { ipcMain, dialog } from 'electron'
import { join, basename } from 'path'
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  copyFileSync, readdirSync, statSync, rmSync, unlinkSync
} from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import Database from 'better-sqlite3'
import { getDb, getDataDir, CURRENT_SCHEMA_VERSION, initDatabase, switchLibrary } from '../database'
import { backfillImageHashes, backfillThumbnails } from '../backfill'
import { IPC } from '../../shared/ipc-channels'
import { slugify, ensureCharacterFolder, writeCharacterFiles } from './utils'
import type { ExportMetadata, ImportPreview, LibraryEntry, LibraryRegistry } from '../../shared/types'
import { getAppRoot } from '../paths'

// Registry path — matches library-handlers.ts
const REGISTRY_PATH = join(getAppRoot(), 'libraries.json')

function getRegistry(): LibraryRegistry {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8')
  return JSON.parse(raw) as LibraryRegistry
}

function saveRegistry(registry: LibraryRegistry): void {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8')
}

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

function addFolderToZip(zip: AdmZip, folderPath: string, zipPrefix: string): void {
  if (!existsSync(folderPath)) return
  const entries = readdirSync(folderPath)
  for (const entry of entries) {
    const fullPath = join(folderPath, entry)
    const zipPath = zipPrefix ? `${zipPrefix}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      addFolderToZip(zip, fullPath, zipPath)
    } else {
      zip.addFile(zipPath, readFileSync(fullPath))
    }
  }
}

function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `cid-${prefix}-${randomUUID().substring(0, 8)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function registerExportImportHandlers(): void {

  // ── Full Library Export ──────────────────────────────────────
  ipcMain.handle(IPC.EXPORT_LIBRARY, async () => {
    const db = getDb()
    const dataDir = getDataDir()

    // Get library name for default filename
    const registry = getRegistry()
    const activeLib = registry.libraries.find(l => l.id === registry.activeLibraryId)
    const libName = activeLib?.name || 'library'
    const dateStr = new Date().toISOString().split('T')[0]
    const defaultName = `${slugify(libName)}-export-${dateStr}.zip`

    const result = await dialog.showSaveDialog({
      title: 'Export Library',
      defaultPath: defaultName,
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    const destPath = result.filePath

    // Backup the database to a temp file (handles WAL safely)
    const tempDir = makeTempDir('export')
    const tempDbPath = join(tempDir, 'database.sqlite')

    try {
      await db.backup(tempDbPath)

      const zip = new AdmZip()

      // Add database backup
      zip.addFile('database.sqlite', readFileSync(tempDbPath))

      // Add characters folder
      const charsDir = join(dataDir, 'characters')
      if (existsSync(charsDir)) {
        addFolderToZip(zip, charsDir, 'characters')
      }

      // Build metadata
      const charCount = db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }
      const imgCount = db.prepare('SELECT COUNT(*) as count FROM images').get() as { count: number }

      const metadata: ExportMetadata = {
        formatVersion: 1,
        type: 'library',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportDate: new Date().toISOString(),
        libraryName: libName,
        characterCount: charCount.count,
        imageCount: imgCount.count
      }
      zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'))

      zip.writeZip(destPath)

      return {
        path: destPath,
        characterCount: charCount.count,
        imageCount: imgCount.count
      }
    } finally {
      // Clean up temp
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  // ── Single Character Export ──────────────────────────────────
  ipcMain.handle(IPC.EXPORT_CHARACTER, async (_, characterId: number) => {
    const db = getDb()

    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as Record<string, unknown> | undefined
    if (!character) return { error: 'Character not found' }

    const charName = (character.name as string | null) || 'unnamed'
    const defaultName = `${slugify(charName)}-export.zip`

    const result = await dialog.showSaveDialog({
      title: 'Export Character',
      defaultPath: defaultName,
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    // Gather related data
    const tags = db.prepare(
      'SELECT t.name, t.category FROM character_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.character_id = ?'
    ).all(characterId) as Array<{ name: string; category: string | null }>

    const groups = db.prepare(
      'SELECT g.name FROM character_groups cg JOIN groups g ON g.id = cg.group_id WHERE cg.character_id = ?'
    ).all(characterId) as Array<{ name: string }>

    const customFieldValues = db.prepare(
      'SELECT cf.name, cfv.value FROM character_field_values cfv JOIN custom_fields cf ON cf.id = cfv.field_id WHERE cfv.character_id = ?'
    ).all(characterId) as Array<{ name: string; value: string }>

    const images = db.prepare(
      'SELECT file_path, is_cover, original_filename, category_id FROM images WHERE character_id = ?'
    ).all(characterId) as Array<{ file_path: string; is_cover: number; original_filename: string | null; category_id: number | null }>

    // Build character.json
    const charJson = {
      formatVersion: 1,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      character: {
        name: character.name,
        seed_text: character.seed_text,
        image_prompts: character.image_prompts,
        notes: character.notes,
        priority: character.priority,
        status: character.status
      },
      tags: tags.map(t => ({ name: t.name, category: t.category })),
      groups: groups.map(g => g.name),
      customFieldValues: customFieldValues.map(cfv => ({ name: cfv.name, value: cfv.value })),
      images: images.map(img => ({
        filename: basename(img.file_path),
        is_cover: !!img.is_cover,
        original_filename: img.original_filename
      }))
    }

    const zip = new AdmZip()
    zip.addFile('character.json', Buffer.from(JSON.stringify(charJson, null, 2), 'utf-8'))

    // Add character folder files (md files + images)
    const folderPath = character.folder_path as string
    if (folderPath && existsSync(folderPath)) {
      addFolderToZip(zip, folderPath, 'files')
    }

    zip.writeZip(result.filePath)
    return { path: result.filePath }
  })

  // ── Import Library Preview ───────────────────────────────────
  ipcMain.handle(IPC.IMPORT_LIBRARY_PREVIEW, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Library Archive',
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }

    const zipPath = result.filePaths[0]

    try {
      const zip = new AdmZip(zipPath)
      const metadataEntry = zip.getEntry('metadata.json')

      if (!metadataEntry) {
        return {
          valid: false,
          error: 'Not a valid library archive — missing metadata.json',
          zipPath,
          metadata: null,
          characterNames: [],
          totalSize: 0
        } as ImportPreview & { canceled?: boolean }
      }

      const metadata = JSON.parse(metadataEntry.getData().toString('utf-8')) as ExportMetadata

      if (metadata.type !== 'library') {
        return {
          valid: false,
          error: 'This is a character export, not a library export. Use "Import Character" instead.',
          zipPath,
          metadata,
          characterNames: [],
          totalSize: 0
        } as ImportPreview
      }

      if (metadata.schemaVersion > CURRENT_SCHEMA_VERSION) {
        return {
          valid: false,
          error: `This archive was exported from a newer app version (schema v${metadata.schemaVersion}, current is v${CURRENT_SCHEMA_VERSION}). Update the app first.`,
          zipPath,
          metadata,
          characterNames: [],
          totalSize: 0
        } as ImportPreview
      }

      // Read character names from embedded DB
      const tempDir = makeTempDir('preview')
      let characterNames: string[] = []

      try {
        const dbEntry = zip.getEntry('database.sqlite')
        if (dbEntry) {
          const tempDbPath = join(tempDir, 'database.sqlite')
          writeFileSync(tempDbPath, dbEntry.getData())
          const tempDb = new Database(tempDbPath, { readonly: true })
          try {
            characterNames = tempDb.prepare(
              'SELECT name FROM characters ORDER BY id LIMIT 20'
            ).all().map((r: any) => r.name || '(unnamed)')
          } finally {
            tempDb.close()
          }
        }
      } finally {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      }

      const stat = statSync(zipPath)

      return {
        metadata,
        characterNames,
        totalSize: stat.size,
        valid: true,
        zipPath
      } as ImportPreview

    } catch (err) {
      return {
        valid: false,
        error: `Failed to read archive: ${(err as Error).message}`,
        zipPath,
        metadata: null,
        characterNames: [],
        totalSize: 0
      } as ImportPreview & { canceled?: boolean }
    }
  })

  // ── Import Library as New ────────────────────────────────────
  ipcMain.handle(IPC.IMPORT_LIBRARY_AS_NEW, async (_, opts: {
    zipPath: string
    libraryName: string
  }) => {
    const { zipPath, libraryName } = opts

    // Determine destination folder
    const destFolder = join(getAppRoot(), `data-${slugify(libraryName)}-${randomUUID().substring(0, 6)}`)
    mkdirSync(destFolder, { recursive: true })

    try {
      const zip = new AdmZip(zipPath)

      // Extract database.sqlite and characters/ to destFolder
      const entries = zip.getEntries()
      for (const entry of entries) {
        if (entry.entryName === 'metadata.json') continue // Skip metadata
        if (entry.isDirectory) continue

        const destPath = join(destFolder, entry.entryName)
        mkdirSync(join(destPath, '..'), { recursive: true })
        writeFileSync(destPath, entry.getData())
      }

      // Run initDatabase on the extracted DB to apply any needed schema migrations
      const currentDir = getDataDir()
      initDatabase(destFolder)

      // Fix folder_path references — they point to the old library's paths
      const importedDb = getDb()
      const chars = importedDb.prepare('SELECT id, name, folder_path FROM characters').all() as Array<{
        id: number
        name: string | null
        folder_path: string
      }>

      for (const char of chars) {
        // Rebuild folder path to point to the new location
        const slug = char.name ? slugify(char.name) : 'unnamed'
        const folderName = `${String(char.id).padStart(4, '0')}-${slug}`
        const newFolderPath = join(destFolder, 'characters', folderName)

        // Check if the extracted folder exists (might have a different name from export)
        if (char.folder_path && !existsSync(newFolderPath)) {
          // Try to find the folder by ID prefix
          const charsDir = join(destFolder, 'characters')
          if (existsSync(charsDir)) {
            const folders = readdirSync(charsDir)
            const match = folders.find(f => f.startsWith(`${String(char.id).padStart(4, '0')}-`) || f === String(char.id))
            if (match) {
              const matchedPath = join(charsDir, match)
              if (matchedPath !== newFolderPath) {
                // Folder exists with old name — that's fine, use it as-is
                importedDb.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(matchedPath, char.id)
                // Fix image paths too
                const images = importedDb.prepare('SELECT id, file_path, thumbnail_path FROM images WHERE character_id = ?')
                  .all(char.id) as Array<{ id: number; file_path: string; thumbnail_path: string | null }>
                for (const img of images) {
                  const imgFilename = basename(img.file_path)
                  const newImgPath = join(matchedPath, 'images', imgFilename)
                  let newThumbPath: string | null = null
                  if (img.thumbnail_path) {
                    const thumbFilename = basename(img.thumbnail_path)
                    const candidateThumb = join(matchedPath, 'images', 'thumbs', thumbFilename)
                    if (existsSync(candidateThumb)) newThumbPath = candidateThumb
                  }
                  importedDb.prepare('UPDATE images SET file_path = ?, thumbnail_path = ? WHERE id = ?')
                    .run(newImgPath, newThumbPath, img.id)
                }
                continue
              }
            }
          }
        }

        importedDb.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(newFolderPath, char.id)

        // Fix image paths
        const images = importedDb.prepare('SELECT id, file_path, thumbnail_path FROM images WHERE character_id = ?')
          .all(char.id) as Array<{ id: number; file_path: string; thumbnail_path: string | null }>
        for (const img of images) {
          const imgFilename = basename(img.file_path)
          const newImgPath = join(newFolderPath, 'images', imgFilename)
          let newThumbPath: string | null = null
          if (img.thumbnail_path) {
            const thumbFilename = basename(img.thumbnail_path)
            const candidateThumb = join(newFolderPath, 'images', 'thumbs', thumbFilename)
            if (existsSync(candidateThumb)) newThumbPath = candidateThumb
          }
          importedDb.prepare('UPDATE images SET file_path = ?, thumbnail_path = ? WHERE id = ?')
            .run(newImgPath, newThumbPath, img.id)
        }
      }

      // Switch back to the original library
      switchLibrary(currentDir)

      // Register new library
      const registry = getRegistry()
      const newLibId = randomUUID()
      const newEntry: LibraryEntry = {
        id: newLibId,
        name: libraryName,
        path: destFolder,
        accentColor: '#3b82f6',
        icon: '\u{1F4E6}',
        isDefault: false,
        createdAt: new Date().toISOString()
      }
      registry.libraries.push(newEntry)
      saveRegistry(registry)

      const charCount = chars.length

      return { libraryId: newLibId, libraryName, characterCount: charCount }

    } catch (err) {
      // Clean up on failure
      if (existsSync(destFolder)) {
        rmSync(destFolder, { recursive: true, force: true })
      }
      return { error: (err as Error).message }
    }
  })

  // ── Import Library Merge ─────────────────────────────────────
  ipcMain.handle(IPC.IMPORT_LIBRARY_MERGE, async (_, opts: { zipPath: string }) => {
    const { zipPath } = opts
    const currentDb = getDb()
    const currentDataDir = getDataDir()

    const tempDir = makeTempDir('merge')

    try {
      const zip = new AdmZip(zipPath)

      // Extract everything to temp
      zip.extractAllTo(tempDir, true)

      // Open the extracted database
      const extractedDbPath = join(tempDir, 'database.sqlite')
      if (!existsSync(extractedDbPath)) {
        return { error: 'Archive does not contain a database file' }
      }

      const extractedDb = new Database(extractedDbPath, { readonly: true })

      try {
        const chars = extractedDb.prepare('SELECT * FROM characters').all() as Array<Record<string, unknown>>
        let importedCount = 0

        for (const char of chars) {
          const oldId = char.id as number
          const charName = (char.name as string | null) || null

          // Insert character into current DB
          const insertResult = currentDb.prepare(
            `INSERT INTO characters (name, seed_text, image_prompts, priority, status, folder_path, has_images, notes)
             VALUES (?, ?, ?, ?, ?, '', ?, ?)`
          ).run(
            char.name, char.seed_text, char.image_prompts,
            char.priority, char.status, char.has_images, char.notes
          )
          const newId = insertResult.lastInsertRowid as number

          // Create folder in current library
          const folderPath = ensureCharacterFolder(currentDataDir, newId, charName)
          currentDb.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(folderPath, newId)

          // Copy character files from extracted temp to new folder
          // Find the extracted character folder by old ID prefix
          const extractedCharsDir = join(tempDir, 'characters')
          if (existsSync(extractedCharsDir)) {
            const folders = readdirSync(extractedCharsDir)
            const oldFolderName = folders.find(f =>
              f.startsWith(`${String(oldId).padStart(4, '0')}-`) || f === String(oldId)
            )
            if (oldFolderName) {
              const srcFolder = join(extractedCharsDir, oldFolderName)
              // Copy md files
              const files = readdirSync(srcFolder)
              for (const file of files) {
                const srcPath = join(srcFolder, file)
                if (statSync(srcPath).isFile()) {
                  copyFileSync(srcPath, join(folderPath, file))
                }
              }
              // Copy images folder
              const srcImagesDir = join(srcFolder, 'images')
              if (existsSync(srcImagesDir)) {
                const destImagesDir = join(folderPath, 'images')
                copyFolderSync(srcImagesDir, destImagesDir)
              }
            }
          }

          // Import images from extracted DB
          const images = extractedDb.prepare(
            'SELECT * FROM images WHERE character_id = ?'
          ).all(oldId) as Array<Record<string, unknown>>

          for (const img of images) {
            const oldFilePath = img.file_path as string
            const filename = basename(oldFilePath)
            const newFilePath = join(folderPath, 'images', filename)
            let newThumbPath: string | null = null
            const oldThumbPath = img.thumbnail_path as string | null
            if (oldThumbPath) {
              const thumbFilename = basename(oldThumbPath)
              const candidateThumb = join(folderPath, 'images', 'thumbs', thumbFilename)
              if (existsSync(candidateThumb)) newThumbPath = candidateThumb
            }

            if (existsSync(newFilePath)) {
              currentDb.prepare(
                `INSERT INTO images (character_id, file_path, thumbnail_path, is_cover, original_filename, category_id)
                 VALUES (?, ?, ?, ?, ?, ?)`
              ).run(newId, newFilePath, newThumbPath, img.is_cover, img.original_filename, null)
            }
          }

          // Merge tags
          const tags = extractedDb.prepare(
            'SELECT t.name, t.category FROM character_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.character_id = ?'
          ).all(oldId) as Array<{ name: string; category: string | null }>

          for (const tag of tags) {
            currentDb.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)').run(tag.name, tag.category)
            const tagRow = currentDb.prepare('SELECT id FROM tags WHERE name = ?').get(tag.name) as { id: number }
            currentDb.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)').run(newId, tagRow.id)
          }

          // Merge groups
          const groups = extractedDb.prepare(
            'SELECT g.name FROM character_groups cg JOIN groups g ON g.id = cg.group_id WHERE cg.character_id = ?'
          ).all(oldId) as Array<{ name: string }>

          for (const group of groups) {
            currentDb.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(group.name)
            const groupRow = currentDb.prepare('SELECT id FROM groups WHERE name = ?').get(group.name) as { id: number }
            currentDb.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)').run(newId, groupRow.id)
          }

          // Merge custom fields
          let hasCustomFields = true
          try {
            extractedDb.prepare('SELECT 1 FROM custom_fields LIMIT 1').get()
          } catch {
            hasCustomFields = false
          }

          if (hasCustomFields) {
            const cfvs = extractedDb.prepare(
              'SELECT cf.name, cfv.value FROM character_field_values cfv JOIN custom_fields cf ON cf.id = cfv.field_id WHERE cfv.character_id = ?'
            ).all(oldId) as Array<{ name: string; value: string }>

            for (const cfv of cfvs) {
              currentDb.prepare('INSERT OR IGNORE INTO custom_fields (name) VALUES (?)').run(cfv.name)
              const fieldRow = currentDb.prepare('SELECT id FROM custom_fields WHERE name = ?').get(cfv.name) as { id: number }
              currentDb.prepare(
                'INSERT OR IGNORE INTO character_field_values (character_id, field_id, value) VALUES (?, ?, ?)'
              ).run(newId, fieldRow.id, cfv.value)
            }
          }

          importedCount++
        }

        return { importedCount }

      } finally {
        extractedDb.close()
      }

    } finally {
      // Clean up temp
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
      // Run backfills
      backfillImageHashes()
      backfillThumbnails()
    }
  })

  // ── Single Character Import ──────────────────────────────────
  ipcMain.handle(IPC.IMPORT_CHARACTER, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Character Archive',
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { canceled: true }

    const zipPath = result.filePaths[0]
    const currentDb = getDb()
    const currentDataDir = getDataDir()

    const tempDir = makeTempDir('char-import')

    try {
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(tempDir, true)

      const charJsonPath = join(tempDir, 'character.json')
      if (!existsSync(charJsonPath)) {
        return { error: 'Not a valid character archive — missing character.json' }
      }

      const charData = JSON.parse(readFileSync(charJsonPath, 'utf-8'))
      const char = charData.character

      // Insert character
      const insertResult = currentDb.prepare(
        `INSERT INTO characters (name, seed_text, image_prompts, priority, status, folder_path, has_images, notes)
         VALUES (?, ?, ?, ?, ?, '', ?, ?)`
      ).run(
        char.name, char.seed_text, char.image_prompts,
        char.priority, char.status || 'waiting',
        charData.images && charData.images.length > 0 ? 1 : 0,
        char.notes
      )
      const newId = insertResult.lastInsertRowid as number
      const charName = char.name || null

      // Create folder
      const folderPath = ensureCharacterFolder(currentDataDir, newId, charName)
      currentDb.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(folderPath, newId)

      // Copy extracted files to character folder
      const filesDir = join(tempDir, 'files')
      if (existsSync(filesDir)) {
        const entries = readdirSync(filesDir)
        for (const entry of entries) {
          const srcPath = join(filesDir, entry)
          const destPath = join(folderPath, entry)
          if (statSync(srcPath).isDirectory()) {
            copyFolderSync(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        }
      }

      // Write character files from data (in case folder didn't include them)
      writeCharacterFiles(folderPath, {
        seed_text: char.seed_text,
        image_prompts: char.image_prompts,
        notes: char.notes
      })

      // Register images in DB
      if (charData.images) {
        for (const img of charData.images) {
          const imgPath = join(folderPath, 'images', img.filename)
          if (existsSync(imgPath)) {
            currentDb.prepare(
              `INSERT INTO images (character_id, file_path, is_cover, original_filename, category_id)
               VALUES (?, ?, ?, ?, ?)`
            ).run(newId, imgPath, img.is_cover ? 1 : 0, img.original_filename, null)
          }
        }
      }

      // Merge tags
      if (charData.tags) {
        for (const tag of charData.tags) {
          currentDb.prepare('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)').run(tag.name, tag.category || null)
          const tagRow = currentDb.prepare('SELECT id FROM tags WHERE name = ?').get(tag.name) as { id: number }
          currentDb.prepare('INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)').run(newId, tagRow.id)
        }
      }

      // Merge groups
      if (charData.groups) {
        for (const group of charData.groups) {
          currentDb.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(group)
          const groupRow = currentDb.prepare('SELECT id FROM groups WHERE name = ?').get(group) as { id: number }
          currentDb.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)').run(newId, groupRow.id)
        }
      }

      // Merge custom fields
      if (charData.customFieldValues) {
        for (const cfv of charData.customFieldValues) {
          currentDb.prepare('INSERT OR IGNORE INTO custom_fields (name) VALUES (?)').run(cfv.name)
          const fieldRow = currentDb.prepare('SELECT id FROM custom_fields WHERE name = ?').get(cfv.name) as { id: number }
          currentDb.prepare(
            'INSERT OR IGNORE INTO character_field_values (character_id, field_id, value) VALUES (?, ?, ?)'
          ).run(newId, fieldRow.id, cfv.value)
        }
      }

      // Run backfills for the new character's images
      backfillImageHashes()
      backfillThumbnails()

      return { characterId: newId, characterName: charName || 'Unnamed' }

    } finally {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })
}
