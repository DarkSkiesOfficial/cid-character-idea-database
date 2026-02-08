import { useState, useEffect } from 'react'
import type {
  AdvancedFilter,
  FilterLogic,
  FilterPreset,
  CharacterStatus
} from '../../../shared/types'

interface TagWithCount {
  id: number
  name: string
  character_count: number
}

interface GroupWithCount {
  id: number
  name: string
  character_count: number
}

interface CustomFieldDef {
  id: number
  name: string
}

interface AdvancedFilterModalProps {
  onClose: () => void
  onApply: (filter: AdvancedFilter, statusFilter: CharacterStatus | 'all') => void
  currentFilter: AdvancedFilter | null
  currentStatusFilter: CharacterStatus | 'all'
  tags: TagWithCount[]
  groups: GroupWithCount[]
  customFields: CustomFieldDef[]
  statusNames: { waiting: string; active: string; archived: string }
}

export default function AdvancedFilterModal({
  onClose,
  onApply,
  currentFilter,
  currentStatusFilter,
  tags,
  groups,
  customFields,
  statusNames
}: AdvancedFilterModalProps) {
  // Tag filter state
  const [tagIds, setTagIds] = useState<number[]>(currentFilter?.tagIds || [])
  const [tagLogic, setTagLogic] = useState<FilterLogic>(currentFilter?.tagLogic || 'and')
  const [excludeTagIds, setExcludeTagIds] = useState<number[]>(currentFilter?.excludeTagIds || [])

  // Group filter state
  const [groupIds, setGroupIds] = useState<number[]>(currentFilter?.groupIds || [])
  const [groupLogic, setGroupLogic] = useState<FilterLogic>(currentFilter?.groupLogic || 'and')
  const [excludeGroupIds, setExcludeGroupIds] = useState<number[]>(currentFilter?.excludeGroupIds || [])

  // Custom field filter state
  const [fieldFilters, setFieldFilters] = useState<{ fieldId: number; value: string }[]>(
    currentFilter?.customFieldFilters || []
  )

  // Status filter
  const [statusFilter, setStatusFilter] = useState<CharacterStatus | 'all'>(currentStatusFilter)

  // Text search
  const [textSearch, setTextSearch] = useState(currentFilter?.textSearch || '')

  // Presets
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  // Tag/group search
  const [tagSearch, setTagSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')

  useEffect(() => {
    loadPresets()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const loadPresets = async () => {
    const data = await window.api.getFilterPresets()
    setPresets(data)
  }

  const buildFilter = (): AdvancedFilter => {
    const filter: AdvancedFilter = {}
    if (tagIds.length > 0) { filter.tagIds = tagIds; filter.tagLogic = tagLogic }
    if (excludeTagIds.length > 0) filter.excludeTagIds = excludeTagIds
    if (groupIds.length > 0) { filter.groupIds = groupIds; filter.groupLogic = groupLogic }
    if (excludeGroupIds.length > 0) filter.excludeGroupIds = excludeGroupIds
    if (fieldFilters.length > 0) filter.customFieldFilters = fieldFilters.filter(f => f.value.trim())
    if (textSearch.trim()) filter.textSearch = textSearch.trim()
    return filter
  }

  const hasAnyFilter = () => {
    return tagIds.length > 0 || excludeTagIds.length > 0 ||
      groupIds.length > 0 || excludeGroupIds.length > 0 ||
      fieldFilters.some(f => f.value.trim()) || textSearch.trim() ||
      statusFilter !== 'all'
  }

  const handleApply = () => {
    const filter = buildFilter()
    onApply(filter, statusFilter)
    onClose()
  }

  const handleClearAll = () => {
    setTagIds([])
    setExcludeTagIds([])
    setGroupIds([])
    setExcludeGroupIds([])
    setFieldFilters([])
    setTextSearch('')
    setStatusFilter('all')
    setTagLogic('and')
    setGroupLogic('and')
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) return
    const preset: FilterPreset = {
      id: Date.now().toString(36),
      name: presetName.trim(),
      filter: buildFilter(),
      statusFilter,
      createdAt: new Date().toISOString()
    }
    await window.api.saveFilterPreset(preset)
    setPresetName('')
    await loadPresets()
  }

  const handleLoadPreset = (preset: FilterPreset) => {
    const f = preset.filter
    setTagIds(f.tagIds || [])
    setTagLogic(f.tagLogic || 'and')
    setExcludeTagIds(f.excludeTagIds || [])
    setGroupIds(f.groupIds || [])
    setGroupLogic(f.groupLogic || 'and')
    setExcludeGroupIds(f.excludeGroupIds || [])
    setFieldFilters(f.customFieldFilters || [])
    setTextSearch(f.textSearch || '')
    setStatusFilter((preset.statusFilter as CharacterStatus | 'all') || 'all')
    setShowPresets(false)
  }

  const handleDeletePreset = async (id: string) => {
    await window.api.deleteFilterPreset(id)
    await loadPresets()
  }

  const toggleTag = (id: number, list: number[], setList: (v: number[]) => void) => {
    setList(list.includes(id) ? list.filter((t) => t !== id) : [...list, id])
  }

  const addFieldFilter = () => {
    if (customFields.length === 0) return
    const usedIds = new Set(fieldFilters.map(f => f.fieldId))
    const available = customFields.find(cf => !usedIds.has(cf.id))
    if (available) {
      setFieldFilters([...fieldFilters, { fieldId: available.id, value: '' }])
    }
  }

  const removeFieldFilter = (idx: number) => {
    setFieldFilters(fieldFilters.filter((_, i) => i !== idx))
  }

  const filteredTags = tagSearch
    ? tags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : tags

  const filteredGroups = groupSearch
    ? groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    : groups

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-surface-100">Advanced Filters</h2>
            {presets.length > 0 && (
              <button
                onClick={() => setShowPresets(!showPresets)}
                className="btn-ghost text-xs px-2 py-1"
              >
                Presets ({presets.length})
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-surface-300 text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Presets dropdown */}
        {showPresets && presets.length > 0 && (
          <div className="px-6 py-2 border-b border-surface-800 bg-surface-850">
            <div className="space-y-1">
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleLoadPreset(p)}
                    className="flex-1 text-left text-sm text-surface-300 hover:text-accent-400 cursor-pointer py-1 transition-colors"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(p.id)}
                    className="text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-xs"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {/* Text search */}
          <div>
            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1.5">
              Text Search
            </label>
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder="Search name, seed text, prompts, notes..."
              className="input-field w-full text-sm"
            />
          </div>

          {/* Status filter */}
          <div>
            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1.5">
              Status
            </label>
            <div className="flex gap-1.5">
              {(['all', 'waiting', 'active', 'archived'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                    statusFilter === s
                      ? 'bg-accent-600 text-white'
                      : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                  }`}
                >
                  {s === 'all' ? 'All' : statusNames[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Tags — Include */}
          {tags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  Include Tags
                </label>
                <div className="flex items-center gap-0.5 bg-surface-800 rounded-md p-0.5">
                  <button
                    onClick={() => setTagLogic('and')}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      tagLogic === 'and' ? 'bg-accent-600 text-white' : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setTagLogic('or')}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      tagLogic === 'or' ? 'bg-accent-600 text-white' : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    OR
                  </button>
                </div>
              </div>
              {tags.length > 10 && (
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filter tags..."
                  className="input-field w-full text-xs mb-1.5"
                />
              )}
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredTags.map((tag) => {
                  const included = tagIds.includes(tag.id)
                  const excluded = excludeTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id, tagIds, setTagIds)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        // Right-click to exclude
                        if (excluded) {
                          setExcludeTagIds(excludeTagIds.filter((t) => t !== tag.id))
                        } else {
                          setTagIds(tagIds.filter((t) => t !== tag.id))
                          setExcludeTagIds([...excludeTagIds, tag.id])
                        }
                      }}
                      className={`px-2 py-0.5 text-xs rounded-full cursor-pointer transition-colors ${
                        included
                          ? 'bg-accent-600 text-white'
                          : excluded
                            ? 'bg-red-900/40 text-red-400 line-through'
                            : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
                      }`}
                      title={excluded ? 'Excluded (right-click to toggle)' : 'Click to include, right-click to exclude'}
                    >
                      {tag.name}
                      <span className="ml-1 opacity-60">{tag.character_count}</span>
                    </button>
                  )
                })}
              </div>
              {excludeTagIds.length > 0 && (
                <div className="mt-1.5 text-xs text-red-400/70">
                  Excluding: {excludeTagIds.map((id) => tags.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-surface-600 -mt-1">Right-click a tag to exclude it</p>

          {/* Groups — Include */}
          {groups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  Include Groups
                </label>
                <div className="flex items-center gap-0.5 bg-surface-800 rounded-md p-0.5">
                  <button
                    onClick={() => setGroupLogic('and')}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      groupLogic === 'and' ? 'bg-accent-600 text-white' : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setGroupLogic('or')}
                    className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                      groupLogic === 'or' ? 'bg-accent-600 text-white' : 'text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    OR
                  </button>
                </div>
              </div>
              {groups.length > 10 && (
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Filter groups..."
                  className="input-field w-full text-xs mb-1.5"
                />
              )}
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredGroups.map((group) => {
                  const included = groupIds.includes(group.id)
                  const excluded = excludeGroupIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      onClick={() => toggleTag(group.id, groupIds, setGroupIds)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (excluded) {
                          setExcludeGroupIds(excludeGroupIds.filter((g) => g !== group.id))
                        } else {
                          setGroupIds(groupIds.filter((g) => g !== group.id))
                          setExcludeGroupIds([...excludeGroupIds, group.id])
                        }
                      }}
                      className={`px-2 py-0.5 text-xs rounded-full cursor-pointer transition-colors ${
                        included
                          ? 'bg-accent-600 text-white'
                          : excluded
                            ? 'bg-red-900/40 text-red-400 line-through'
                            : 'bg-accent-900/30 text-accent-300 border border-accent-800/50 hover:bg-accent-900/50'
                      }`}
                      title={excluded ? 'Excluded (right-click to toggle)' : 'Click to include, right-click to exclude'}
                    >
                      {group.name}
                      <span className="ml-1 opacity-60">{group.character_count}</span>
                    </button>
                  )
                })}
              </div>
              {excludeGroupIds.length > 0 && (
                <div className="mt-1.5 text-xs text-red-400/70">
                  Excluding: {excludeGroupIds.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-surface-600 -mt-1">Right-click a group to exclude it</p>

          {/* Custom field filters */}
          {customFields.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  Custom Fields
                </label>
                {fieldFilters.length < customFields.length && (
                  <button onClick={addFieldFilter} className="btn-ghost text-xs px-2 py-0.5">
                    + Add
                  </button>
                )}
              </div>
              {fieldFilters.length === 0 ? (
                <p className="text-xs text-surface-600">No field filters. Click + Add to filter by custom fields.</p>
              ) : (
                <div className="space-y-1.5">
                  {fieldFilters.map((ff, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={ff.fieldId}
                        onChange={(e) => {
                          const updated = [...fieldFilters]
                          updated[idx] = { ...updated[idx], fieldId: Number(e.target.value) }
                          setFieldFilters(updated)
                        }}
                        className="select-field text-xs py-1 w-36"
                      >
                        {customFields.map((cf) => (
                          <option key={cf.id} value={cf.id}>{cf.name}</option>
                        ))}
                      </select>
                      <span className="text-xs text-surface-500">contains</span>
                      <input
                        type="text"
                        value={ff.value}
                        onChange={(e) => {
                          const updated = [...fieldFilters]
                          updated[idx] = { ...updated[idx], value: e.target.value }
                          setFieldFilters(updated)
                        }}
                        placeholder="value..."
                        className="input-field flex-1 text-xs py-1"
                      />
                      <button
                        onClick={() => removeFieldFilter(idx)}
                        className="text-surface-500 hover:text-red-400 cursor-pointer text-sm"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset() }}
              placeholder="Save as preset..."
              className="input-field text-xs py-1.5 w-40"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30"
            >
              Save
            </button>
          </div>
          <div className="flex items-center gap-2">
            {hasAnyFilter() && (
              <button onClick={handleClearAll} className="btn-ghost text-xs px-3 py-1.5">
                Clear All
              </button>
            )}
            <button onClick={onClose} className="btn-ghost text-xs px-3 py-1.5">
              Cancel
            </button>
            <button onClick={handleApply} className="btn-primary px-4 py-1.5">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
