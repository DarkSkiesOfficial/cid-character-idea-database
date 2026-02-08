import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'

export const CURRENT_SCHEMA_VERSION = 7

let db: Database.Database | null = null
let currentDataDir: string = ''

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getDataDir(): string {
  if (!currentDataDir) throw new Error('Data directory not set')
  return currentDataDir
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function switchLibrary(dataDir: string): void {
  closeDb()
  initDatabase(dataDir)
}

export function initDatabase(dataDir: string): void {
  currentDataDir = dataDir
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = join(dataDir, 'database.sqlite')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion === 0) {
    // Check if tables already exist (Phase 1 DB without versioning)
    const hasCharacters = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='characters'"
    ).get()

    if (hasCharacters) {
      // Existing Phase 1 database — run migration
      runMigrations(0)
    } else {
      // Fresh install — create full Phase 2 schema
      createTables()
    }
  } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
    runMigrations(currentVersion)
  }
}

function runMigrations(fromVersion: number): void {
  const database = getDb()

  if (fromVersion < 1) {
    const migrate = database.transaction(() => {
      // Add status column
      database.exec(`ALTER TABLE characters ADD COLUMN status TEXT NOT NULL DEFAULT 'waiting'`)

      // Add last_viewed_at column
      database.exec(`ALTER TABLE characters ADD COLUMN last_viewed_at TEXT`)

      // Create groups table
      database.exec(`
        CREATE TABLE IF NOT EXISTS groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Create character_groups junction table
      database.exec(`
        CREATE TABLE IF NOT EXISTS character_groups (
          character_id INTEGER NOT NULL,
          group_id INTEGER NOT NULL,
          PRIMARY KEY (character_id, group_id),
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
      `)

      // Migrate set_name data into groups + character_groups
      database.exec(`
        INSERT OR IGNORE INTO groups (name)
          SELECT DISTINCT set_name FROM characters
          WHERE set_name IS NOT NULL AND set_name != ''
      `)

      database.exec(`
        INSERT INTO character_groups (character_id, group_id)
          SELECT c.id, g.id FROM characters c
          JOIN groups g ON g.name = c.set_name
          WHERE c.set_name IS NOT NULL AND c.set_name != ''
      `)

      // Drop index that references set_name before dropping the column
      database.exec(`DROP INDEX IF EXISTS idx_characters_set`)

      // Drop set_name column (SQLite 3.35.0+)
      database.exec(`ALTER TABLE characters DROP COLUMN set_name`)

      // Add new indexes
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_characters_status ON characters(status);
        CREATE INDEX IF NOT EXISTS idx_characters_last_viewed ON characters(last_viewed_at);
        CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
        CREATE INDEX IF NOT EXISTS idx_character_groups_character ON character_groups(character_id);
        CREATE INDEX IF NOT EXISTS idx_character_groups_group ON character_groups(group_id);
      `)
    })

    migrate()
    database.pragma('user_version = 1')
  }

  if (fromVersion < 2) {
    const migrate2 = database.transaction(() => {
      // Image hashing columns for duplicate detection
      database.exec(`ALTER TABLE images ADD COLUMN phash TEXT`)
      database.exec(`ALTER TABLE images ADD COLUMN byte_hash TEXT`)
      database.exec(`ALTER TABLE images ADD COLUMN width INTEGER`)
      database.exec(`ALTER TABLE images ADD COLUMN height INTEGER`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_images_byte_hash ON images(byte_hash)`)

      // Content categories for custom sub-folders
      database.exec(`
        CREATE TABLE IF NOT EXISTS content_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          slug TEXT NOT NULL UNIQUE,
          is_image_type INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Link images to categories
      database.exec(`ALTER TABLE images ADD COLUMN category_id INTEGER REFERENCES content_categories(id) ON DELETE SET NULL`)

      // Settings table for customizable display names and future options
      database.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `)

      // Default status display names
      database.exec(`INSERT INTO settings (key, value) VALUES ('status_display_waiting', 'Waiting')`)
      database.exec(`INSERT INTO settings (key, value) VALUES ('status_display_active', 'Active')`)
      database.exec(`INSERT INTO settings (key, value) VALUES ('status_display_archived', 'Archived')`)
    })

    migrate2()
    database.pragma('user_version = 2')
  }

  if (fromVersion < 3) {
    const migrate3 = database.transaction(() => {
      // Tournament system for pairwise character comparisons
      database.exec(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          format TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'in_progress',
          filter_criteria TEXT,
          winner_id INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          FOREIGN KEY (winner_id) REFERENCES characters(id) ON DELETE SET NULL
        )
      `)

      database.exec(`
        CREATE TABLE IF NOT EXISTS tournament_matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tournament_id INTEGER NOT NULL,
          bracket TEXT NOT NULL DEFAULT 'winners',
          round INTEGER NOT NULL,
          match_number INTEGER NOT NULL,
          character1_id INTEGER,
          character2_id INTEGER,
          winner_id INTEGER,
          completed_at TEXT,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
          FOREIGN KEY (character1_id) REFERENCES characters(id) ON DELETE SET NULL,
          FOREIGN KEY (character2_id) REFERENCES characters(id) ON DELETE SET NULL,
          FOREIGN KEY (winner_id) REFERENCES characters(id) ON DELETE SET NULL
        )
      `)

      database.exec(`CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id)`)
    })

    migrate3()
    database.pragma('user_version = 3')
  }

  if (fromVersion < 4) {
    const migrate4 = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS custom_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          show_on_card INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      database.exec(`
        CREATE TABLE IF NOT EXISTS character_field_values (
          character_id INTEGER NOT NULL,
          field_id INTEGER NOT NULL,
          value TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (character_id, field_id),
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
        )
      `)

      database.exec(`CREATE INDEX IF NOT EXISTS idx_custom_fields_sort ON custom_fields(sort_order)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_cfv_character ON character_field_values(character_id)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_cfv_field ON character_field_values(field_id)`)
    })

    migrate4()
    database.pragma('user_version = 4')
  }

  if (fromVersion < 5) {
    // Convert <START>...<END> block tags to standard > blockquote syntax
    const rows = database.prepare(
      `SELECT id, seed_text, image_prompts, notes, folder_path FROM characters
       WHERE seed_text LIKE '%<START>%' OR image_prompts LIKE '%<START>%' OR notes LIKE '%<START>%'`
    ).all() as { id: number; seed_text: string; image_prompts: string | null; notes: string | null; folder_path: string }[]

    if (rows.length > 0) {
      const convertBlockTags = (text: string): string => {
        const lines = text.split('\n')
        const result: string[] = []
        let inBlock = false
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === '<START>') { inBlock = true; continue }
          if (trimmed === '<END>') { inBlock = false; continue }
          result.push(inBlock ? `> ${line}` : line)
        }
        return result.join('\n')
      }

      const update = database.prepare(
        `UPDATE characters SET seed_text = ?, image_prompts = ?, notes = ? WHERE id = ?`
      )

      const migrate5 = database.transaction(() => {
        for (const row of rows) {
          const newSeed = convertBlockTags(row.seed_text)
          const newPrompts = row.image_prompts ? convertBlockTags(row.image_prompts) : null
          const newNotes = row.notes ? convertBlockTags(row.notes) : null
          update.run(newSeed, newPrompts, newNotes, row.id)

          // Sync converted text to disk files
          if (row.folder_path && existsSync(row.folder_path)) {
            try {
              writeFileSync(join(row.folder_path, 'seed.md'), newSeed, 'utf-8')
              if (newPrompts) writeFileSync(join(row.folder_path, 'prompts.md'), newPrompts, 'utf-8')
              if (newNotes) writeFileSync(join(row.folder_path, 'notes.md'), newNotes, 'utf-8')
            } catch {
              // Non-critical — file sync failure doesn't block migration
            }
          }
        }
      })
      migrate5()
    }
    database.pragma('user_version = 5')
  }

  if (fromVersion < 6) {
    const migrate6 = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS cloud_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL UNIQUE COLLATE NOCASE,
          status TEXT NOT NULL DEFAULT 'pending',
          merged_into INTEGER REFERENCES cloud_tags(id) ON DELETE SET NULL,
          tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
          match_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      database.exec(`CREATE INDEX IF NOT EXISTS idx_cloud_tags_word ON cloud_tags(word)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_cloud_tags_status ON cloud_tags(status)`)
    })

    migrate6()
    database.pragma('user_version = 6')
  }

  if (fromVersion < 7) {
    const migrate7 = database.transaction(() => {
      // Composite indexes for batch query performance
      database.exec(`CREATE INDEX IF NOT EXISTS idx_images_character_cover ON images(character_id, is_cover DESC, id ASC)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_character_tags_both ON character_tags(tag_id, character_id)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_character_groups_both ON character_groups(character_id, group_id)`)
      database.exec(`CREATE INDEX IF NOT EXISTS idx_cfv_character_field ON character_field_values(character_id, field_id)`)
    })

    migrate7()
    database.pragma('user_version = 7')
  }
}

function createTables(): void {
  const database = getDb()

  database.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      seed_text TEXT NOT NULL,
      image_prompts TEXT,
      priority INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'waiting',
      last_viewed_at TEXT,
      folder_path TEXT NOT NULL,
      has_images INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT
    );

    CREATE TABLE IF NOT EXISTS character_tags (
      character_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (character_id, tag_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      is_cover INTEGER NOT NULL DEFAULT 0,
      original_filename TEXT NOT NULL,
      phash TEXT,
      byte_hash TEXT,
      width INTEGER,
      height INTEGER,
      category_id INTEGER,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES content_categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_groups (
      character_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      PRIMARY KEY (character_id, group_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      slug TEXT NOT NULL UNIQUE,
      is_image_type INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('status_display_waiting', 'Waiting');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('status_display_active', 'Active');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('status_display_archived', 'Archived');

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      filter_criteria TEXT,
      winner_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (winner_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      bracket TEXT NOT NULL DEFAULT 'winners',
      round INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      character1_id INTEGER,
      character2_id INTEGER,
      winner_id INTEGER,
      completed_at TEXT,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (character1_id) REFERENCES characters(id) ON DELETE SET NULL,
      FOREIGN KEY (character2_id) REFERENCES characters(id) ON DELETE SET NULL,
      FOREIGN KEY (winner_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
    CREATE INDEX IF NOT EXISTS idx_characters_priority ON characters(priority);
    CREATE INDEX IF NOT EXISTS idx_characters_status ON characters(status);
    CREATE INDEX IF NOT EXISTS idx_characters_last_viewed ON characters(last_viewed_at);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
    CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
    CREATE INDEX IF NOT EXISTS idx_images_character ON images(character_id);
    CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash);
    CREATE INDEX IF NOT EXISTS idx_images_byte_hash ON images(byte_hash);
    CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
    CREATE INDEX IF NOT EXISTS idx_character_groups_character ON character_groups(character_id);
    CREATE INDEX IF NOT EXISTS idx_character_groups_group ON character_groups(group_id);
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      show_on_card INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS character_field_values (
      character_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (character_id, field_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
    CREATE TABLE IF NOT EXISTS cloud_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE COLLATE NOCASE,
      status TEXT NOT NULL DEFAULT 'pending',
      merged_into INTEGER REFERENCES cloud_tags(id) ON DELETE SET NULL,
      tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
      match_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_custom_fields_sort ON custom_fields(sort_order);
    CREATE INDEX IF NOT EXISTS idx_cfv_character ON character_field_values(character_id);
    CREATE INDEX IF NOT EXISTS idx_cfv_field ON character_field_values(field_id);
    CREATE INDEX IF NOT EXISTS idx_cloud_tags_word ON cloud_tags(word);
    CREATE INDEX IF NOT EXISTS idx_cloud_tags_status ON cloud_tags(status);

    CREATE INDEX IF NOT EXISTS idx_images_character_cover ON images(character_id, is_cover DESC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_character_tags_both ON character_tags(tag_id, character_id);
    CREATE INDEX IF NOT EXISTS idx_character_groups_both ON character_groups(character_id, group_id);
    CREATE INDEX IF NOT EXISTS idx_cfv_character_field ON character_field_values(character_id, field_id);
  `)

  database.pragma('user_version = 7')
}
