import { registerCharacterHandlers } from './handlers/character-handlers'
import { registerTagHandlers } from './handlers/tag-handlers'
import { registerGroupHandlers } from './handlers/group-handlers'
import { registerImageHandlers } from './handlers/image-handlers'
import { registerImportHandlers } from './handlers/import-handlers'
import { registerFileHandlers } from './handlers/file-handlers'
import { registerCategoryHandlers } from './handlers/category-handlers'
import { registerSettingsHandlers } from './handlers/settings-handlers'
import { registerAppHandlers } from './handlers/app-handlers'
import { registerTournamentHandlers } from './handlers/tournament-handlers'
import { registerCustomFieldHandlers } from './handlers/custom-field-handlers'
import { registerWordCloudHandlers } from './handlers/word-cloud-handlers'
import { registerWorkflowHandlers } from './handlers/workflow-handlers'
import { registerLibraryHandlers } from './handlers/library-handlers'
import { registerExportImportHandlers } from './handlers/export-import-handlers'
import { backfillImageHashes, backfillThumbnails } from './backfill'

export function registerIpcHandlers(): void {
  registerCharacterHandlers()
  registerTagHandlers()
  registerGroupHandlers()
  registerImageHandlers()
  registerImportHandlers()
  registerFileHandlers()
  registerCategoryHandlers()
  registerSettingsHandlers()
  registerAppHandlers()
  registerTournamentHandlers()
  registerCustomFieldHandlers()
  registerWordCloudHandlers()
  registerWorkflowHandlers()
  registerLibraryHandlers()
  registerExportImportHandlers()

  // Auto-backfill hashes for images added before the hash checker existed
  backfillImageHashes()

  // Auto-generate thumbnails for images that don't have them yet
  backfillThumbnails()
}
