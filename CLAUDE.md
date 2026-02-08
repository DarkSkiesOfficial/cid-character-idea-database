# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All commands must be run from the `app/` directory:

```bash
cd app
npm install           # First-time setup
npm run dev           # Start development server (runs Electron with hot reload)
npm run build         # Build production code
npm run package       # Build Windows installer + portable
npm run package:mac   # Build macOS DMG + ZIP
npm run package:linux # Build Linux AppImage + DEB (RPM optional, see electron-builder.yml)
npm run package:all   # Build for all platforms
npm run package:dir   # Build unpacked distribution (no installer)
```

**IMPORTANT:** Always run `npm run dev` in background mode: `npm run dev &` or `nohup npm run dev > dev.log 2>&1 &`

## Architecture

### Electron Process Model

This is a standard Electron app with three isolated processes:

- **Main Process** (`src/main/`) - Node.js environment, handles OS integration, SQLite database, file system operations, and IPC handlers
- **Renderer Process** (`src/renderer/`) - React application running in Chromium, handles UI and user interactions
- **Preload Script** (`src/preload/`) - Bridge exposing secure IPC channels to renderer via `window.api`

Communication flows through IPC channels defined in `src/shared/ipc-channels.ts`.

### Database Architecture

**SQLite with better-sqlite3** - Single `database.sqlite` file per library using WAL mode with foreign keys enabled.

Core entities:
- **Characters** - Main entity with status workflow (waiting → active → archived)
- **Tags** - Many-to-many with characters, supports optional categories
- **Groups** - Many-to-many with characters
- **Custom Fields** - User-defined metadata with sort ordering
- **Images** - File references with thumbnails, cover selection, perceptual hashing for duplicate detection
- **Tournaments** - Persistent bracket-style character comparison state
- **Word Cloud** - Extracted terms from seed text with accept/hide/combine operations

**Schema versioning:** `CURRENT_SCHEMA_VERSION` constant in `database.ts` with migration system in `runMigrations()`.

### Multi-Library System

Libraries are independent workspaces with separate SQLite databases and character folders. Global registry stored in `~/.cid/library-registry.json` (or `<appRoot>/data/library-registry.json`).

Switching libraries closes current DB and reinitializes with new path. Characters can be copied/moved between libraries via export/import.

### State Management

React state lives in `App.tsx` with props drilled to components. No Redux/Context - direct prop passing for all state.

Critical state:
- `characters[]` - Main data array rebuilt on every query
- `selectedCharacter` - Detail view target
- `view` - 'grid' | 'detail' | 'tournament'
- `galleryMode` - 'grid' | 'coverflow' | 'slideshow' | 'swipe'
- `advancedFilter` - Complex multi-tag/group/custom-field queries with AND/OR logic
- `selectedIds` + `selectionMode` - Bulk operations state

### IPC Handler Organization

Handlers live in `src/main/handlers/` organized by domain:
- `character-handlers.ts` - CRUD operations
- `tag-handlers.ts` / `group-handlers.ts` - Taxonomy management with merge operations
- `image-handlers.ts` - File copying, thumbnail generation, perceptual hashing
- `library-handlers.ts` - Multi-library switching and registry management
- `export-import-handlers.ts` - ZIP-based character/library portability
- `workflow-handlers.ts` - Status transitions and "current work" folder opening
- `tournament-handlers.ts` - Bracket persistence
- `word-cloud-handlers.ts` - Seed text analysis and tag suggestion

All handlers registered in `ipc-handlers.ts` `registerIpcHandlers()`.

### Image Storage and Hashing

Images copied to `<dataDir>/characters/<characterId>/<filename>` with thumbnails in `<dataDir>/thumbnails/`.

Duplicate detection uses perceptual hashing (average hash) stored in `image_hashes` table. Hash computation in `image-hasher.ts` using Jimp/sharp fallback.

### Filter System

Two filter modes:
1. **Simple** - Single tag/group + text search + status + priority threshold
2. **Advanced** - Multiple tags/groups with AND/OR logic, exclusions, custom field substring matching

Query building in `character-handlers.ts` `getAllCharacters()` dynamically constructs SQL with CTEs for tag/group intersection/union logic.

### View Modes

**Grid** - Masonry layout with density slider, card components show cover image + metadata
**Cover Flow** - 3D carousel with center focus and side preview cards
**Slideshow** - Auto-advancing fullscreen with configurable interval
**Swipe** - Tinder-style card swiping for rapid triage
**Tournament** - Bracket generation from filtered characters, supports single/double elimination

View switching preserves character list but resets selection state.

## Technical Stack

- **Electron** 33.x with electron-vite for build tooling
- **React** 19.x with TypeScript strict mode
- **Tailwind CSS** with custom color system (surface.*, accent.*, status.*)
- **better-sqlite3** for synchronous database operations
- **adm-zip** for import/export
- **react-markdown** for seed text and notes rendering

## Development Notes

### Database Queries
All database access is synchronous via `getDb()` from `database.ts`. Use transactions for multi-step operations.

### File Paths
Always use `getDataDir()` for current library's data directory. Character folders use integer IDs as names.

### Image Operations
Check for duplicates before adding images via `DB_CHECK_IMAGE_DUPLICATES` channel. Hash reindexing available for backfill operations.

### Status Workflow
Status transitions have dedicated workflow handlers that also update timestamps and manage "current work" tracking.

### Cross-Platform Packaging
- **better-sqlite3** version 12.6.2+ required for Electron 40.x compatibility
- **RPM packages** not built by default (requires `rpmbuild` on build system)
- AppImage and DEB provide complete Linux coverage
- macOS builds require macOS host (code signing limitations)

### Testing
No test suite currently implemented.
