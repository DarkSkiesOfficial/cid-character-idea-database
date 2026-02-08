import { useState, useEffect, useRef } from 'react'
import type { LibraryEntry } from '../../../shared/types'

interface Stats {
  totalChars: number
  withImages: number
  withNames: number
  totalTags: number
  totalImages: number
  totalGroups: number
  waiting: number
  active: number
  archived: number
}

interface StatusDisplayNames {
  waiting: string
  active: string
  archived: string
}

interface TagWithCount {
  id: number
  name: string
  category: string | null
  character_count: number
}

type CharacterStatus = 'waiting' | 'active' | 'archived'

interface GroupWithCount {
  id: number
  name: string
  created_at: string
  character_count: number
}

interface SidebarProps {
  stats: Stats
  statusNames: StatusDisplayNames
  statusFilter: CharacterStatus | 'all'
  onStatusFilterChange: (status: CharacterStatus | 'all') => void
  onSearch: (query: string) => void
  onImport: () => void
  onAddNew: () => void
  onSettings: () => void
  onHome: () => void
  searchQuery: string
  filterNeedImages: boolean
  onToggleNeedImages: () => void
  onClearLibrary: () => void
  libraries?: LibraryEntry[]
  activeLibrary?: LibraryEntry | null
  onSwitchLibrary?: (libraryId: string) => void
  onManageLibraries?: () => void
  tags: TagWithCount[]
  selectedTagId: number | null
  onTagFilterChange: (tagId: number | null) => void
  onDeleteTag: (tagId: number) => void
  groups: GroupWithCount[]
  selectedGroupId: number | null
  onGroupFilterChange: (groupId: number | null) => void
  onDeleteGroup: (groupId: number) => void
  onManageTags: () => void
  onManageGroups: () => void
  onManageCustomFields: () => void
  onWordCloud: () => void
  onStartTournament: () => void
  onLoadTournament: () => void
  onExportImport: () => void
  activeCharacters?: { id: number; name: string | null }[]
  onSelectCharacter?: (id: number) => void
  onOpenCurrentWork?: () => void
}

function Sidebar({ stats, statusNames, statusFilter, onStatusFilterChange, onSearch, onImport, onAddNew, onSettings, onHome, searchQuery, filterNeedImages, onToggleNeedImages, onClearLibrary, libraries, activeLibrary, onSwitchLibrary, onManageLibraries, tags, selectedTagId, onTagFilterChange, onDeleteTag, groups, selectedGroupId, onGroupFilterChange, onDeleteGroup, onManageTags, onManageGroups, onManageCustomFields, onWordCloud, onStartTournament, onLoadTournament, onExportImport, activeCharacters, onSelectCharacter, onOpenCurrentWork }: SidebarProps): JSX.Element {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [confirmClear, setConfirmClear] = useState(false)
  const [libraryDropdownOpen, setLibraryDropdownOpen] = useState(false)
  const libraryDropdownRef = useRef<HTMLDivElement>(null)

  // Sync localQuery when parent clears searchQuery externally
  useEffect(() => {
    if (searchQuery !== localQuery) setLocalQuery(searchQuery)
  }, [searchQuery])
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [groupsExpanded, setGroupsExpanded] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')

  // Live search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(localQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [localQuery])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(localQuery)
  }

  const handleClear = () => {
    setLocalQuery('')
    onSearch('')
  }

  // Close library dropdown when clicking outside
  useEffect(() => {
    if (!libraryDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (libraryDropdownRef.current && !libraryDropdownRef.current.contains(e.target as Node)) {
        setLibraryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [libraryDropdownOpen])

  return (
    <aside className="w-64 bg-surface-900 border-r border-surface-800 flex flex-col h-full shrink-0">
      {/* Header with library switcher */}
      <div
        className="p-4 border-b border-surface-800 flex items-center justify-between"
        style={activeLibrary ? { borderLeftColor: activeLibrary.accentColor, borderLeftWidth: '3px' } : undefined}
      >
        <div className="relative flex-1 min-w-0" ref={libraryDropdownRef}>
          <button
            onClick={() => libraries && libraries.length > 0 ? setLibraryDropdownOpen(!libraryDropdownOpen) : onHome()}
            className="text-lg font-semibold font-display text-surface-100 hover:text-accent-400 transition-colors cursor-pointer flex items-center gap-1.5 truncate"
          >
            {activeLibrary && <span className="shrink-0">{activeLibrary.icon}</span>}
            <span className="truncate">{activeLibrary?.name || 'Character Ideas'}</span>
            {libraries && libraries.length > 0 && (
              <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${libraryDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {libraryDropdownOpen && libraries && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 py-1">
              {libraries.map(lib => (
                <button
                  key={lib.id}
                  onClick={() => {
                    if (lib.id !== activeLibrary?.id) onSwitchLibrary?.(lib.id)
                    setLibraryDropdownOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors cursor-pointer ${
                    lib.id === activeLibrary?.id
                      ? 'bg-accent-600/20 text-accent-300'
                      : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: lib.accentColor }}
                  />
                  <span className="shrink-0">{lib.icon}</span>
                  <span className="truncate">{lib.name}</span>
                </button>
              ))}
              <div className="border-t border-surface-700 mt-1 pt-1">
                <button
                  onClick={() => { setLibraryDropdownOpen(false); onManageLibraries?.() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-surface-500 hover:text-accent-400 transition-colors cursor-pointer"
                >
                  Manage libraries...
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onSettings}
          className="text-surface-500 hover:text-surface-300 transition-colors cursor-pointer p-1 shrink-0"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-surface-800">
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search..."
              className="w-full input-field"
            />
            {localQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 text-xs"
              >
                clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Tags (collapsible) */}
      {tags.length > 0 && (() => {
        const sorted = [...tags].sort((a, b) => b.character_count - a.character_count)
        const filtered = tagSearch
          ? sorted.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
          : sorted

        return (
          <div className="border-b border-surface-800">
            <button
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-300 transition-colors cursor-pointer"
            >
              <span>Tags ({tags.length})</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${tagsExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {tagsExpanded && (
              <div className="px-3 pb-3">
                {tags.length > 10 && (
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Filter tags..."
                    className="w-full bg-surface-800 text-surface-100 rounded px-2 py-1 text-xs mb-2
                               placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                )}
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {filtered.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center text-xs rounded-full transition-colors group/tag ${
                        selectedTagId === tag.id
                          ? 'bg-accent-600 text-white'
                          : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
                      }`}
                    >
                      <button
                        onClick={() => onTagFilterChange(selectedTagId === tag.id ? null : tag.id)}
                        className="px-2 py-0.5 cursor-pointer"
                      >
                        {tag.name}
                        <span className={`ml-1 ${selectedTagId === tag.id ? 'text-accent-200' : 'text-surface-600'}`}>
                          {tag.character_count}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (selectedTagId === tag.id) onTagFilterChange(null)
                          onDeleteTag(tag.id)
                        }}
                        className="pr-1.5 opacity-0 group-hover/tag:opacity-100 text-surface-600 hover:text-red-400 cursor-pointer transition-opacity"
                        title="Delete tag"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {filtered.length === 0 && tagSearch && (
                    <span className="text-xs text-surface-600">No matching tags</span>
                  )}
                </div>
                <button
                  onClick={onManageTags}
                  className="text-xs text-surface-600 hover:text-accent-400 mt-2 cursor-pointer transition-colors"
                >
                  Manage tags...
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Groups (collapsible) */}
      {groups.length > 0 && (() => {
        const sorted = [...groups].sort((a, b) => b.character_count - a.character_count)
        const filteredGroups = groupSearch
          ? sorted.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
          : sorted

        return (
          <div className="border-b border-surface-800">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-300 transition-colors cursor-pointer"
            >
              <span>Groups ({groups.length})</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${groupsExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {groupsExpanded && (
              <div className="px-3 pb-3">
                {groups.length > 10 && (
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Filter groups..."
                    className="w-full bg-surface-800 text-surface-100 rounded px-2 py-1 text-xs mb-2
                               placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                )}
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {filteredGroups.map((group) => (
                    <span
                      key={group.id}
                      className={`inline-flex items-center text-xs rounded-full transition-colors group/grp ${
                        selectedGroupId === group.id
                          ? 'bg-accent-600 text-white'
                          : 'bg-accent-900/30 text-accent-300 border border-accent-800/50 hover:bg-accent-900/50'
                      }`}
                    >
                      <button
                        onClick={() => onGroupFilterChange(selectedGroupId === group.id ? null : group.id)}
                        className="px-2 py-0.5 cursor-pointer"
                      >
                        {group.name}
                        <span className={`ml-1 ${selectedGroupId === group.id ? 'text-accent-200' : 'text-accent-700'}`}>
                          {group.character_count}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (selectedGroupId === group.id) onGroupFilterChange(null)
                          onDeleteGroup(group.id)
                        }}
                        className="pr-1.5 opacity-0 group-hover/grp:opacity-100 text-accent-600 hover:text-red-400 cursor-pointer transition-opacity"
                        title="Delete group"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {filteredGroups.length === 0 && groupSearch && (
                    <span className="text-xs text-surface-600">No matching groups</span>
                  )}
                </div>
                <button
                  onClick={onManageGroups}
                  className="text-xs text-surface-600 hover:text-accent-400 mt-2 cursor-pointer transition-colors"
                >
                  Manage groups...
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Custom Fields & Discovery */}
      <div className="px-3 py-2 border-b border-surface-800 space-y-1">
        <button
          onClick={onManageCustomFields}
          className="text-xs text-surface-600 hover:text-accent-400 cursor-pointer transition-colors block"
        >
          Manage custom fields...
        </button>
        <button
          onClick={onWordCloud}
          className="text-xs text-surface-600 hover:text-accent-400 cursor-pointer transition-colors block"
        >
          Discover tags from seeds...
        </button>
      </div>

      {/* Active Work */}
      {activeCharacters && activeCharacters.length > 0 && (
        <div className="border-b border-surface-800">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-status-active uppercase tracking-wider">
              Active Work ({activeCharacters.length})
            </span>
            {onOpenCurrentWork && (
              <button
                onClick={onOpenCurrentWork}
                className="text-surface-600 hover:text-surface-300 transition-colors cursor-pointer"
                title="Open current-work folder"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
          </div>
          <div className="px-3 pb-2 space-y-0.5">
            {activeCharacters.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectCharacter?.(c.id)}
                className="w-full text-left text-xs text-surface-300 hover:text-surface-100 hover:bg-surface-800 rounded px-2 py-1 transition-colors truncate cursor-pointer"
              >
                {c.name || <span className="italic text-surface-500">Unnamed</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-3 space-y-2 border-b border-surface-800">
        <button onClick={onAddNew} className="w-full btn-primary">
          + New Character
        </button>
        <button onClick={onImport} className="w-full btn-secondary">
          Import Seed File
        </button>
        <div className="flex gap-2">
          <button onClick={onStartTournament} className="flex-1 btn-secondary text-xs">
            Tournament
          </button>
          <button onClick={onLoadTournament} className="btn-ghost text-xs px-2" title="Load saved tournament">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>
        <button onClick={onExportImport} className="w-full btn-secondary text-xs">
          Export / Import
        </button>
      </div>

      {/* Status */}
      <div className="p-4 mt-auto border-t border-surface-800">
        {/* Lifecycle */}
        <div className="mt-3 pt-3 border-t border-surface-800 space-y-1.5 text-xs">
          <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Status</h3>
          <button
            onClick={() => onStatusFilterChange(statusFilter === 'waiting' ? 'all' : 'waiting')}
            className={`flex justify-between w-full rounded-md px-1 py-0.5 transition-colors cursor-pointer ${
              statusFilter === 'waiting'
                ? 'bg-status-waiting-bg text-status-waiting'
                : 'text-surface-400 hover:text-surface-300 hover:bg-surface-800'
            }`}
          >
            <span>{statusNames.waiting}</span>
            <span className={statusFilter === 'waiting' ? 'text-status-waiting-dim' : 'text-status-waiting'}>{stats.waiting}</span>
          </button>
          <button
            onClick={() => onStatusFilterChange(statusFilter === 'active' ? 'all' : 'active')}
            className={`flex justify-between w-full rounded-md px-1 py-0.5 transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-status-active-bg text-status-active'
                : 'text-surface-400 hover:text-surface-300 hover:bg-surface-800'
            }`}
          >
            <span>{statusNames.active}</span>
            <span className={statusFilter === 'active' ? 'text-status-active-dim' : 'text-status-active'}>{stats.active}</span>
          </button>
          <button
            onClick={() => onStatusFilterChange(statusFilter === 'archived' ? 'all' : 'archived')}
            className={`flex justify-between w-full rounded-md px-1 py-0.5 transition-colors cursor-pointer ${
              statusFilter === 'archived'
                ? 'bg-surface-700 text-surface-300'
                : 'text-surface-400 hover:text-surface-300 hover:bg-surface-800'
            }`}
          >
            <span>{statusNames.archived}</span>
            <span className={statusFilter === 'archived' ? 'text-surface-200' : 'text-surface-500'}>{stats.archived}</span>
          </button>
        </div>

        {/* Dev: Clear library */}
        <div className="mt-4 pt-3 border-t border-surface-800">
          {confirmClear ? (
            <div className="flex gap-2">
              <button
                onClick={() => { onClearLibrary(); setConfirmClear(false) }}
                className="flex-1 bg-red-900 hover:bg-red-800 text-red-200 rounded px-2 py-1.5 text-xs font-medium"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 bg-surface-800 hover:bg-surface-700 text-surface-400 rounded px-2 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full text-surface-600 hover:text-red-400 text-xs transition-colors"
            >
              Clear Library
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
