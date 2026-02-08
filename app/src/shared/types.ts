export type CharacterStatus = 'waiting' | 'active' | 'archived'

export type SortField = 'created_at' | 'updated_at' | 'priority' | 'name' | 'random'
export type SortDirection = 'asc' | 'desc'

export interface CharacterQueryParams {
  sortField?: SortField
  sortDirection?: SortDirection
  statusFilter?: CharacterStatus | 'all'
  tagFilter?: number
  groupFilter?: number
  // Advanced filters
  advancedFilter?: AdvancedFilter
}

export type FilterLogic = 'and' | 'or'

export interface AdvancedFilter {
  tagIds?: number[]
  tagLogic?: FilterLogic         // default 'and'
  excludeTagIds?: number[]       // NOT these tags
  groupIds?: number[]
  groupLogic?: FilterLogic       // default 'and'
  excludeGroupIds?: number[]     // NOT these groups
  customFieldFilters?: CustomFieldFilter[]
  textSearch?: string            // combined with other filters
}

export interface CustomFieldFilter {
  fieldId: number
  value: string                  // substring match
}

export interface FilterPreset {
  id: string
  name: string
  filter: AdvancedFilter
  statusFilter?: CharacterStatus | 'all'
  createdAt: string
}

export interface Character {
  id: number
  name: string | null
  seed_text: string
  image_prompts: string | null
  priority: number
  status: CharacterStatus
  last_viewed_at: string | null
  folder_path: string
  has_images: boolean
  created_at: string
  updated_at: string
  notes: string | null
}

export interface Tag {
  id: number
  name: string
  category: string | null
}

export interface CharacterTag {
  character_id: number
  tag_id: number
}

export interface CharacterImage {
  id: number
  character_id: number
  file_path: string
  thumbnail_path: string | null
  is_cover: boolean
  original_filename: string
  category_id: number | null
  category_name: string | null
  width: number | null
  height: number | null
}

export interface ContentCategory {
  id: number
  name: string
  slug: string
  is_image_type: boolean
  created_at: string
}

export interface Group {
  id: number
  name: string
  created_at: string
}

export interface CustomField {
  id: number
  name: string
  sort_order: number
  show_on_card: boolean
  created_at: string
}

export interface CustomFieldValue {
  field_id: number
  field_name: string
  value: string
}

export interface CharacterWithDetails extends Character {
  tags: Tag[]
  images: CharacterImage[]
  cover_image: CharacterImage | null
  groups: Group[]
  custom_field_values: CustomFieldValue[]
}

export interface ParsedSeed {
  index: number
  raw_text: string
  detected_name: string | null
  flagged: boolean
  flag_reason: string | null
}

export interface ImportReviewItem extends ParsedSeed {
  action: 'accept' | 'skip' | 'merge_up' | 'merge_down' | 'split'
  edited_text?: string
}

// Tournament types
export type TournamentFormat = 'single' | 'double'
export type TournamentStatus = 'in_progress' | 'completed'
export type BracketType = 'winners' | 'losers' | 'grand_final'

export interface Tournament {
  id: number
  name: string
  format: TournamentFormat
  status: TournamentStatus
  filter_criteria: string | null
  winner_id: number | null
  created_at: string
  completed_at: string | null
}

export interface TournamentMatch {
  id?: number
  tournament_id?: number
  bracket: BracketType
  round: number
  match_number: number
  character1_id: number | null
  character2_id: number | null
  winner_id: number | null
  completed_at: string | null
}

export interface BracketNode {
  bracket: BracketType
  round: number
  matchNumber: number
  character1: CharacterWithDetails | null
  character2: CharacterWithDetails | null
  winner: CharacterWithDetails | null
  isBye: boolean
}

export interface BracketState {
  winners: BracketNode[][]
  losers: BracketNode[][]
  grandFinal: BracketNode | null
  currentMatch: { bracket: BracketType; round: number; match: number } | null
  totalWinnersRounds: number
  totalLosersRounds: number
  format: TournamentFormat
  isComplete: boolean
  champion: CharacterWithDetails | null
}

export interface TournamentConfig {
  name: string
  format: TournamentFormat
  characters: CharacterWithDetails[]
  shuffle: boolean
}

// Library types
export interface LibraryEntry {
  id: string
  name: string
  path: string
  accentColor: string
  icon: string
  isDefault: boolean
  createdAt: string
}

export interface LibraryRegistry {
  version: 1
  libraries: LibraryEntry[]
  activeLibraryId: string
}

// Export / Import types
export interface ExportMetadata {
  formatVersion: 1
  type: 'library' | 'character'
  schemaVersion: number
  exportDate: string
  libraryName: string
  characterCount: number
  imageCount: number
}

export interface ImportPreview {
  metadata: ExportMetadata
  characterNames: string[]
  totalSize: number
  valid: boolean
  error?: string
  zipPath: string
}

// Word Cloud types
export type CloudTagStatus = 'pending' | 'accepted' | 'hidden'

export interface CloudTag {
  id: number
  word: string
  status: CloudTagStatus
  merged_into: number | null
  tag_id: number | null
  match_count: number
  created_at: string
}

export interface WordFrequency {
  word: string
  count: number
  characterIds: number[]
  cloud_tag_id: number | null
  status: CloudTagStatus | null
}
