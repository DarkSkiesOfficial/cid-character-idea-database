import { useState, useEffect, useCallback, useRef } from 'react'
import type { CharacterWithDetails, CharacterStatus, ContentCategory, CustomField } from '../../../shared/types'
import MarkdownView from './MarkdownView'
import TextToolbar from './TextToolbar'
import ImageDuplicateModal from './ImageDuplicateModal'
import type { DuplicateMatch } from './ImageDuplicateModal'
import ImageLightbox from './ImageLightbox'
import AutocompleteInput from './AutocompleteInput'

interface StatusDisplayNames {
  waiting: string
  active: string
  archived: string
}

type GalleryMode = 'grid' | 'coverflow' | 'slideshow' | 'swipe'

interface LibraryEntry {
  id: string
  name: string
  accentColor: string
  icon: string
}

interface CharacterDetailProps {
  character: CharacterWithDetails
  statusNames: StatusDisplayNames
  onBack: () => void
  onUpdated: (id: number) => void
  onDeleted: () => void
  onStartMode?: (mode: GalleryMode) => void
  characterIds?: number[]
  onNavigate?: (id: number) => void
  allTags?: string[]
  allGroups?: string[]
  onWorkflowAction?: (characterId: number, action: 'pull' | 'return' | 'archive' | 'unarchive') => void
  libraries?: LibraryEntry[]
  activeLibraryId?: string | null
  onMoveToLibrary?: (characterId: number, libraryId: string) => void
  onCopyToLibrary?: (characterId: number, libraryId: string) => void
  onExportCharacter?: (characterId: number) => void
}

function localFileUrl(filePath: string): string {
  return `local-file://${encodeURIComponent(filePath)}`
}

const STATUS_COLORS: Record<CharacterStatus, string> = {
  waiting: 'bg-status-waiting-bg text-status-waiting',
  active: 'bg-status-active-bg text-status-active',
  archived: 'bg-surface-800 text-surface-500'
}

interface PendingDupeCheck {
  sourcePath: string
  matches: DuplicateMatch[]
  remainingPaths: string[]
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

function placeholderGradient(char: { name: string | null; seed_text: string; id: number; priority: number }): { background: string; textColor: string } {
  const seed = char.name || char.seed_text.substring(0, 40) || String(char.id)
  const h = hashCode(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h >> 8) % 30) % 360
  const sat = 20 + char.priority * 8
  const angle = (h >> 4) % 360
  return {
    background: `linear-gradient(${angle}deg, hsl(${hue1}, ${sat}%, 18%) 0%, hsl(${hue2}, ${sat}%, 12%) 100%)`,
    textColor: `hsl(${hue1}, ${sat + 15}%, 40%)`
  }
}

function CharacterDetail({ character, statusNames, onBack, onUpdated, onDeleted, onStartMode, characterIds, onNavigate, allTags, allGroups, onWorkflowAction, libraries, activeLibraryId, onMoveToLibrary, onCopyToLibrary, onExportCharacter }: CharacterDetailProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(character.name || '')
  const [seedText, setSeedText] = useState(character.seed_text)
  const [imagePrompts, setImagePrompts] = useState(character.image_prompts || '')
  const [priority, setPriority] = useState(character.priority)
  const [status, setStatus] = useState<CharacterStatus>(character.status)
  const [notes, setNotes] = useState(character.notes || '')
  const [newTag, setNewTag] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [deleteSource, setDeleteSource] = useState(
    () => localStorage.getItem('deleteSourceOnImport') === 'true'
  )
  const [dupeCheck, setDupeCheck] = useState<PendingDupeCheck | null>(null)
  const [categories, setCategories] = useState<ContentCategory[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIsImage, setNewCategoryIsImage] = useState(true)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [activeCategoryDropdown, setActiveCategoryDropdown] = useState<number | null>(null)
  const [globalBackgrounds, setGlobalBackgrounds] = useState<string[]>([])
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'split'>(
    () => (localStorage.getItem('detailLayoutMode') as 'stacked' | 'split') || 'stacked'
  )
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [splitImageIndex, setSplitImageIndex] = useState(0)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({})
  const seedTextRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const loadCustomFields = useCallback(async () => {
    const fields = await window.api.getAllCustomFields()
    setCustomFields(fields)
  }, [])

  const loadCategories = useCallback(async () => {
    const cats = await window.api.getAllCategories()
    setCategories(cats)
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])
  useEffect(() => { loadCustomFields() }, [loadCustomFields])

  // Initialize custom field values from character data
  useEffect(() => {
    const vals: Record<number, string> = {}
    for (const cfv of character.custom_field_values || []) {
      vals[cfv.field_id] = cfv.value
    }
    setFieldValues(vals)
  }, [character.id, character.custom_field_values])

  // Load global backgrounds once
  useEffect(() => {
    window.api.getBackgrounds().then(setGlobalBackgrounds)
  }, [])

  // Reset split image index when character changes
  useEffect(() => { setSplitImageIndex(0) }, [character.id])

  // Keyboard nav: left/right arrows to move between characters (only when not editing)
  useEffect(() => {
    if (!characterIds || !onNavigate || characterIds.length <= 1) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editing) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      const idx = characterIds.indexOf(character.id)
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault()
        onNavigate(characterIds[idx - 1])
      } else if (e.key === 'ArrowRight' && idx < characterIds.length - 1) {
        e.preventDefault()
        onNavigate(characterIds[idx + 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [characterIds, onNavigate, character.id, editing])

  const handleSave = async () => {
    await window.api.updateCharacter(character.id, {
      name: name || null,
      seed_text: seedText,
      image_prompts: imagePrompts || null,
      priority,
      status,
      notes: notes || null
    })

    // Save custom field values that changed
    const existingValues: Record<number, string> = {}
    for (const cfv of character.custom_field_values || []) {
      existingValues[cfv.field_id] = cfv.value
    }
    for (const field of customFields) {
      const newVal = (fieldValues[field.id] || '').trim()
      const oldVal = existingValues[field.id] || ''
      if (newVal !== oldVal) {
        await window.api.setCustomFieldValue(character.id, field.id, newVal)
      }
    }

    setEditing(false)
    onUpdated(character.id)
  }

  const handleCancel = () => {
    setName(character.name || '')
    setSeedText(character.seed_text)
    setImagePrompts(character.image_prompts || '')
    setPriority(character.priority)
    setStatus(character.status)
    setNotes(character.notes || '')
    const vals: Record<number, string> = {}
    for (const cfv of character.custom_field_values || []) {
      vals[cfv.field_id] = cfv.value
    }
    setFieldValues(vals)
    setEditing(false)
  }

  const handleDelete = async () => {
    await window.api.deleteCharacter(character.id)
    onDeleted()
  }

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return
    await window.api.addTagToCharacter(character.id, tagName.trim())
    setNewTag('')
    onUpdated(character.id)
  }

  const handleRemoveTag = async (tagId: number) => {
    await window.api.removeTagFromCharacter(character.id, tagId)
    onUpdated(character.id)
  }

  const handleAddGroup = async (groupName: string) => {
    if (!groupName.trim()) return
    await window.api.addCharacterToGroup(character.id, groupName.trim())
    setNewGroup('')
    onUpdated(character.id)
  }

  const handleRemoveGroup = async (groupId: number) => {
    await window.api.removeCharacterFromGroup(character.id, groupId)
    onUpdated(character.id)
  }

  const handleToggleDeleteSource = () => {
    setDeleteSource((prev) => {
      const next = !prev
      localStorage.setItem('deleteSourceOnImport', String(next))
      return next
    })
  }

  // Process a queue of image paths, checking each for duplicates
  const processImageQueue = async (paths: string[]) => {
    for (let i = 0; i < paths.length; i++) {
      const sourcePath = paths[i]
      const matches: DuplicateMatch[] = await window.api.checkImageDuplicates(sourcePath)

      if (matches.length > 0) {
        // Show modal and wait for user decision
        setDupeCheck({
          sourcePath,
          matches,
          remainingPaths: paths.slice(i + 1)
        })
        return // Modal will handle continuing the queue
      }

      // No dupes, add directly
      await window.api.addImage(character.id, sourcePath, { deleteSource })
    }
    onUpdated(character.id)
  }

  const handleDupeKeepBoth = async () => {
    if (!dupeCheck) return
    await window.api.addImage(character.id, dupeCheck.sourcePath, { deleteSource })
    const remaining = dupeCheck.remainingPaths
    setDupeCheck(null)
    if (remaining.length > 0) {
      await processImageQueue(remaining)
    } else {
      onUpdated(character.id)
    }
  }

  const handleDupeSkip = async () => {
    if (!dupeCheck) return
    const remaining = dupeCheck.remainingPaths
    setDupeCheck(null)
    if (remaining.length > 0) {
      await processImageQueue(remaining)
    } else {
      onUpdated(character.id)
    }
  }

  const handleDupeReplace = async (existingImageId: number) => {
    if (!dupeCheck) return
    // Remove the existing image, then add the new one
    await window.api.removeImage(existingImageId)
    await window.api.addImage(character.id, dupeCheck.sourcePath, { deleteSource })
    const remaining = dupeCheck.remainingPaths
    setDupeCheck(null)
    if (remaining.length > 0) {
      await processImageQueue(remaining)
    } else {
      onUpdated(character.id)
    }
  }

  const handleAddImages = async () => {
    const paths = await window.api.pickImages()
    if (paths.length > 0) {
      await processImageQueue(paths)
    }
  }

  const handleSetCover = async (imageId: number) => {
    await window.api.setCoverImage(character.id, imageId)
    onUpdated(character.id)
  }

  const handleRemoveImage = async (imageId: number) => {
    await window.api.removeImage(imageId)
    onUpdated(character.id)
  }

  const handleOpenFolder = () => {
    window.api.openFolder(character.folder_path)
  }

  const handleSetImageCategory = async (imageId: number, categoryId: number | null) => {
    await window.api.setImageCategory(imageId, categoryId)
    setActiveCategoryDropdown(null)
    onUpdated(character.id)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    await window.api.createCategory(newCategoryName.trim(), newCategoryIsImage)
    setNewCategoryName('')
    setNewCategoryIsImage(true)
    setShowNewCategory(false)
    loadCategories()
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter((f) =>
      /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(f.name)
    )

    const paths = imageFiles.map((f) => window.api.getPathForFile(f))
    if (paths.length > 0) {
      await processImageQueue(paths)
    }
  }, [character.id, onUpdated, deleteSource, processImageQueue])

  // Find a background image: character "backgrounds" category > any character landscape > global backgrounds folder
  const backgroundSrc = (() => {
    const bgCategory = character.images.filter((img) =>
      img.category_name?.toLowerCase() === 'backgrounds' && img.width && img.height && img.width > img.height
    )
    if (bgCategory.length > 0) return localFileUrl(bgCategory[0].file_path)
    const landscape = character.images.find((img) =>
      img.width && img.height && img.width > img.height
    )
    if (landscape) return localFileUrl(landscape.file_path)
    if (globalBackgrounds.length > 0) {
      const pick = globalBackgrounds[character.id % globalBackgrounds.length]
      return localFileUrl(pick)
    }
    return null
  })()

  // --- Render functions (shared between stacked and split layouts) ---

  const renderImageGrid = () => (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Images</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer group" title="Source files will be permanently removed after successful copy">
            <input
              type="checkbox"
              checked={deleteSource}
              onChange={handleToggleDeleteSource}
              className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className={`text-xs transition-colors ${deleteSource ? 'text-red-400' : 'text-surface-500 group-hover:text-surface-400'}`}>
              Delete originals on import
            </span>
          </label>
          <button onClick={handleAddImages} className="btn-ghost">
            + Add Images
          </button>
        </div>
      </div>
      {character.images.length > 0 ? (
        (() => {
          const grouped: Record<string, typeof character.images> = {}
          for (const img of character.images) {
            const cat = img.category_name || 'Default'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(img)
          }
          const categoryNames = Object.keys(grouped)
          const hasMultipleCategories = categoryNames.length > 1
          return (
            <div className="space-y-4">
              {categoryNames.map((catName) => (
                <div key={catName}>
                  {hasMultipleCategories && (
                    <h3 className="text-xs font-medium text-surface-500 mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                      {catName}
                      <span className="text-surface-600">({grouped[catName].length})</span>
                    </h3>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {grouped[catName].map((img) => {
                      const isLandscape = img.width && img.height && img.width > img.height
                      return (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden bg-surface-800">
                        <img
                          src={localFileUrl(img.file_path)}
                          alt=""
                          className={`w-full object-cover ${isLandscape ? 'aspect-[3/2]' : 'aspect-[2/3]'}`}
                        />
                        {img.category_name && (
                          <span className="absolute top-1.5 left-1.5 bg-black/60 text-surface-300 text-[10px] px-1.5 py-0.5 rounded">
                            {img.category_name}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-end pb-2 gap-1.5 opacity-0 group-hover:opacity-100">
                          {categories.filter((c) => c.is_image_type).length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveCategoryDropdown(activeCategoryDropdown === img.id ? null : img.id)
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-surface-700/90 text-surface-300 hover:bg-surface-600"
                              >
                                {img.category_name || 'Default'} ▾
                              </button>
                              {activeCategoryDropdown === img.id && (
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-surface-800 border border-surface-700 rounded shadow-xl z-20 min-w-[120px] py-1">
                                  <button
                                    onClick={() => handleSetImageCategory(img.id, null)}
                                    className={`block w-full text-left text-xs px-3 py-1.5 hover:bg-surface-700 ${
                                      !img.category_id ? 'text-accent-400' : 'text-surface-300'
                                    }`}
                                  >
                                    Default
                                  </button>
                                  {categories.filter((c) => c.is_image_type).map((cat) => (
                                    <button
                                      key={cat.id}
                                      onClick={() => handleSetImageCategory(img.id, cat.id)}
                                      className={`block w-full text-left text-xs px-3 py-1.5 hover:bg-surface-700 ${
                                        img.category_id === cat.id ? 'text-accent-400' : 'text-surface-300'
                                      }`}
                                    >
                                      {cat.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => handleSetCover(img.id)}
                              className={`text-xs px-2 py-1 rounded ${img.is_cover ? 'bg-accent-500 text-white' : 'bg-surface-700 text-surface-200 hover:bg-surface-600'}`}>
                              {img.is_cover ? 'Cover' : 'Set Cover'}
                            </button>
                            <button onClick={() => handleRemoveImage(img.id)}
                              className="text-xs px-2 py-1 rounded bg-red-900/80 text-red-200 hover:bg-red-800">
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()
      ) : (
        <div className="border border-dashed border-surface-700 rounded-lg p-8 text-center text-surface-600">
          <p>No images yet. Drag and drop images here, or click &quot;+ Add Images&quot; above.</p>
        </div>
      )}
    </section>
  )

  const renderCategories = () => (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Content Folders</h2>
        <button
          onClick={() => setShowNewCategory(!showNewCategory)}
          className="btn-ghost"
        >
          {showNewCategory ? 'Cancel' : '+ New Category'}
        </button>
      </div>
      {showNewCategory && (
        <form onSubmit={handleCreateCategory} className="flex items-center gap-2 mb-3">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name..."
            className="input-field w-48"
            autoFocus
          />
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={newCategoryIsImage}
              onChange={(e) => setNewCategoryIsImage(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-surface-400">Image type</span>
          </label>
          <button type="submit" className="btn-secondary">
            Create
          </button>
        </form>
      )}
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span key={cat.id}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                cat.is_image_type
                  ? 'bg-purple-900/30 text-purple-300 border-purple-800/50'
                  : 'bg-surface-800 text-surface-400 border-surface-700'
              }`}
            >
              {cat.is_image_type ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )}
              {cat.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-surface-600 text-xs">No content categories. Create one to organize images into sub-folders.</p>
      )}
    </section>
  )

  const renderInfoFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Name</label>
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full input-field"
            placeholder="Character name..." />
        ) : (
          <p className="text-surface-200 text-sm">{character.name || 'Unnamed'}</p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Priority</label>
        {editing ? (
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full select-field">
            <option value={5}>5 - Must do</option>
            <option value={4}>4 - High</option>
            <option value={3}>3 - Normal</option>
            <option value={2}>2 - Low</option>
            <option value={1}>1 - Someday</option>
          </select>
        ) : (
          <p className="text-surface-200 text-sm">{priority} / 5</p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Status</label>
        {editing ? (
          <select value={status} onChange={(e) => setStatus(e.target.value as CharacterStatus)}
            className="w-full select-field">
            <option value="waiting">{statusNames.waiting}</option>
            <option value="active">{statusNames.active}</option>
            <option value="archived">{statusNames.archived}</option>
          </select>
        ) : (
          <span className={`text-sm px-2.5 py-1 rounded ${STATUS_COLORS[character.status]}`}>
            {statusNames[character.status]}
          </span>
        )}
      </div>
    </div>
  )

  const renderCustomFields = () => {
    if (customFields.length === 0) return null

    const hasValues = customFields.some(f => fieldValues[f.id])
    if (!editing && !hasValues) return null

    return (
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Custom Fields</h2>
        <div className="space-y-2">
          {(editing ? customFields : customFields.filter(f => fieldValues[f.id])).map(field => (
            <div key={field.id} className="flex items-start gap-3">
              <label className="text-xs text-surface-400 w-28 shrink-0 pt-1 text-right">
                {field.name}
              </label>
              {editing ? (
                <input
                  value={fieldValues[field.id] || ''}
                  onChange={(e) => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="input-field flex-1 text-sm"
                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                />
              ) : (
                <p className="text-surface-200 text-sm">{fieldValues[field.id]}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    )
  }

  const renderGroups = () => (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Groups</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {character.groups.map((group) => (
          <span key={group.id}
            className="inline-flex items-center gap-1 bg-accent-900/30 text-accent-300 text-xs px-2.5 py-1 rounded-full border border-accent-800/50">
            {group.name}
            <button onClick={() => handleRemoveGroup(group.id)}
              className="text-accent-600 hover:text-red-400 ml-0.5">&times;</button>
          </span>
        ))}
        {character.groups.length === 0 && (
          <span className="text-surface-600 text-xs">No groups</span>
        )}
      </div>
      <AutocompleteInput
        suggestions={allGroups || []}
        value={newGroup}
        onChange={setNewGroup}
        onSubmit={handleAddGroup}
        placeholder="Add to group..."
        className="input-field w-48"
      />
    </section>
  )

  const renderTags = () => (
    <section className="mb-6">
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Tags</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {character.tags.map((tag) => (
          <span key={tag.id}
            className="inline-flex items-center gap-1 bg-surface-800 text-surface-300 text-xs px-2.5 py-1 rounded-full">
            {tag.name}
            <button onClick={() => handleRemoveTag(tag.id)}
              className="text-surface-600 hover:text-red-400 ml-0.5">&times;</button>
          </span>
        ))}
        {character.tags.length === 0 && (
          <span className="text-surface-600 text-xs">No tags</span>
        )}
      </div>
      <AutocompleteInput
        suggestions={allTags || []}
        value={newTag}
        onChange={setNewTag}
        onSubmit={handleAddTag}
        placeholder="Add tag..."
        className="input-field w-48"
      />
    </section>
  )

  const renderSeedText = () => (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Seed Text</h2>
      {editing ? (
        <>
          <TextToolbar textareaRef={seedTextRef} value={seedText} onChange={setSeedText} />
          <textarea ref={seedTextRef} value={seedText} onChange={(e) => setSeedText(e.target.value)}
            rows={12}
            className="w-full bg-surface-800 text-surface-100 rounded px-4 py-3 text-sm font-mono
                       focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y leading-relaxed" />
        </>
      ) : (
        <div className="bg-surface-900 rounded-lg px-5 py-4 border-l-2 border-accent-500/30">
          <MarkdownView content={character.seed_text} />
        </div>
      )}
    </section>
  )

  const renderPrompts = () => (
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Image Prompts</h2>
      {editing ? (
        <>
          <textarea value={imagePrompts} onChange={(e) => setImagePrompts(e.target.value)}
            rows={8}
            className="w-full bg-surface-800 text-surface-100 rounded px-4 py-3 text-sm font-mono
                       focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y leading-relaxed"
            placeholder="Paste image generation prompts here. Separate multiple prompts with --- on its own line." />
          <p className="text-xs text-surface-600 mt-1">Separate multiple prompts with <code className="bg-surface-800 px-1 rounded">---</code></p>
        </>
      ) : (
        character.image_prompts ? (
          <div className="space-y-3">
            {character.image_prompts.split(/^-{3,}\s*$/m).map((prompt, i) => {
              const trimmed = prompt.trim()
              if (!trimmed) return null
              return (
                <div key={i} className="bg-surface-900 rounded-lg px-4 py-3 relative group">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(trimmed)
                      setCopiedIndex(i)
                      setTimeout(() => setCopiedIndex(null), 1500)
                    }}
                    className={`absolute top-2 right-2 transition-opacity ${
                      copiedIndex === i
                        ? 'opacity-100 text-green-400'
                        : 'text-surface-600 hover:text-accent-400 opacity-0 group-hover:opacity-100'
                    }`}
                    title="Copy to clipboard"
                  >
                    {copiedIndex === i ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <MarkdownView content={trimmed} />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-surface-600 text-sm">No prompts yet.</p>
        )
      )}
    </section>
  )

  const renderNotes = () => (
    <section>
      <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Notes</h2>
      {editing ? (
        <>
          <TextToolbar textareaRef={notesRef} value={notes} onChange={setNotes} />
          <textarea ref={notesRef} value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full bg-surface-800 text-surface-100 rounded px-4 py-3 text-sm
                       focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y leading-relaxed"
            placeholder="Any additional notes..." />
        </>
      ) : (
        character.notes ? (
          <div className="bg-surface-900 rounded-lg px-4 py-3">
            <MarkdownView content={character.notes} />
          </div>
        ) : (
          <p className="text-surface-600 text-sm">No notes.</p>
        )
      )}
    </section>
  )

  // Split layout: left column image gallery
  const renderSplitImageGallery = () => {
    const images = character.images
    const safeIndex = Math.min(splitImageIndex, Math.max(0, images.length - 1))
    const currentImage = images.length > 0 ? images[safeIndex] : null
    const placeholder = images.length === 0 ? placeholderGradient(character) : null

    return (
      <div className="flex flex-col h-full">
        {/* Image display */}
        <div
          className="flex-1 flex items-center justify-center relative group bg-surface-950 cursor-pointer"
          onClick={() => {
            if (currentImage) {
              setLightboxIndex(safeIndex)
              setLightboxOpen(true)
            }
          }}
        >
          {currentImage ? (
            <>
              <img
                src={localFileUrl(currentImage.file_path)}
                alt={character.name || 'Character'}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSplitImageIndex((i) => (i - 1 + images.length) % images.length)
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSplitImageIndex((i) => (i + 1) % images.length)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {/* Counter */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-xs text-white tabular-nums">
                    {safeIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ background: placeholder!.background }}
            >
              <span
                className="text-6xl font-display font-semibold opacity-40"
                style={{ color: placeholder!.textColor }}
              >
                {getInitials(character.name)}
              </span>
              <span className="text-surface-600 text-sm mt-3">No images</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full relative view-enter"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Background — character-specific or global fallback */}
      {backgroundSrc && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src={backgroundSrc}
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.45)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-950/20 to-surface-950/50" />
        </div>
      )}

      <div className="h-full overflow-y-auto relative z-[1]">
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 bg-accent-600/20 border-4 border-dashed border-accent-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-surface-900 rounded-xl px-8 py-6 text-center shadow-2xl">
            <p className="text-xl text-accent-400 font-semibold">Drop images here</p>
            <p className="text-sm text-surface-400 mt-1">PNG, JPG, GIF, WebP</p>
          </div>
        </div>
      )}

      {/* Duplicate check modal */}
      {dupeCheck && (
        <ImageDuplicateModal
          sourcePath={dupeCheck.sourcePath}
          matches={dupeCheck.matches}
          onKeepBoth={handleDupeKeepBoth}
          onSkip={handleDupeSkip}
          onReplace={handleDupeReplace}
        />
      )}

      {/* Top bar */}
      <div className="sticky top-0 bg-surface-950/90 backdrop-blur border-b border-surface-800 px-4 py-2 flex items-center gap-4 z-10">
        <button
          onClick={onBack}
          className="text-surface-400 hover:text-surface-100 transition-colors text-sm"
        >
          &larr; Back
        </button>
        {onStartMode && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => onStartMode('slideshow')}
              className="p-1.5 rounded text-surface-500 hover:text-accent-400 hover:bg-surface-800 transition-colors"
              title="Start Slideshow from here"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => onStartMode('swipe')}
              className="p-1.5 rounded text-surface-500 hover:text-accent-400 hover:bg-surface-800 transition-colors"
              title="Start Swipe from here"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>
        )}
        {/* Layout toggle */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => { setLayoutMode('stacked'); localStorage.setItem('detailLayoutMode', 'stacked') }}
            className={layoutMode === 'stacked' ? 'btn-toolbar-active' : 'btn-toolbar'}
            title="Stacked layout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => { setLayoutMode('split'); localStorage.setItem('detailLayoutMode', 'split') }}
            className={layoutMode === 'split' ? 'btn-toolbar-active' : 'btn-toolbar'}
            title="Split layout"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18M3 3h18v18H3z" />
            </svg>
          </button>
        </div>
        {characterIds && onNavigate && characterIds.length > 1 && (() => {
          const idx = characterIds.indexOf(character.id)
          const prevId = idx > 0 ? characterIds[idx - 1] : null
          const nextId = idx < characterIds.length - 1 ? characterIds[idx + 1] : null
          return (
            <div className="flex items-center gap-1">
              <button
                onClick={() => prevId !== null && onNavigate(prevId)}
                disabled={prevId === null || editing}
                className="p-1.5 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-surface-500"
                title="Previous character"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[10px] text-surface-600 tabular-nums">{idx + 1}/{characterIds.length}</span>
              <button
                onClick={() => nextId !== null && onNavigate(nextId)}
                disabled={nextId === null || editing}
                className="p-1.5 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-surface-500"
                title="Next character"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )
        })()}
        <h1 className="text-lg font-semibold font-display text-surface-100 flex-1 truncate">
          {character.name || <span className="italic text-surface-500 font-sans">Unnamed Character</span>}
        </h1>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary">Save</button>
              <button onClick={handleCancel} className="btn-secondary">Cancel</button>
            </>
          ) : (
            <>
              {character.status === 'waiting' && onWorkflowAction && (
                <button onClick={() => onWorkflowAction(character.id, 'pull')} className="btn-primary">
                  Pull Off Shelf
                </button>
              )}
              {character.status === 'active' && onWorkflowAction && (
                <button onClick={() => onWorkflowAction(character.id, 'return')} className="btn-secondary">
                  Return to Shelf
                </button>
              )}
              {character.status === 'archived' && onWorkflowAction && (
                <button onClick={() => onWorkflowAction(character.id, 'unarchive')} className="btn-secondary">
                  Unarchive
                </button>
              )}
              <button onClick={() => setEditing(true)} className="btn-secondary">Edit</button>
              <button onClick={handleOpenFolder} className="btn-secondary">Open Folder</button>
              {onExportCharacter && (
                <button onClick={() => onExportCharacter(character.id)} className="btn-ghost text-surface-500 text-xs">
                  Export
                </button>
              )}
              {character.status !== 'archived' && onWorkflowAction && (
                <button
                  onClick={() => onWorkflowAction(character.id, 'archive')}
                  className="btn-ghost text-surface-500"
                  title="Archive this character"
                >
                  Archive
                </button>
              )}
              {libraries && libraries.length > 1 && onMoveToLibrary && onCopyToLibrary && (() => {
                const targetLibs = libraries.filter(l => l.id !== activeLibraryId)
                if (targetLibs.length === 0) return null
                return (
                  <div className="relative group/libmenu">
                    <button className="btn-ghost text-surface-500 text-xs">
                      Library...
                    </button>
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover/libmenu:block bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                      <div className="px-3 py-1 text-xs text-surface-500 font-semibold">Move to</div>
                      {targetLibs.map(lib => (
                        <button
                          key={`move-${lib.id}`}
                          onClick={() => onMoveToLibrary(character.id, lib.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 hover:text-surface-100 cursor-pointer flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lib.accentColor }} />
                          <span>{lib.icon}</span>
                          <span className="truncate">{lib.name}</span>
                        </button>
                      ))}
                      <div className="border-t border-surface-700 my-1" />
                      <div className="px-3 py-1 text-xs text-surface-500 font-semibold">Copy to</div>
                      {targetLibs.map(lib => (
                        <button
                          key={`copy-${lib.id}`}
                          onClick={() => onCopyToLibrary(character.id, lib.id)}
                          className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 hover:text-surface-100 cursor-pointer flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lib.accentColor }} />
                          <span>{lib.icon}</span>
                          <span className="truncate">{lib.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {confirmDelete ? (
                <div className="flex gap-1">
                  <button onClick={handleDelete} className="btn-danger">
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-secondary">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="btn-danger-ghost">
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && character.images.length > 0 && (
        <ImageLightbox
          images={character.images.map(img => ({
            path: img.file_path,
            characterName: character.name,
            characterId: character.id
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {layoutMode === 'stacked' ? (
        <div className="p-6 max-w-5xl mx-auto">
          {renderImageGrid()}
          {renderCategories()}
          {renderInfoFields()}
          {renderCustomFields()}
          {renderGroups()}
          {renderTags()}
          {renderSeedText()}
          {renderPrompts()}
          {renderNotes()}
        </div>
      ) : (
        <>
          {/* Split layout: two columns + below fold */}
          <div className="flex" style={{ minHeight: 'calc(100vh - 52px)' }}>
            {/* Left column — sticky image gallery */}
            <div className="w-[45%] min-w-[340px] max-w-[560px] sticky top-[44px] self-start border-r border-surface-800"
              style={{ height: 'calc(100vh - 44px)' }}>
              {renderSplitImageGallery()}
            </div>

            {/* Right column — character info (scrolls with page) */}
            <div className="flex-1 p-6">
              <div className="max-w-2xl">
                {/* Character name hero */}
                <h2 className="text-3xl font-display font-semibold text-surface-100 mb-6">
                  {editing ? (
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full input-field text-2xl font-display"
                      placeholder="Character name..." />
                  ) : (
                    character.name || <span className="italic text-surface-500 font-sans text-xl">Unnamed Character</span>
                  )}
                </h2>

                {/* Priority & Status side by side */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Priority</label>
                    {editing ? (
                      <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
                        className="w-full select-field">
                        <option value={5}>5 - Must do</option>
                        <option value={4}>4 - High</option>
                        <option value={3}>3 - Normal</option>
                        <option value={2}>2 - Low</option>
                        <option value={1}>1 - Someday</option>
                      </select>
                    ) : (
                      <p className="text-surface-200 text-sm">{priority} / 5</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Status</label>
                    {editing ? (
                      <select value={status} onChange={(e) => setStatus(e.target.value as CharacterStatus)}
                        className="w-full select-field">
                        <option value="waiting">{statusNames.waiting}</option>
                        <option value="active">{statusNames.active}</option>
                        <option value="archived">{statusNames.archived}</option>
                      </select>
                    ) : (
                      <span className={`text-sm px-2.5 py-1 rounded ${STATUS_COLORS[character.status]}`}>
                        {statusNames[character.status]}
                      </span>
                    )}
                  </div>
                </div>

                {renderCustomFields()}
                {renderGroups()}
                {renderTags()}
                {renderSeedText()}
                {renderPrompts()}
                {renderNotes()}

                {/* Down arrow hint */}
                <div className="flex justify-center py-4 opacity-30">
                  <svg className="w-5 h-5 text-surface-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Below fold — full width image management */}
          <div className="border-t border-surface-800 bg-surface-950/60 p-6">
            <div className="max-w-5xl mx-auto">
              {renderImageGrid()}
              {renderCategories()}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}

export default CharacterDetail
