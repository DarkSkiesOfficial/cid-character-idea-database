import { ipcMain } from 'electron'
import { getDb, getDataDir } from '../database'
import { IPC } from '../../shared/ipc-channels'
import { ensureCharacterFolder, writeCharacterFiles, renameCharacterFolder, getCharacterWithDetails } from './utils'
import type { Character, CharacterQueryParams, CharacterStatus, AdvancedFilter } from '../../shared/types'

function buildAdvancedFilterClauses(
  af: AdvancedFilter,
  whereParts: string[],
  whereValues: unknown[]
): void {
  // Tag include: AND = all required, OR = any required
  if (af.tagIds && af.tagIds.length > 0) {
    if (af.tagLogic === 'or') {
      const placeholders = af.tagIds.map(() => '?').join(',')
      whereParts.push(
        `c.id IN (SELECT ct.character_id FROM character_tags ct WHERE ct.tag_id IN (${placeholders}))`
      )
      whereValues.push(...af.tagIds)
    } else {
      // AND: each tag must exist
      for (const tagId of af.tagIds) {
        whereParts.push(
          'EXISTS (SELECT 1 FROM character_tags ct WHERE ct.character_id = c.id AND ct.tag_id = ?)'
        )
        whereValues.push(tagId)
      }
    }
  }

  // Tag exclude: NOT these tags
  if (af.excludeTagIds && af.excludeTagIds.length > 0) {
    for (const tagId of af.excludeTagIds) {
      whereParts.push(
        'NOT EXISTS (SELECT 1 FROM character_tags ct WHERE ct.character_id = c.id AND ct.tag_id = ?)'
      )
      whereValues.push(tagId)
    }
  }

  // Group include: AND = all required, OR = any required
  if (af.groupIds && af.groupIds.length > 0) {
    if (af.groupLogic === 'or') {
      const placeholders = af.groupIds.map(() => '?').join(',')
      whereParts.push(
        `c.id IN (SELECT cg.character_id FROM character_groups cg WHERE cg.group_id IN (${placeholders}))`
      )
      whereValues.push(...af.groupIds)
    } else {
      for (const groupId of af.groupIds) {
        whereParts.push(
          'EXISTS (SELECT 1 FROM character_groups cg WHERE cg.character_id = c.id AND cg.group_id = ?)'
        )
        whereValues.push(groupId)
      }
    }
  }

  // Group exclude
  if (af.excludeGroupIds && af.excludeGroupIds.length > 0) {
    for (const groupId of af.excludeGroupIds) {
      whereParts.push(
        'NOT EXISTS (SELECT 1 FROM character_groups cg WHERE cg.character_id = c.id AND cg.group_id = ?)'
      )
      whereValues.push(groupId)
    }
  }

  // Custom field filters: substring match on value
  if (af.customFieldFilters && af.customFieldFilters.length > 0) {
    for (const cff of af.customFieldFilters) {
      whereParts.push(
        "EXISTS (SELECT 1 FROM character_field_values cfv WHERE cfv.character_id = c.id AND cfv.field_id = ? AND cfv.value LIKE '%' || ? || '%')"
      )
      whereValues.push(cff.fieldId, cff.value)
    }
  }

  // Integrated text search
  if (af.textSearch) {
    const like = `%${af.textSearch}%`
    whereParts.push(
      '(c.name LIKE ? OR c.seed_text LIKE ? OR c.image_prompts LIKE ? OR c.notes LIKE ?)'
    )
    whereValues.push(like, like, like, like)
  }
}

interface ImageRow {
  character_id: number
  file_path: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  is_cover: number
  category_name: string | null
}

interface GroupRow {
  character_id: number
  name: string
}

interface FieldPreviewRow {
  character_id: number
  field_name: string
  value: string
}

function assembleCharacterSummaries(characters: Character[]) {
  if (characters.length === 0) return []

  const db = getDb()
  const characterIds = characters.map(c => c.id)
  const placeholders = characterIds.map(() => '?').join(',')

  // Batch: all images for all characters
  const allImages = db.prepare(`
    SELECT i.character_id, i.file_path, i.thumbnail_path, i.width, i.height, i.is_cover,
           cc.name as category_name
    FROM images i
    LEFT JOIN content_categories cc ON cc.id = i.category_id
    WHERE i.character_id IN (${placeholders})
    ORDER BY i.is_cover DESC, i.id ASC
  `).all(...characterIds) as ImageRow[]

  // Batch: all group memberships
  const allGroups = db.prepare(`
    SELECT cg.character_id, g.name
    FROM character_groups cg
    JOIN groups g ON g.id = cg.group_id
    WHERE cg.character_id IN (${placeholders})
    ORDER BY g.name
  `).all(...characterIds) as GroupRow[]

  // Batch: all custom field previews (show_on_card fields)
  const allFieldPreviews = db.prepare(`
    SELECT cfv.character_id, cf.name as field_name, cfv.value
    FROM character_field_values cfv
    JOIN custom_fields cf ON cf.id = cfv.field_id
    WHERE cfv.character_id IN (${placeholders})
      AND cf.show_on_card = 1 AND cfv.value != ''
    ORDER BY cf.sort_order
  `).all(...characterIds) as FieldPreviewRow[]

  // Build lookup maps
  const imagesByChar = new Map<number, ImageRow[]>()
  for (const img of allImages) {
    let arr = imagesByChar.get(img.character_id)
    if (!arr) { arr = []; imagesByChar.set(img.character_id, arr) }
    arr.push(img)
  }

  const groupsByChar = new Map<number, string[]>()
  for (const gm of allGroups) {
    let arr = groupsByChar.get(gm.character_id)
    if (!arr) { arr = []; groupsByChar.set(gm.character_id, arr) }
    arr.push(gm.name)
  }

  const fieldsByChar = new Map<number, { field_name: string; value: string }[]>()
  for (const fv of allFieldPreviews) {
    let arr = fieldsByChar.get(fv.character_id)
    if (!arr) { arr = []; fieldsByChar.set(fv.character_id, arr) }
    if (arr.length < 2) arr.push({ field_name: fv.field_name, value: fv.value })
  }

  return characters.map((c) => {
    const imageRows = imagesByChar.get(c.id) || []
    const coverRow = imageRows.find(r => r.is_cover) || imageRows[0] || null

    const imagesByCategory: Record<string, string[]> = {}
    for (const row of imageRows) {
      const cat = row.category_name || 'Default'
      if (!imagesByCategory[cat]) imagesByCategory[cat] = []
      imagesByCategory[cat].push(row.file_path)
    }

    return {
      ...c,
      has_images: !!c.has_images,
      image_paths: imageRows.map(r => r.file_path),
      thumbnail_paths: imageRows.map(r => r.thumbnail_path),
      images_by_category: imagesByCategory,
      group_names: groupsByChar.get(c.id) || [],
      cover_width: coverRow?.width || null,
      cover_height: coverRow?.height || null,
      custom_field_preview: fieldsByChar.get(c.id) || []
    }
  })
}

export function registerCharacterHandlers(): void {
  ipcMain.handle(IPC.DB_GET_ALL_CHARACTERS, (_, params?: CharacterQueryParams) => {
    const db = getDb()
    const sortField = params?.sortField || 'priority'
    const sortDirection = params?.sortDirection || 'desc'
    const statusFilter = params?.statusFilter || 'all'
    const tagFilter = params?.tagFilter

    let joinClause = ''
    const whereParts: string[] = []
    const whereValues: unknown[] = []

    if (statusFilter !== 'all') {
      whereParts.push('c.status = ?')
      whereValues.push(statusFilter)
    }

    if (tagFilter) {
      joinClause += ' JOIN character_tags ct ON ct.character_id = c.id'
      whereParts.push('ct.tag_id = ?')
      whereValues.push(tagFilter)
    }

    const groupFilter = params?.groupFilter
    if (groupFilter) {
      joinClause += ' JOIN character_groups cgf ON cgf.character_id = c.id'
      whereParts.push('cgf.group_id = ?')
      whereValues.push(groupFilter)
    }

    // Advanced filters
    const af = params?.advancedFilter
    if (af) {
      buildAdvancedFilterClauses(af, whereParts, whereValues)
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

    let orderClause: string
    if (sortField === 'random') {
      orderClause = 'ORDER BY RANDOM()'
    } else if (sortField === 'name') {
      const dir = sortDirection === 'asc' ? 'ASC' : 'DESC'
      orderClause = `ORDER BY CASE WHEN c.name IS NULL THEN 1 ELSE 0 END, c.name ${dir}`
    } else if (sortField === 'priority') {
      const dir = sortDirection === 'asc' ? 'ASC' : 'DESC'
      orderClause = `ORDER BY c.priority ${dir}, c.updated_at DESC`
    } else {
      const columnMap: Record<string, string> = {
        created_at: 'c.created_at',
        updated_at: 'c.updated_at'
      }
      const column = columnMap[sortField] || 'c.updated_at'
      const dir = sortDirection === 'asc' ? 'ASC' : 'DESC'
      orderClause = `ORDER BY ${column} ${dir}`
    }

    const characters = db.prepare(`
      SELECT c.* FROM characters c
      ${joinClause}
      ${whereClause}
      ${orderClause}
    `).all(...whereValues) as Character[]

    return assembleCharacterSummaries(characters)
  })

  ipcMain.handle(IPC.DB_GET_CHARACTER, (_, id: number) => {
    return getCharacterWithDetails(id)
  })

  ipcMain.handle(IPC.DB_CREATE_CHARACTER, (_, data: Partial<Character> & { group_names?: string[] }) => {
    const db = getDb()
    const dataDir = getDataDir()
    const result = db.prepare(`
      INSERT INTO characters (name, seed_text, image_prompts, priority, folder_path, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.name || null,
      data.seed_text || '',
      data.image_prompts || null,
      data.priority || 3,
      '',
      data.notes || null
    )

    const id = result.lastInsertRowid as number
    const folderPath = ensureCharacterFolder(dataDir, id, data.name || null)

    db.prepare('UPDATE characters SET folder_path = ? WHERE id = ?').run(folderPath, id)

    writeCharacterFiles(folderPath, {
      seed_text: data.seed_text as string || '',
      image_prompts: data.image_prompts as string | null,
      notes: data.notes as string | null
    })

    if (data.group_names && data.group_names.length > 0) {
      const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)')
      const getGroup = db.prepare('SELECT id FROM groups WHERE name = ?')
      const linkGroup = db.prepare('INSERT OR IGNORE INTO character_groups (character_id, group_id) VALUES (?, ?)')

      for (const groupName of data.group_names) {
        const trimmed = groupName.trim()
        if (!trimmed) continue
        insertGroup.run(trimmed)
        const group = getGroup.get(trimmed) as { id: number }
        linkGroup.run(id, group.id)
      }
    }

    return getCharacterWithDetails(id)
  })

  ipcMain.handle(IPC.DB_UPDATE_CHARACTER, (_, id: number, data: Partial<Character>) => {
    const db = getDb()
    const dataDir = getDataDir()
    const existing = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as Character | undefined
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.seed_text !== undefined) { fields.push('seed_text = ?'); values.push(data.seed_text) }
    if (data.image_prompts !== undefined) { fields.push('image_prompts = ?'); values.push(data.image_prompts) }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes) }

    fields.push("updated_at = datetime('now')")
    values.push(id)

    db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    let folderPath = existing.folder_path
    if (data.name !== undefined && data.name !== existing.name) {
      folderPath = renameCharacterFolder(dataDir, id, existing.folder_path, data.name || null)
    }

    writeCharacterFiles(folderPath, {
      seed_text: data.seed_text,
      image_prompts: data.image_prompts,
      notes: data.notes
    })

    return getCharacterWithDetails(id)
  })

  ipcMain.handle(IPC.DB_DELETE_CHARACTER, (_, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM characters WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_SET_PRIORITY, (_, characterIds: number[], priority: number) => {
    const db = getDb()
    const placeholders = characterIds.map(() => '?').join(',')
    db.prepare(`UPDATE characters SET priority = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(priority, ...characterIds)
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_SET_STATUS, (_, characterIds: number[], status: CharacterStatus) => {
    const db = getDb()
    const placeholders = characterIds.map(() => '?').join(',')
    db.prepare(`UPDATE characters SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(status, ...characterIds)
    return true
  })

  ipcMain.handle(IPC.DB_BATCH_DELETE, (_, characterIds: number[]) => {
    const db = getDb()
    const placeholders = characterIds.map(() => '?').join(',')
    const batch = db.transaction(() => {
      db.prepare(`DELETE FROM characters WHERE id IN (${placeholders})`).run(...characterIds)
    })
    batch()
    return true
  })

  ipcMain.handle(IPC.DB_SEARCH_CHARACTERS, (_, query: string) => {
    const db = getDb()
    const like = `%${query}%`
    const characters = db.prepare(`
      SELECT c.*
      FROM characters c
      WHERE c.name LIKE ? OR c.seed_text LIKE ? OR c.image_prompts LIKE ? OR c.notes LIKE ?
      ORDER BY c.priority DESC, c.updated_at DESC
    `).all(like, like, like, like) as Character[]

    return assembleCharacterSummaries(characters)
  })
}
