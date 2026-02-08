import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc-channels'

const api = {
  // Utilities
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Characters
  getAllCharacters: (params?: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.DB_GET_ALL_CHARACTERS, params),
  getCharacter: (id: number) => ipcRenderer.invoke(IPC.DB_GET_CHARACTER, id),
  createCharacter: (data: Record<string, unknown>) => ipcRenderer.invoke(IPC.DB_CREATE_CHARACTER, data),
  updateCharacter: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke(IPC.DB_UPDATE_CHARACTER, id, data),
  deleteCharacter: (id: number) => ipcRenderer.invoke(IPC.DB_DELETE_CHARACTER, id),
  searchCharacters: (query: string) => ipcRenderer.invoke(IPC.DB_SEARCH_CHARACTERS, query),

  // Tags
  getAllTags: () => ipcRenderer.invoke(IPC.DB_GET_ALL_TAGS),
  createTag: (name: string) => ipcRenderer.invoke(IPC.DB_CREATE_TAG, name),
  addTagToCharacter: (characterId: number, tagName: string, category?: string) =>
    ipcRenderer.invoke(IPC.DB_ADD_TAG_TO_CHARACTER, characterId, tagName, category),
  removeTagFromCharacter: (characterId: number, tagId: number) =>
    ipcRenderer.invoke(IPC.DB_REMOVE_TAG_FROM_CHARACTER, characterId, tagId),
  deleteTag: (tagId: number) => ipcRenderer.invoke(IPC.DB_DELETE_TAG, tagId),
  renameTag: (tagId: number, newName: string) => ipcRenderer.invoke(IPC.DB_RENAME_TAG, tagId, newName),
  mergeTags: (sourceTagId: number, targetTagId: number) => ipcRenderer.invoke(IPC.DB_MERGE_TAGS, sourceTagId, targetTagId),

  // Groups
  getAllGroups: () => ipcRenderer.invoke(IPC.DB_GET_ALL_GROUPS),
  createGroup: (name: string) => ipcRenderer.invoke(IPC.DB_CREATE_GROUP, name),
  deleteGroup: (groupId: number) => ipcRenderer.invoke(IPC.DB_DELETE_GROUP, groupId),
  addCharacterToGroup: (characterId: number, groupName: string) =>
    ipcRenderer.invoke(IPC.DB_ADD_CHARACTER_TO_GROUP, characterId, groupName),
  removeCharacterFromGroup: (characterId: number, groupId: number) =>
    ipcRenderer.invoke(IPC.DB_REMOVE_CHARACTER_FROM_GROUP, characterId, groupId),
  renameGroup: (groupId: number, newName: string) => ipcRenderer.invoke(IPC.DB_RENAME_GROUP, groupId, newName),
  mergeGroups: (sourceGroupId: number, targetGroupId: number) => ipcRenderer.invoke(IPC.DB_MERGE_GROUPS, sourceGroupId, targetGroupId),

  // Batch operations
  batchAddTag: (characterIds: number[], tagName: string) => ipcRenderer.invoke(IPC.DB_BATCH_ADD_TAG, characterIds, tagName),
  batchRemoveTag: (characterIds: number[], tagId: number) => ipcRenderer.invoke(IPC.DB_BATCH_REMOVE_TAG, characterIds, tagId),
  batchAddToGroup: (characterIds: number[], groupName: string) => ipcRenderer.invoke(IPC.DB_BATCH_ADD_TO_GROUP, characterIds, groupName),
  batchRemoveFromGroup: (characterIds: number[], groupId: number) => ipcRenderer.invoke(IPC.DB_BATCH_REMOVE_FROM_GROUP, characterIds, groupId),
  batchSetPriority: (characterIds: number[], priority: number) => ipcRenderer.invoke(IPC.DB_BATCH_SET_PRIORITY, characterIds, priority),
  batchSetStatus: (characterIds: number[], status: string) => ipcRenderer.invoke(IPC.DB_BATCH_SET_STATUS, characterIds, status),
  batchDelete: (characterIds: number[]) => ipcRenderer.invoke(IPC.DB_BATCH_DELETE, characterIds),

  // Character status
  updateCharacterStatus: (id: number, status: string) =>
    ipcRenderer.invoke(IPC.DB_UPDATE_CHARACTER_STATUS, id, status),

  // Images
  addImage: (characterId: number, sourcePath: string, options?: { deleteSource?: boolean; categoryId?: number }) =>
    ipcRenderer.invoke(IPC.DB_ADD_IMAGE, characterId, sourcePath, options),
  removeImage: (imageId: number) => ipcRenderer.invoke(IPC.DB_REMOVE_IMAGE, imageId),
  setCoverImage: (characterId: number, imageId: number) =>
    ipcRenderer.invoke(IPC.DB_SET_COVER_IMAGE, characterId, imageId),
  checkImageDuplicates: (sourcePath: string) =>
    ipcRenderer.invoke(IPC.DB_CHECK_IMAGE_DUPLICATES, sourcePath),
  reindexImageHashes: () => ipcRenderer.invoke(IPC.DB_REINDEX_IMAGE_HASHES),
  generateThumbnails: () => ipcRenderer.invoke(IPC.DB_GENERATE_THUMBNAILS),

  // Import
  parseImportFile: () => ipcRenderer.invoke(IPC.IMPORT_PARSE_FILE),
  commitImport: (entries: Array<{ raw_text: string; name: string | null }>) =>
    ipcRenderer.invoke(IPC.IMPORT_COMMIT, entries),

  // Files
  pickImages: () => ipcRenderer.invoke(IPC.FILE_PICK_IMAGES),
  openFolder: (path: string) => ipcRenderer.invoke(IPC.FILE_OPEN_FOLDER, path),
  getDataPath: () => ipcRenderer.invoke(IPC.FILE_GET_DATA_PATH),

  // Duplicate checking
  checkDuplicates: (seedText: string) => ipcRenderer.invoke(IPC.CHECK_DUPLICATES, seedText),

  // Content Categories
  getAllCategories: () => ipcRenderer.invoke(IPC.DB_GET_ALL_CATEGORIES),
  createCategory: (name: string, isImageType: boolean) =>
    ipcRenderer.invoke(IPC.DB_CREATE_CATEGORY, name, isImageType),
  deleteCategory: (categoryId: number) => ipcRenderer.invoke(IPC.DB_DELETE_CATEGORY, categoryId),
  setImageCategory: (imageId: number, categoryId: number | null) =>
    ipcRenderer.invoke(IPC.DB_SET_IMAGE_CATEGORY, imageId, categoryId),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.DB_GET_SETTINGS),
  setSetting: (key: string, value: string) => ipcRenderer.invoke(IPC.DB_SET_SETTING, key, value),

  // App
  getStats: () => ipcRenderer.invoke(IPC.APP_GET_STATS),
  clearLibrary: () => ipcRenderer.invoke(IPC.APP_CLEAR_LIBRARY),
  getBackgrounds: () => ipcRenderer.invoke(IPC.APP_GET_BACKGROUNDS),
  toggleFullscreen: () => ipcRenderer.invoke(IPC.APP_TOGGLE_FULLSCREEN),
  isFullscreen: () => ipcRenderer.invoke(IPC.APP_IS_FULLSCREEN),
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: boolean): void => callback(value)
    ipcRenderer.on('fullscreen-changed', handler)
    return () => { ipcRenderer.removeListener('fullscreen-changed', handler) }
  },

  // Custom Fields
  getAllCustomFields: () => ipcRenderer.invoke(IPC.DB_GET_ALL_CUSTOM_FIELDS),
  createCustomField: (name: string) => ipcRenderer.invoke(IPC.DB_CREATE_CUSTOM_FIELD, name),
  renameCustomField: (fieldId: number, newName: string) =>
    ipcRenderer.invoke(IPC.DB_RENAME_CUSTOM_FIELD, fieldId, newName),
  deleteCustomField: (fieldId: number) => ipcRenderer.invoke(IPC.DB_DELETE_CUSTOM_FIELD, fieldId),
  reorderCustomFields: (orderedIds: number[]) =>
    ipcRenderer.invoke(IPC.DB_REORDER_CUSTOM_FIELDS, orderedIds),
  updateCustomField: (fieldId: number, updates: { show_on_card?: boolean }) =>
    ipcRenderer.invoke(IPC.DB_UPDATE_CUSTOM_FIELD, fieldId, updates),
  setCustomFieldValue: (characterId: number, fieldId: number, value: string) =>
    ipcRenderer.invoke(IPC.DB_SET_CUSTOM_FIELD_VALUE, characterId, fieldId, value),
  batchSetCustomFieldValue: (characterIds: number[], fieldId: number, value: string) =>
    ipcRenderer.invoke(IPC.DB_BATCH_SET_CUSTOM_FIELD, characterIds, fieldId, value),

  // Tournaments
  createTournament: (data: { name: string; format: string; filter_criteria?: string | null }) =>
    ipcRenderer.invoke(IPC.TOURNAMENT_CREATE, data),
  getTournament: (id: number) => ipcRenderer.invoke(IPC.TOURNAMENT_GET, id),
  getAllTournaments: () => ipcRenderer.invoke(IPC.TOURNAMENT_GET_ALL),
  saveTournamentState: (data: {
    tournamentId: number
    matches: unknown[]
    status?: string
    winnerId?: number | null
  }) => ipcRenderer.invoke(IPC.TOURNAMENT_SAVE_STATE, data),
  deleteTournament: (id: number) => ipcRenderer.invoke(IPC.TOURNAMENT_DELETE, id),

  // Word Cloud
  extractCloudWords: () => ipcRenderer.invoke(IPC.CLOUD_EXTRACT_WORDS),
  getAllCloudTags: () => ipcRenderer.invoke(IPC.CLOUD_GET_ALL),
  acceptCloudWord: (word: string) => ipcRenderer.invoke(IPC.CLOUD_ACCEPT_WORD, word),
  hideCloudWord: (word: string) => ipcRenderer.invoke(IPC.CLOUD_HIDE_WORD, word),
  unhideCloudWord: (id: number) => ipcRenderer.invoke(IPC.CLOUD_UNHIDE_WORD, id),
  combineCloudWords: (sourceWord: string, targetWord: string) =>
    ipcRenderer.invoke(IPC.CLOUD_COMBINE_WORDS, sourceWord, targetWord),
  addCloudPhrase: (phrase: string) => ipcRenderer.invoke(IPC.CLOUD_ADD_PHRASE, phrase),
  resetCloudWord: (id: number) => ipcRenderer.invoke(IPC.CLOUD_RESET_WORD, id),

  // Filter Presets
  getFilterPresets: () => ipcRenderer.invoke(IPC.FILTER_GET_PRESETS),
  saveFilterPreset: (preset: { id: string; name: string; filter: unknown; statusFilter?: string; createdAt: string }) =>
    ipcRenderer.invoke(IPC.FILTER_SAVE_PRESET, preset),
  deleteFilterPreset: (presetId: string) => ipcRenderer.invoke(IPC.FILTER_DELETE_PRESET, presetId),

  // Workflow
  pullOffShelf: (characterId: number) => ipcRenderer.invoke(IPC.WORKFLOW_PULL_OFF_SHELF, characterId),
  returnToShelf: (characterId: number) => ipcRenderer.invoke(IPC.WORKFLOW_RETURN_TO_SHELF, characterId),
  archiveCharacter: (characterId: number) => ipcRenderer.invoke(IPC.WORKFLOW_ARCHIVE, characterId),
  unarchiveCharacter: (characterId: number) => ipcRenderer.invoke(IPC.WORKFLOW_UNARCHIVE, characterId),
  openCurrentWork: () => ipcRenderer.invoke(IPC.WORKFLOW_OPEN_CURRENT_WORK),

  // Libraries
  getAllLibraries: () => ipcRenderer.invoke(IPC.LIBRARY_GET_ALL),
  getActiveLibrary: () => ipcRenderer.invoke(IPC.LIBRARY_GET_ACTIVE),
  switchLibrary: (libraryId: string) => ipcRenderer.invoke(IPC.LIBRARY_SWITCH, libraryId),
  createLibrary: (opts: { name: string; path: string; accentColor: string; icon: string }) =>
    ipcRenderer.invoke(IPC.LIBRARY_CREATE, opts),
  updateLibrary: (id: string, updates: { name?: string; accentColor?: string; icon?: string; isDefault?: boolean }) =>
    ipcRenderer.invoke(IPC.LIBRARY_UPDATE, id, updates),
  deleteLibrary: (id: string, deleteFiles: boolean) =>
    ipcRenderer.invoke(IPC.LIBRARY_DELETE, id, deleteFiles),
  pickLibraryFolder: () => ipcRenderer.invoke(IPC.LIBRARY_PICK_FOLDER),
  copyCharacterToLibrary: (characterId: number, targetLibraryId: string) =>
    ipcRenderer.invoke(IPC.LIBRARY_COPY_CHARACTER, characterId, targetLibraryId),
  moveCharacterToLibrary: (characterId: number, targetLibraryId: string) =>
    ipcRenderer.invoke(IPC.LIBRARY_MOVE_CHARACTER, characterId, targetLibraryId),

  // Export / Import
  exportLibrary: () => ipcRenderer.invoke(IPC.EXPORT_LIBRARY),
  exportCharacter: (characterId: number) => ipcRenderer.invoke(IPC.EXPORT_CHARACTER, characterId),
  importLibraryPreview: () => ipcRenderer.invoke(IPC.IMPORT_LIBRARY_PREVIEW),
  importLibraryAsNew: (opts: { zipPath: string; libraryName: string }) =>
    ipcRenderer.invoke(IPC.IMPORT_LIBRARY_AS_NEW, opts),
  importLibraryMerge: (opts: { zipPath: string }) =>
    ipcRenderer.invoke(IPC.IMPORT_LIBRARY_MERGE, opts),
  importCharacter: () => ipcRenderer.invoke(IPC.IMPORT_CHARACTER)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
