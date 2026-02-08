import { useState, useRef, useMemo, memo } from 'react'
import type { SortField, SortDirection } from '../../../shared/types'

interface CharacterSummary {
  id: number
  name: string | null
  seed_text: string
  priority: number
  status: string
  has_images: boolean
  image_paths: string[]
  thumbnail_paths?: (string | null)[]
  images_by_category: Record<string, string[]>
  group_names: string[]
  cover_width: number | null
  cover_height: number | null
  custom_field_preview?: { field_name: string; value: string }[]
}

type NameFilter = 'all' | 'named' | 'unnamed'
type GalleryMode = 'grid' | 'coverflow' | 'slideshow' | 'swipe'

interface CharacterGridProps {
  characters: CharacterSummary[]
  onSelect: (id: number) => void
  onImageAdded?: () => void
  sortField: SortField
  sortDirection: SortDirection
  onSortFieldChange: (field: SortField) => void
  onSortDirectionChange: (dir: SortDirection) => void
  onShuffle: () => void
  density: number
  onDensityChange: (density: number) => void
  filterNeedImages: boolean
  onToggleNeedImages: () => void
  filterNameState: NameFilter
  onFilterNameChange: (state: NameFilter) => void
  filterMinPriority: number
  onFilterMinPriorityChange: (min: number) => void
  galleryMode: GalleryMode
  onGalleryModeChange: (mode: GalleryMode) => void
  selectionMode?: boolean
  selectedIds?: Set<number>
  onToggleSelection?: (id: number, shiftKey: boolean) => void
  onToggleSelectionMode?: () => void
  hasAdvancedFilter?: boolean
  onOpenAdvancedFilter?: () => void
  onClearAdvancedFilter?: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

const DENSITY_COLUMNS: Record<number, number> = {
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 2
}

// All cards are fixed 2:3 image + 3:2 info, so uniform height
const CARD_HEIGHT_ESTIMATE = 3 / 2 + 2 / 3

function distributeColumns(items: CharacterSummary[], columnCount: number): CharacterSummary[][] {
  const columns: CharacterSummary[][] = Array.from({ length: columnCount }, () => [])
  const heights: number[] = new Array(columnCount).fill(0)

  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights))
    columns[shortest].push(item)
    heights[shortest] += CARD_HEIGHT_ESTIMATE
  }

  return columns
}

function priorityDot(priority: number): JSX.Element {
  if (priority === 5) {
    return (
      <div className="absolute top-2 right-2 w-3.5 h-3.5">
        <div className="absolute inset-[-3px] rounded-full bg-green-400/30 animate-ping" style={{ animationDuration: '2.5s' }} />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-300 border-r-green-300/40 animate-spin" style={{ animationDuration: '3s' }} />
        <div className="absolute inset-[3px] rounded-full bg-green-400 shadow-[0_0_6px_1px_rgba(74,222,128,0.5)]" />
      </div>
    )
  }

  const colors: Record<number, string> = {
    4: 'bg-green-500',
    3: 'bg-yellow-500',
    2: 'bg-orange-500',
    1: 'bg-red-500'
  }
  const color = colors[priority] || 'bg-surface-600'
  return <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${color}`} />
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function placeholderStyle(char: CharacterSummary): { background: string; textColor: string } {
  const seed = char.name || char.seed_text.substring(0, 40) || String(char.id)
  const h = hashCode(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h >> 8) % 30) % 360
  // Higher priority = more saturated
  const sat = 20 + char.priority * 8
  const angle = (h >> 4) % 360

  return {
    background: `linear-gradient(${angle}deg, hsl(${hue1}, ${sat}%, 18%) 0%, hsl(${hue2}, ${sat}%, 12%) 100%)`,
    textColor: `hsl(${hue1}, ${sat + 15}%, 40%)`
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>.*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^<START>\s*$/gm, '')
    .replace(/^<END>\s*$/gm, '')
    .trim()
}

function extractCardText(text: string): { thesis: string; summary: string | null } {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) =>
    l.length > 0 && !/^-{3,}$/.test(l) && l !== '<START>' && l !== '<END>'
  )

  const thesisRaw = lines[0] || ''
  const thesis = stripMarkdown(thesisRaw)

  const rest = lines.slice(1, 3).map(stripMarkdown).join('\n')
  const summary = rest.length > 120
    ? rest.substring(0, 120).replace(/\s+\S*$/, '') + '...'
    : rest || null

  return { thesis, summary }
}

const CharacterCard = memo(function CharacterCard({ char, onSelect, onImageAdded, isSelected, selectionMode, onToggleSelection, imageOnly }: { char: CharacterSummary; onSelect: (id: number) => void; onImageAdded?: () => void; isSelected?: boolean; selectionMode?: boolean; onToggleSelection?: (id: number, shiftKey: boolean) => void; imageOnly?: boolean }): JSX.Element {
  const [imageIndex, setImageIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const dragCounter = useRef(0)

  const categoryNames = Object.keys(char.images_by_category || {})
  const hasCategories = categoryNames.length > 1

  const images = categoryFilter && char.images_by_category?.[categoryFilter]
    ? char.images_by_category[categoryFilter]
    : char.image_paths
  const hasMultiple = images.length > 1
  const currentImage = images[Math.min(imageIndex, images.length - 1)] || null

  const clampedIndex = Math.min(imageIndex, images.length - 1)
  const fullIndex = currentImage ? char.image_paths.indexOf(currentImage) : -1
  const thumbnailForCurrent = fullIndex >= 0 ? char.thumbnail_paths?.[fullIndex] : null
  const displayImage = thumbnailForCurrent || currentImage

  const isLandscape = char.cover_width && char.cover_height && char.cover_width > char.cover_height

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex((i) => (i - 1 + images.length) % images.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageIndex((i) => (i + 1) % images.length)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      setDragOver(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOver(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name)
    )

    const deleteSource = localStorage.getItem('deleteSourceOnImport') === 'true'
    for (const file of files) {
      const filePath = window.api.getPathForFile(file)
      await window.api.addImage(char.id, filePath, { deleteSource })
    }

    if (files.length > 0 && onImageAdded) {
      onImageAdded()
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(char.id, e.shiftKey)
    } else if (e.ctrlKey && onToggleSelection) {
      onToggleSelection(char.id, false)
    } else {
      flipped ? setFlipped(false) : onSelect(char.id)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative bg-surface-900 rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer
                 hover:shadow-lg hover:shadow-accent-500/10 text-left group flex flex-col ${
                   isSelected
                     ? 'border-accent-400 ring-2 ring-accent-400/30'
                     : dragOver
                       ? 'border-accent-400 ring-2 ring-accent-400/30 shadow-lg shadow-accent-500/20'
                       : char.status === 'active'
                         ? 'border-green-500/40 hover:border-green-400/60'
                       : 'border-surface-800 hover:border-accent-500/50'
                 }`}
    >
      {/* Selection checkbox */}
      {(selectionMode || isSelected) && (
        <div className="absolute top-2 left-2 z-20">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-accent-500 border-accent-500' : 'border-surface-400 bg-surface-900/60'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {!flipped ? (
        <>
          {/* Image area — fixed 2:3, landscape images letterboxed */}
          <div className={`aspect-[2/3] relative overflow-hidden shrink-0 ${
            isLandscape ? 'bg-surface-950' : 'bg-surface-800'
          }`}>
            {currentImage ? (
              <>
                <img
                  src={`local-file://${encodeURIComponent(displayImage)}`}
                  alt={char.name || 'Character'}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full transition-transform duration-300 ${
                    isLandscape
                      ? 'object-contain group-hover:scale-105'
                      : 'object-cover group-hover:scale-105'
                  }`}
              />
              {isLandscape && (
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]" />
              )}
              </>
            ) : (
              (() => {
                const ps = placeholderStyle(char)
                return (
                  <div
                    className="w-full h-full flex items-center justify-center select-none"
                    style={{ background: ps.background }}
                  >
                    <span
                      className="text-4xl font-bold opacity-60 tracking-wider"
                      style={{ color: ps.textColor }}
                    >
                      {getInitials(char.name)}
                    </span>
                  </div>
                )
              })()
            )}

            {/* Image navigation arrows */}
            {hasMultiple && (
              <>
                <div
                  onClick={handlePrev}
                  className="absolute left-1.5 bottom-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/80
                             flex items-center justify-center cursor-pointer
                             opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
                <div
                  onClick={handleNext}
                  className="absolute right-1.5 bottom-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/80
                             flex items-center justify-center cursor-pointer
                             opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                {/* Image counter */}
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/70
                                 bg-black/40 px-1.5 py-0.5 rounded-full
                                 opacity-0 group-hover:opacity-100 transition-opacity">
                  {clampedIndex + 1}/{images.length}
                </span>
              </>
            )}

            {/* Drop overlay */}
            {dragOver && (
              <div className="absolute inset-0 bg-accent-500/20 flex items-center justify-center z-10">
                <span className="bg-black/60 text-accent-300 text-xs font-medium px-3 py-1.5 rounded-full">
                  Drop to add
                </span>
              </div>
            )}

            {/* Priority dot */}
            {priorityDot(char.priority)}

            {/* Status indicator for active characters */}
            {char.status === 'active' && (
              <span className="absolute bottom-2 right-2 bg-green-500/80 text-white text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded">
                Active
              </span>
            )}

            {/* Group badges with tooltip */}
            {char.group_names.length > 0 && (
              <span
                className="absolute top-2 left-2 bg-black/60 text-surface-200 text-xs px-2 py-0.5 rounded cursor-default"
                title={char.group_names.join(', ')}
                onClick={(e) => e.stopPropagation()}
              >
                {char.group_names[0]}{char.group_names.length > 1 ? ` +${char.group_names.length - 1}` : ''}
              </span>
            )}

            {/* Category filter */}
            {hasCategories && (
              <div className="absolute top-2 right-9 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCategoryPicker(!showCategoryPicker)
                  }}
                  className="bg-black/60 text-surface-200 text-[10px] px-1.5 py-0.5 rounded hover:bg-black/80"
                  title="Filter by category"
                >
                  {categoryFilter || 'All'} ▾
                </button>
                {showCategoryPicker && (
                  <div
                    className="absolute top-full mt-1 right-0 bg-surface-800 border border-surface-700 rounded shadow-xl min-w-[100px] py-1 z-30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setCategoryFilter(null); setShowCategoryPicker(false); setImageIndex(0) }}
                      className={`block w-full text-left text-[11px] px-2.5 py-1 hover:bg-surface-700 ${
                        !categoryFilter ? 'text-accent-400' : 'text-surface-300'
                      }`}
                    >
                      All
                    </button>
                    {categoryNames.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setShowCategoryPicker(false); setImageIndex(0) }}
                        className={`block w-full text-left text-[11px] px-2.5 py-1 hover:bg-surface-700 ${
                          categoryFilter === cat ? 'text-accent-400' : 'text-surface-300'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info — fixed 3:2 block with fade-out */}
          {!imageOnly && <div className="aspect-[3/2] p-3 min-w-0 relative overflow-hidden">
            <h3 className="font-medium font-display text-surface-100 mb-1 break-words whitespace-pre-line">
              {char.name || <span className="italic text-surface-500 font-sans">Unnamed</span>}
            </h3>
            <p className="text-xs text-surface-300 leading-relaxed break-words whitespace-pre-line">
              {stripMarkdown(char.seed_text)}
            </p>
            {/* Fade-out gradient at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none" />

            {/* Page turn corner — large hit zone, small icon */}
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(true) }}
              className="absolute bottom-0 right-0 w-10 h-10 opacity-0 group-hover:opacity-100 transition-all flex items-end justify-end"
              title="Flip card"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 28 28" fill="none">
                <path d="M28 0 L28 28 L0 28 Z" fill="currentColor" className="text-surface-700 hover:text-surface-500 transition-colors" />
                <path d="M28 0 Q14 4 0 28" stroke="currentColor" strokeWidth="0.5" className="text-surface-500" fill="none" />
              </svg>
            </button>
          </div>}
        </>
      ) : (
        /* Flipped card — quick info back. Click anywhere to flip back. */
        <div className="p-4 min-w-0 flex flex-col gap-2 aspect-[6/13]">
          <h3 className="font-medium font-display text-surface-100 break-words">
            {char.name || <span className="italic text-surface-500 font-sans">Unnamed</span>}
          </h3>

          {char.group_names.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {char.group_names.map((g) => (
                <span key={g} className="text-[10px] bg-surface-800 text-surface-300 px-1.5 py-0.5 rounded">{g}</span>
              ))}
            </div>
          )}

          {char.custom_field_preview && char.custom_field_preview.length > 0 && (
            <div className="space-y-0.5">
              {char.custom_field_preview.map((cf) => (
                <div key={cf.field_name} className="flex items-baseline gap-1.5">
                  <span className="text-[9px] text-surface-500 shrink-0">{cf.field_name}:</span>
                  <span className="text-[10px] text-surface-300 truncate">{cf.value}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-surface-400 leading-relaxed break-words whitespace-pre-line flex-1 overflow-hidden">
            {stripMarkdown(char.seed_text)}
          </p>

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-800">
            <span className="text-[10px] text-surface-500">{images.length} image{images.length !== 1 ? 's' : ''}</span>
            <span className="text-[10px] text-surface-500 capitalize">{char.status}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(char.id) }}
              className="text-[10px] text-accent-400 hover:text-accent-300 hover:underline"
            >
              Open →
            </button>
          </div>

          <span className="text-[9px] text-surface-600 text-center">click to flip back</span>
        </div>
      )}
    </div>
  )
})

const SORT_LABELS: Record<string, string> = {
  priority: 'Priority',
  created_at: 'Date Added',
  updated_at: 'Date Modified',
  name: 'Name'
}

const GALLERY_MODES: { mode: GalleryMode; label: string; icon: string }[] = [
  { mode: 'grid', label: 'Grid', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
  { mode: 'coverflow', label: 'Cover Flow', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { mode: 'slideshow', label: 'Slideshow', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { mode: 'swipe', label: 'Swipe', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' }
]

function CharacterGrid({ characters, onSelect, onImageAdded, sortField, sortDirection, onSortFieldChange, onSortDirectionChange, onShuffle, density, onDensityChange, filterNeedImages, onToggleNeedImages, filterNameState, onFilterNameChange, filterMinPriority, onFilterMinPriorityChange, galleryMode, onGalleryModeChange, selectionMode, selectedIds, onToggleSelection, onToggleSelectionMode, hasAdvancedFilter, onOpenAdvancedFilter, onClearAdvancedFilter, sidebarCollapsed, onToggleSidebar }: CharacterGridProps): JSX.Element {
  const [imageOnly, setImageOnly] = useState(() => localStorage.getItem('gridImageOnly') === 'true')
  const columnCount = DENSITY_COLUMNS[density] || 3

  const columns = useMemo(
    () => distributeColumns(characters, columnCount),
    [characters, columnCount]
  )

  const hasActiveFilters = filterNeedImages || filterNameState !== 'all' || filterMinPriority > 0 || hasAdvancedFilter

  return (
    <div className="h-full flex flex-col view-enter">
      {/* Sort toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-800 bg-surface-900/50 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="btn-toolbar p-1.5"
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <span className="text-xs text-surface-500 uppercase tracking-wider">Sort</span>
        <select
          value={sortField === 'random' ? 'priority' : sortField}
          onChange={(e) => onSortFieldChange(e.target.value as SortField)}
          className="select-field text-xs"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button
          onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="btn-toolbar"
        >
          {sortDirection === 'asc' ? '\u2191 Ascending' : '\u2193 Descending'}
        </button>
        <button
          onClick={onShuffle}
          className="btn-toolbar"
          title="Shuffle — random arrangement"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4h3l2 5m0 0l3 7h4l4-12h-3M4 20h3l2-5m0 0l3-7" />
          </svg>
          Shuffle
        </button>

        {/* Density slider */}
        <div className="flex items-center gap-1.5 ml-2">
          {/* Small = many blocks */}
          <svg className="w-3.5 h-3.5 text-surface-500" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="3" height="3" rx="0.5" />
            <rect x="4.3" y="0" width="3" height="3" rx="0.5" />
            <rect x="8.6" y="0" width="3" height="3" rx="0.5" />
            <rect x="13" y="0" width="3" height="3" rx="0.5" />
            <rect x="0" y="4.3" width="3" height="3" rx="0.5" />
            <rect x="4.3" y="4.3" width="3" height="3" rx="0.5" />
            <rect x="8.6" y="4.3" width="3" height="3" rx="0.5" />
            <rect x="13" y="4.3" width="3" height="3" rx="0.5" />
            <rect x="0" y="8.6" width="3" height="3" rx="0.5" />
            <rect x="4.3" y="8.6" width="3" height="3" rx="0.5" />
            <rect x="8.6" y="8.6" width="3" height="3" rx="0.5" />
            <rect x="13" y="8.6" width="3" height="3" rx="0.5" />
            <rect x="0" y="13" width="3" height="3" rx="0.5" />
            <rect x="4.3" y="13" width="3" height="3" rx="0.5" />
            <rect x="8.6" y="13" width="3" height="3" rx="0.5" />
            <rect x="13" y="13" width="3" height="3" rx="0.5" />
          </svg>
          <input
            type="range"
            min={1}
            max={5}
            value={density}
            onChange={(e) => onDensityChange(Number(e.target.value))}
            className="w-20 h-1 accent-accent-500 cursor-pointer"
            title={`${columnCount} columns`}
          />
          {/* Big = single large block */}
          <svg className="w-3.5 h-3.5 text-surface-500" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="16" height="16" rx="1.5" />
          </svg>
        </div>

        {/* View mode selector */}
        <div className="flex items-center gap-0.5 ml-auto mr-3">
          {GALLERY_MODES.map(({ mode, label, icon }) => {
            const enabled = true
            return (
            <button
              key={mode}
              onClick={() => enabled && onGalleryModeChange(mode)}
              disabled={!enabled}
              className={`p-1.5 rounded transition-colors ${
                galleryMode === mode
                  ? 'text-accent-400 bg-surface-800'
                  : enabled
                    ? 'text-surface-500 hover:text-surface-300 cursor-pointer'
                    : 'text-surface-700 cursor-not-allowed'
              }`}
              title={enabled ? label : `${label} (coming soon)`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </button>
          )})}
        </div>

        {/* Image-only toggle */}
        <button
          onClick={() => {
            setImageOnly(prev => {
              localStorage.setItem('gridImageOnly', String(!prev))
              return !prev
            })
          }}
          className={imageOnly ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
          title={imageOnly ? 'Show card text' : 'Images only'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Select mode toggle */}
        {onToggleSelectionMode && (
          <button
            onClick={onToggleSelectionMode}
            className={selectionMode ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
            title={selectionMode ? 'Exit selection mode' : 'Select characters'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Select
          </button>
        )}

        <span className="text-xs text-surface-600">
          {selectionMode && selectedIds && selectedIds.size > 0
            ? `${selectedIds.size} / ${characters.length}`
            : `${characters.length} characters`}
        </span>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-800 bg-surface-900/30 shrink-0">
        <span className="text-[10px] text-surface-500 uppercase tracking-wider mr-1">Filter</span>

        {/* Images filter */}
        <button
          onClick={onToggleNeedImages}
          className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
            filterNeedImages
              ? 'bg-accent-600 text-white'
              : 'bg-surface-800 text-surface-400 hover:text-surface-200'
          }`}
        >
          Needs images
        </button>

        {/* Name filter */}
        <button
          onClick={() => onFilterNameChange(filterNameState === 'named' ? 'all' : 'named')}
          className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
            filterNameState === 'named'
              ? 'bg-accent-600 text-white'
              : 'bg-surface-800 text-surface-400 hover:text-surface-200'
          }`}
        >
          Named
        </button>
        <button
          onClick={() => onFilterNameChange(filterNameState === 'unnamed' ? 'all' : 'unnamed')}
          className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
            filterNameState === 'unnamed'
              ? 'bg-accent-600 text-white'
              : 'bg-surface-800 text-surface-400 hover:text-surface-200'
          }`}
        >
          Unnamed
        </button>

        {/* Priority threshold */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] text-surface-500">Priority</span>
          {[1, 2, 3, 4, 5].map((p) => (
            <button
              key={p}
              onClick={() => onFilterMinPriorityChange(filterMinPriority === p ? 0 : p)}
              className={`w-5 h-5 text-[10px] rounded-md transition-colors cursor-pointer ${
                filterMinPriority > 0 && p >= filterMinPriority
                  ? 'bg-accent-600 text-white'
                  : 'bg-surface-800 text-surface-500 hover:text-surface-200'
              }`}
              title={`Show priority ${p}+`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Advanced filter button */}
        <button
          onClick={onOpenAdvancedFilter}
          className={`text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ml-auto ${
            hasAdvancedFilter
              ? 'bg-accent-600 text-white'
              : 'bg-surface-800 text-surface-400 hover:text-surface-200'
          }`}
        >
          {hasAdvancedFilter ? 'Filters Active' : 'Advanced...'}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              if (filterNeedImages) onToggleNeedImages()
              onFilterNameChange('all')
              onFilterMinPriorityChange(0)
              if (onClearAdvancedFilter) onClearAdvancedFilter()
            }}
            className="text-[11px] text-surface-500 hover:text-surface-300 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Masonry grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {characters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-500">
            <div className="text-center border border-dashed border-surface-700 rounded-xl px-12 py-10">
              <svg className="w-12 h-12 mx-auto mb-4 text-surface-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {hasActiveFilters ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                )}
              </svg>
              {hasActiveFilters ? (
                <>
                  <p className="text-lg mb-1 text-surface-400">No matches</p>
                  <p className="text-sm text-surface-600">No characters match the current filters.</p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-1 text-surface-400">No characters yet</p>
                  <p className="text-sm text-surface-600">Import a seed file or add one manually to get started.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
                {col.map((char) => (
                  <CharacterCard
                    key={char.id}
                    char={char}
                    onSelect={onSelect}
                    onImageAdded={onImageAdded}
                    isSelected={selectedIds?.has(char.id)}
                    selectionMode={selectionMode}
                    onToggleSelection={onToggleSelection}
                    imageOnly={imageOnly}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default CharacterGrid
