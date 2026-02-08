export const IPC = {
  // Database
  DB_GET_ALL_CHARACTERS: 'db:get-all-characters',
  DB_GET_CHARACTER: 'db:get-character',
  DB_CREATE_CHARACTER: 'db:create-character',
  DB_UPDATE_CHARACTER: 'db:update-character',
  DB_DELETE_CHARACTER: 'db:delete-character',
  DB_SEARCH_CHARACTERS: 'db:search-characters',

  // Tags
  DB_GET_ALL_TAGS: 'db:get-all-tags',
  DB_CREATE_TAG: 'db:create-tag',
  DB_ADD_TAG_TO_CHARACTER: 'db:add-tag-to-character',
  DB_REMOVE_TAG_FROM_CHARACTER: 'db:remove-tag-from-character',
  DB_DELETE_TAG: 'db:delete-tag',
  DB_RENAME_TAG: 'db:rename-tag',
  DB_MERGE_TAGS: 'db:merge-tags',

  // Groups
  DB_GET_ALL_GROUPS: 'db:get-all-groups',
  DB_CREATE_GROUP: 'db:create-group',
  DB_DELETE_GROUP: 'db:delete-group',
  DB_ADD_CHARACTER_TO_GROUP: 'db:add-character-to-group',
  DB_REMOVE_CHARACTER_FROM_GROUP: 'db:remove-character-from-group',
  DB_RENAME_GROUP: 'db:rename-group',
  DB_MERGE_GROUPS: 'db:merge-groups',

  // Batch operations
  DB_BATCH_ADD_TAG: 'db:batch-add-tag',
  DB_BATCH_REMOVE_TAG: 'db:batch-remove-tag',
  DB_BATCH_ADD_TO_GROUP: 'db:batch-add-to-group',
  DB_BATCH_REMOVE_FROM_GROUP: 'db:batch-remove-from-group',
  DB_BATCH_SET_PRIORITY: 'db:batch-set-priority',
  DB_BATCH_SET_STATUS: 'db:batch-set-status',
  DB_BATCH_DELETE: 'db:batch-delete',

  // Character status
  DB_UPDATE_CHARACTER_STATUS: 'db:update-character-status',

  // Images
  DB_ADD_IMAGE: 'db:add-image',
  DB_REMOVE_IMAGE: 'db:remove-image',
  DB_SET_COVER_IMAGE: 'db:set-cover-image',
  DB_CHECK_IMAGE_DUPLICATES: 'db:check-image-duplicates',
  DB_REINDEX_IMAGE_HASHES: 'db:reindex-image-hashes',
  DB_GENERATE_THUMBNAILS: 'db:generate-thumbnails',

  // Import
  IMPORT_PARSE_FILE: 'import:parse-file',
  IMPORT_COMMIT: 'import:commit',

  // File operations
  FILE_PICK_TEXT: 'file:pick-text',
  FILE_PICK_IMAGES: 'file:pick-images',
  FILE_OPEN_FOLDER: 'file:open-folder',
  FILE_GET_DATA_PATH: 'file:get-data-path',

  // Duplicate checking
  CHECK_DUPLICATES: 'db:check-duplicates',

  // Content Categories
  DB_GET_ALL_CATEGORIES: 'db:get-all-categories',
  DB_CREATE_CATEGORY: 'db:create-category',
  DB_DELETE_CATEGORY: 'db:delete-category',
  DB_SET_IMAGE_CATEGORY: 'db:set-image-category',

  // Settings
  DB_GET_SETTINGS: 'db:get-settings',
  DB_SET_SETTING: 'db:set-setting',

  // App
  APP_GET_STATS: 'app:get-stats',
  APP_CLEAR_LIBRARY: 'app:clear-library',
  APP_GET_BACKGROUNDS: 'app:get-backgrounds',
  APP_TOGGLE_FULLSCREEN: 'app:toggle-fullscreen',
  APP_IS_FULLSCREEN: 'app:is-fullscreen',

  // Custom Fields
  DB_GET_ALL_CUSTOM_FIELDS: 'db:get-all-custom-fields',
  DB_CREATE_CUSTOM_FIELD: 'db:create-custom-field',
  DB_RENAME_CUSTOM_FIELD: 'db:rename-custom-field',
  DB_DELETE_CUSTOM_FIELD: 'db:delete-custom-field',
  DB_REORDER_CUSTOM_FIELDS: 'db:reorder-custom-fields',
  DB_UPDATE_CUSTOM_FIELD: 'db:update-custom-field',
  DB_SET_CUSTOM_FIELD_VALUE: 'db:set-custom-field-value',
  DB_BATCH_SET_CUSTOM_FIELD: 'db:batch-set-custom-field-value',

  // Tournaments
  TOURNAMENT_CREATE: 'tournament:create',
  TOURNAMENT_GET: 'tournament:get',
  TOURNAMENT_GET_ALL: 'tournament:get-all',
  TOURNAMENT_SAVE_STATE: 'tournament:save-state',
  TOURNAMENT_DELETE: 'tournament:delete',

  // Word Cloud
  CLOUD_EXTRACT_WORDS: 'cloud:extract-words',
  CLOUD_GET_ALL: 'cloud:get-all',
  CLOUD_ACCEPT_WORD: 'cloud:accept-word',
  CLOUD_HIDE_WORD: 'cloud:hide-word',
  CLOUD_UNHIDE_WORD: 'cloud:unhide-word',
  CLOUD_COMBINE_WORDS: 'cloud:combine-words',
  CLOUD_ADD_PHRASE: 'cloud:add-phrase',
  CLOUD_RESET_WORD: 'cloud:reset-word',

  // Filter Presets
  FILTER_GET_PRESETS: 'filter:get-presets',
  FILTER_SAVE_PRESET: 'filter:save-preset',
  FILTER_DELETE_PRESET: 'filter:delete-preset',

  // Workflow (lifecycle actions)
  WORKFLOW_PULL_OFF_SHELF: 'workflow:pull-off-shelf',
  WORKFLOW_RETURN_TO_SHELF: 'workflow:return-to-shelf',
  WORKFLOW_ARCHIVE: 'workflow:archive',
  WORKFLOW_UNARCHIVE: 'workflow:unarchive',
  WORKFLOW_OPEN_CURRENT_WORK: 'workflow:open-current-work',

  // Libraries
  LIBRARY_GET_ALL: 'library:get-all',
  LIBRARY_GET_ACTIVE: 'library:get-active',
  LIBRARY_SWITCH: 'library:switch',
  LIBRARY_CREATE: 'library:create',
  LIBRARY_UPDATE: 'library:update',
  LIBRARY_DELETE: 'library:delete',
  LIBRARY_PICK_FOLDER: 'library:pick-folder',
  LIBRARY_COPY_CHARACTER: 'library:copy-character',
  LIBRARY_MOVE_CHARACTER: 'library:move-character',

  // Export / Import
  EXPORT_LIBRARY: 'export:library',
  EXPORT_CHARACTER: 'export:character',
  IMPORT_LIBRARY_PREVIEW: 'import:library-preview',
  IMPORT_LIBRARY_AS_NEW: 'import:library-as-new',
  IMPORT_LIBRARY_MERGE: 'import:library-merge',
  IMPORT_CHARACTER: 'import:character'
} as const
