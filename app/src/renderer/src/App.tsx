import { useState, useEffect, useCallback, useRef } from 'react'
import type { CharacterWithDetails, CharacterStatus, SortField, SortDirection, TournamentConfig, TournamentMatch, TournamentFormat, AdvancedFilter, LibraryEntry, LibraryRegistry } from '../../shared/types'
import Sidebar from './components/Sidebar'
import CharacterGrid from './components/CharacterGrid'
import CharacterDetail from './components/CharacterDetail'
import SlideshowView from './components/SlideshowView'
import SwipeView from './components/SwipeView'
import CoverFlowView from './components/CoverFlowView'
import ImportModal from './components/ImportModal'
import AddCharacterModal from './components/AddCharacterModal'
import SettingsModal from './components/SettingsModal'
import TournamentSetupModal from './components/TournamentSetupModal'
import TournamentView from './components/TournamentView'
import LoadTournamentModal from './components/LoadTournamentModal'
import ManageTagsModal from './components/ManageTagsModal'
import ManageGroupsModal from './components/ManageGroupsModal'
import ManageCustomFieldsModal from './components/ManageCustomFieldsModal'
import ManageLibrariesModal from './components/ManageLibrariesModal'
import WordCloudModal from './components/WordCloudModal'
import AdvancedFilterModal from './components/AdvancedFilterModal'
import ExportImportModal from './components/ExportImportModal'
import BulkActionBar from './components/BulkActionBar'
import { rehydrateFromMatches } from './utils/bracketGenerator'

export type View = 'grid' | 'detail' | 'tournament'
export type GalleryMode = 'grid' | 'coverflow' | 'slideshow' | 'swipe'

export interface StatusDisplayNames {
  waiting: string
  active: string
  archived: string
}

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

interface TagWithCount {
  id: number
  name: string
  category: string | null
  character_count: number
}

interface GroupWithCount {
  id: number
  name: string
  created_at: string
  character_count: number
}

function App(): JSX.Element {
  const [view, setView] = useState<View>('grid')
  const [characters, setCharacters] = useState<CharacterWithDetails[]>([])
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterWithDetails | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showAddNew, setShowAddNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filterNeedImages, setFilterNeedImages] = useState(false)
  const [filterNameState, setFilterNameState] = useState<'all' | 'named' | 'unnamed'>('all')
  const [filterMinPriority, setFilterMinPriority] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState<CharacterStatus | 'all'>('all')
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [showManageTags, setShowManageTags] = useState(false)
  const [showManageGroups, setShowManageGroups] = useState(false)
  const [showManageCustomFields, setShowManageCustomFields] = useState(false)
  const [showWordCloud, setShowWordCloud] = useState(false)
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter | null>(null)
  const [customFields, setCustomFields] = useState<{ id: number; name: string; sort_order: number; show_on_card: number; usage_count: number }[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const lastClickedIdRef = useRef<number | null>(null)
  const [hideArchived, setHideArchived] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  )
  const [activeWorkList, setActiveWorkList] = useState<{ id: number; name: string | null }[]>([])
  const [statusNames, setStatusNames] = useState<StatusDisplayNames>({
    waiting: 'Waiting', active: 'Active', archived: 'Archived'
  })
  const [stats, setStats] = useState<Stats>({
    totalChars: 0, withImages: 0, withNames: 0, totalTags: 0, totalImages: 0,
    totalGroups: 0, waiting: 0, active: 0, archived: 0
  })

  const [sortField, setSortField] = useState<SortField>(
    () => (localStorage.getItem('sortField') as SortField) || 'priority'
  )
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    () => (localStorage.getItem('sortDirection') as SortDirection) || 'desc'
  )
  const [shuffled, setShuffled] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)
  const [density, setDensity] = useState<number>(
    () => Number(localStorage.getItem('gridDensity')) || 2
  )
  const [galleryMode, setGalleryMode] = useState<GalleryMode>(
    () => (localStorage.getItem('galleryMode') as GalleryMode) || 'grid'
  )
  const [startAtCharacterId, setStartAtCharacterId] = useState<number | null>(null)

  // Tournament state
  const [showTournamentSetup, setShowTournamentSetup] = useState(false)
  const [showLoadTournament, setShowLoadTournament] = useState(false)
  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig | null>(null)
  const [previousView, setPreviousView] = useState<View>('grid')

  // Library state
  const [libraries, setLibraries] = useState<LibraryEntry[]>([])
  const [activeLibrary, setActiveLibrary] = useState<LibraryEntry | null>(null)
  const [showManageLibraries, setShowManageLibraries] = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)

  useEffect(() => {
    if (sortField !== 'random') {
      localStorage.setItem('sortField', sortField)
    }
  }, [sortField])

  useEffect(() => {
    localStorage.setItem('sortDirection', sortDirection)
  }, [sortDirection])

  const handleDensityChange = (value: number) => {
    setDensity(value)
    localStorage.setItem('gridDensity', String(value))
  }

  const handleGalleryModeChange = (mode: GalleryMode, startFromId?: number) => {
    setGalleryMode(mode)
    setStartAtCharacterId(startFromId ?? null)
    localStorage.setItem('galleryMode', mode)
    if (startFromId) {
      setSelectedCharacter(null)
      setView('grid')
    }
  }

  const handleShuffle = () => {
    setShuffled(true)
    setShuffleKey((k) => k + 1)
  }

  const handleSortFieldChange = (field: SortField) => {
    setShuffled(false)
    setSortField(field)
  }

  const loadCharacters = useCallback(async () => {
    const effectiveSortField = shuffled ? 'random' : sortField
    // When advanced filter has text search, use it instead of separate search
    const effectiveSearch = advancedFilter?.textSearch ? '' : searchQuery
    const data = effectiveSearch
      ? await window.api.searchCharacters(effectiveSearch)
      : await window.api.getAllCharacters({
          sortField: effectiveSortField,
          sortDirection,
          statusFilter: advancedFilter ? (statusFilter) : statusFilter,
          tagFilter: advancedFilter ? undefined : (selectedTagId ?? undefined),
          groupFilter: advancedFilter ? undefined : (selectedGroupId ?? undefined),
          advancedFilter: advancedFilter ?? undefined
        })
    setCharacters(data)
  }, [searchQuery, sortField, sortDirection, statusFilter, selectedTagId, selectedGroupId, shuffled, shuffleKey, advancedFilter])

  const loadStats = useCallback(async () => {
    const data = await window.api.getStats()
    setStats(data)
  }, [])

  const loadTags = useCallback(async () => {
    const data = await window.api.getAllTags()
    setTags(data)
  }, [])

  const loadGroups = useCallback(async () => {
    const data = await window.api.getAllGroups()
    setGroups(data)
  }, [])

  const loadCustomFields = useCallback(async () => {
    const data = await window.api.getAllCustomFields()
    setCustomFields(data)
  }, [])

  const loadSettings = useCallback(async () => {
    const settings: { key: string; value: string }[] = await window.api.getSettings()
    const names: StatusDisplayNames = { waiting: 'Waiting', active: 'Active', archived: 'Archived' }
    for (const s of settings) {
      if (s.key === 'status_display_waiting') names.waiting = s.value
      if (s.key === 'status_display_active') names.active = s.value
      if (s.key === 'status_display_archived') names.archived = s.value
      if (s.key === 'hide_archived_default') setHideArchived(s.value !== 'false')
    }
    setStatusNames(names)
  }, [])

  const loadActiveWork = useCallback(async () => {
    const data = await window.api.getAllCharacters({
      statusFilter: 'active',
      sortField: 'updated_at',
      sortDirection: 'desc'
    })
    setActiveWorkList(data.map((c: any) => ({ id: c.id, name: c.name })))
  }, [])

  const loadLibraries = useCallback(async () => {
    const registry: LibraryRegistry = await window.api.getAllLibraries()
    setLibraries(registry.libraries || [])
    const active = registry.libraries?.find(l => l.id === registry.activeLibraryId) || null
    setActiveLibrary(active)
  }, [])

  const refreshAll = useCallback(() => {
    loadCharacters()
    loadStats()
    loadTags()
    loadGroups()
    loadCustomFields()
    loadActiveWork()
  }, [loadCharacters, loadStats, loadTags, loadGroups, loadCustomFields, loadActiveWork])

  const handleSwitchLibrary = useCallback(async (libraryId: string) => {
    const result = await window.api.switchLibrary(libraryId)
    if (result.error) return

    // Reset all filters and selection
    setSelectedCharacter(null)
    setView('grid')
    setSearchQuery('')
    setFilterNeedImages(false)
    setStatusFilter('all')
    setSelectedTagId(null)
    setSelectedGroupId(null)
    setAdvancedFilter(null)
    setSelectionMode(false)
    setSelectedIds(new Set())
    setTournamentConfig(null)

    await loadLibraries()
    await loadSettings()
    refreshAll()
  }, [loadLibraries, loadSettings, refreshAll])

  useEffect(() => {
    Promise.all([
      loadCharacters(),
      loadStats(),
      loadTags(),
      loadGroups(),
      loadCustomFields(),
      loadSettings(),
      loadActiveWork(),
      loadLibraries()
    ]).catch(err => console.error('Failed to load app data:', err))
  }, [loadCharacters, loadStats, loadTags, loadGroups, loadCustomFields, loadSettings, loadActiveWork, loadLibraries])

  const handleSelectCharacter = async (id: number) => {
    const character = await window.api.getCharacter(id)
    setSelectedCharacter(character)
    setView('detail')
  }

  const handleBack = () => {
    setSelectedCharacter(null)
    setView('grid')
    loadCharacters()
    loadStats()
    loadTags()
    loadGroups()
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const displayedCharacters = characters.filter((c) => {
    if (hideArchived && statusFilter === 'all' && c.status === 'archived') return false
    if (filterNeedImages && c.has_images) return false
    if (filterNameState === 'named' && !c.name) return false
    if (filterNameState === 'unnamed' && c.name) return false
    if (filterMinPriority > 0 && c.priority < filterMinPriority) return false
    return true
  })

  // Selection mode handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }

  const handleToggleSelection = (id: number, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey && lastClickedIdRef.current !== null) {
        const ids = displayedCharacters.map(c => c.id)
        const lastIdx = ids.indexOf(lastClickedIdRef.current)
        const currentIdx = ids.indexOf(id)
        if (lastIdx >= 0 && currentIdx >= 0) {
          const start = Math.min(lastIdx, currentIdx)
          const end = Math.max(lastIdx, currentIdx)
          for (let i = start; i <= end; i++) {
            next.add(ids[i])
          }
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      lastClickedIdRef.current = id
      if (!selectionMode && next.size > 0) setSelectionMode(true)
      return next
    })
  }

  const handleSelectAll = () => setSelectedIds(new Set(displayedCharacters.map(c => c.id)))
  const handleClearSelection = () => { setSelectedIds(new Set()); setSelectionMode(false) }

  // Escape key to clear selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        handleClearSelection()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds.size])

  // Batch operation handlers
  const handleBatchAddTag = async (tagName: string) => {
    await window.api.batchAddTag(Array.from(selectedIds), tagName)
    handleClearSelection()
    refreshAll()
  }

  const handleBatchAddToGroup = async (groupName: string) => {
    await window.api.batchAddToGroup(Array.from(selectedIds), groupName)
    handleClearSelection()
    refreshAll()
  }

  const handleBatchSetPriority = async (priority: number) => {
    await window.api.batchSetPriority(Array.from(selectedIds), priority)
    handleClearSelection()
    refreshAll()
  }

  const handleBatchSetStatus = async (status: CharacterStatus) => {
    await window.api.batchSetStatus(Array.from(selectedIds), status)
    handleClearSelection()
    refreshAll()
  }

  const handleBatchDelete = async () => {
    await window.api.batchDelete(Array.from(selectedIds))
    handleClearSelection()
    refreshAll()
  }

  const handleBatchSetCustomField = async (fieldId: number, value: string) => {
    await window.api.batchSetCustomFieldValue(Array.from(selectedIds), fieldId, value)
    handleClearSelection()
    refreshAll()
  }

  const handleBatchPullOffShelf = async () => {
    for (const id of selectedIds) {
      await window.api.pullOffShelf(id)
    }
    handleClearSelection()
    refreshAll()
  }

  const handleWorkflowAction = async (characterId: number, action: 'pull' | 'return' | 'archive' | 'unarchive') => {
    let updated: CharacterWithDetails | null = null
    switch (action) {
      case 'pull':
        updated = await window.api.pullOffShelf(characterId)
        break
      case 'return':
        updated = await window.api.returnToShelf(characterId)
        break
      case 'archive':
        updated = await window.api.archiveCharacter(characterId)
        break
      case 'unarchive':
        updated = await window.api.unarchiveCharacter(characterId)
        break
    }
    if (action === 'archive') {
      // Navigate back to grid so user sees the character disappear (hidden by default)
      setSelectedCharacter(null)
      setView('grid')
    } else if (updated) {
      setSelectedCharacter(updated)
    }
    refreshAll()
  }

  const handleImportDone = () => {
    setShowImport(false)
    refreshAll()
  }

  const handleAddDone = () => {
    setShowAddNew(false)
    refreshAll()
  }

  const handleCharacterUpdated = async (id: number) => {
    const updated = await window.api.getCharacter(id)
    setSelectedCharacter(updated)
    loadStats()
    loadTags()
    loadGroups()
  }

  const handleCharacterDeleted = () => {
    setSelectedCharacter(null)
    setView('grid')
    refreshAll()
  }

  // Tournament handlers
  const handleStartTournament = async (config: TournamentConfig) => {
    console.log('Starting tournament with config:', config)
    console.log('Character count:', config.characters.length)
    console.log('First character:', config.characters[0])

    setShowTournamentSetup(false)

    // Fetch full character details for all tournament participants
    // Use Promise.all for parallel fetching
    const fullCharacters = await Promise.all(
      config.characters.map(c => window.api.getCharacter(c.id))
    )
    const validCharacters = fullCharacters.filter((c): c is CharacterWithDetails => c !== null)

    console.log('Fetched full characters:', validCharacters.length)

    if (validCharacters.length < 2) {
      console.error('Not enough valid characters for tournament')
      return
    }

    // Set config and view together
    const newConfig: TournamentConfig = {
      ...config,
      characters: validCharacters
    }
    setPreviousView(view)
    setTournamentConfig(newConfig)
    setView('tournament')
  }

  const handleLoadTournament = async (tournamentId: number) => {
    setShowLoadTournament(false)
    const data = await window.api.getTournament(tournamentId)
    if (!data) return

    // Build character map from current characters
    const characterMap = new Map<number, CharacterWithDetails>()

    // We need to fetch full character details for all characters in the tournament
    const charIds = new Set<number>()
    for (const m of data.matches as TournamentMatch[]) {
      if (m.character1_id) charIds.add(m.character1_id)
      if (m.character2_id) charIds.add(m.character2_id)
      if (m.winner_id) charIds.add(m.winner_id)
    }

    for (const id of charIds) {
      const char = await window.api.getCharacter(id)
      if (char) characterMap.set(id, char)
    }

    // Rehydrate bracket
    const bracketState = rehydrateFromMatches(
      data.matches as TournamentMatch[],
      characterMap,
      data.format as TournamentFormat
    )

    // Create config from loaded data
    const loadedConfig: TournamentConfig = {
      name: data.name,
      format: data.format as TournamentFormat,
      characters: Array.from(characterMap.values()),
      shuffle: false // Already positioned
    }

    setTournamentConfig(loadedConfig)
    setPreviousView(view)
    setView('tournament')
  }

  const handleExitTournament = () => {
    setTournamentConfig(null)
    setView('grid')
    loadCharacters()
    loadStats()
  }

  const handleTournamentSelectCharacter = async (id: number) => {
    // View character detail during tournament
    const character = await window.api.getCharacter(id)
    setSelectedCharacter(character)
    setPreviousView('tournament')
    setView('detail')
  }

  return (
    <div className="flex h-screen w-screen">
      {!sidebarCollapsed && <Sidebar
        stats={stats}
        statusNames={statusNames}
        statusFilter={statusFilter}
        onStatusFilterChange={(s) => setStatusFilter(s)}
        onSearch={handleSearch}
        onImport={() => setShowImport(true)}
        onAddNew={() => setShowAddNew(true)}
        onSettings={() => setShowSettings(true)}
        onHome={handleBack}
        searchQuery={searchQuery}
        filterNeedImages={filterNeedImages}
        onToggleNeedImages={() => setFilterNeedImages((prev) => !prev)}
        libraries={libraries}
        activeLibrary={activeLibrary}
        onSwitchLibrary={handleSwitchLibrary}
        onManageLibraries={() => setShowManageLibraries(true)}
        tags={tags}
        selectedTagId={selectedTagId}
        onTagFilterChange={(id) => setSelectedTagId(id)}
        onDeleteTag={async (tagId) => {
          await window.api.deleteTag(tagId)
          loadTags()
          loadStats()
          if (selectedCharacter) {
            const updated = await window.api.getCharacter(selectedCharacter.id)
            setSelectedCharacter(updated)
          }
        }}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onGroupFilterChange={(id) => setSelectedGroupId(id)}
        onDeleteGroup={async (groupId) => {
          await window.api.deleteGroup(groupId)
          loadGroups()
          loadStats()
          if (selectedCharacter) {
            const updated = await window.api.getCharacter(selectedCharacter.id)
            setSelectedCharacter(updated)
          }
        }}
        onManageTags={() => setShowManageTags(true)}
        onManageGroups={() => setShowManageGroups(true)}
        onManageCustomFields={() => setShowManageCustomFields(true)}
        onWordCloud={() => setShowWordCloud(true)}
        onClearLibrary={async () => {
          await window.api.clearLibrary()
          setSelectedCharacter(null)
          setView('grid')
          setFilterNeedImages(false)
          setStatusFilter('all')
          setSelectedTagId(null)
          setSelectedGroupId(null)
          refreshAll()
        }}
        onStartTournament={() => setShowTournamentSetup(true)}
        onLoadTournament={() => setShowLoadTournament(true)}
        onExportImport={() => setShowExportImport(true)}
        activeCharacters={activeWorkList}
        onSelectCharacter={handleSelectCharacter}
        onOpenCurrentWork={() => window.api.openCurrentWork()}
      />}

      <main className="flex-1 overflow-hidden">
        {view === 'grid' && galleryMode === 'slideshow' && (
          <SlideshowView
            characterIds={displayedCharacters.map(c => ({ id: c.id, name: c.name }))}
            statusNames={statusNames}
            startAtId={startAtCharacterId}
            onSelectCharacter={handleSelectCharacter}
            onExit={() => handleGalleryModeChange('grid')}
          />
        )}
        {view === 'grid' && galleryMode === 'swipe' && (
          <SwipeView
            characterIds={displayedCharacters.map(c => ({ id: c.id, name: c.name }))}
            statusNames={statusNames}
            startAtId={startAtCharacterId}
            onSelectCharacter={handleSelectCharacter}
            onExit={() => handleGalleryModeChange('grid')}
          />
        )}
        {view === 'grid' && galleryMode === 'coverflow' && (
          <CoverFlowView
            characterIds={displayedCharacters
              .filter(c => (c as any).image_paths?.length > 0)
              .map(c => ({
                id: c.id,
                name: c.name,
                coverImage: (c as any).image_paths?.[0] ?? null
              }))}
            statusNames={statusNames}
            startAtId={startAtCharacterId}
            onSelectCharacter={handleSelectCharacter}
            onExit={() => handleGalleryModeChange('grid')}
          />
        )}
        {view === 'grid' && galleryMode === 'grid' && (
          <CharacterGrid
            characters={displayedCharacters}
            onSelect={handleSelectCharacter}
            onImageAdded={() => { loadCharacters(); loadStats() }}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortFieldChange={handleSortFieldChange}
            onSortDirectionChange={(d) => { setSortDirection(d); setShuffled(false) }}
            onShuffle={handleShuffle}
            density={density}
            onDensityChange={handleDensityChange}
            filterNeedImages={filterNeedImages}
            onToggleNeedImages={() => setFilterNeedImages((p) => !p)}
            filterNameState={filterNameState}
            onFilterNameChange={setFilterNameState}
            filterMinPriority={filterMinPriority}
            onFilterMinPriorityChange={setFilterMinPriority}
            galleryMode={galleryMode}
            onGalleryModeChange={handleGalleryModeChange}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onToggleSelectionMode={handleToggleSelectionMode}
            hasAdvancedFilter={advancedFilter !== null}
            onOpenAdvancedFilter={() => setShowAdvancedFilter(true)}
            onClearAdvancedFilter={() => { setAdvancedFilter(null) }}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => {
              setSidebarCollapsed(prev => {
                localStorage.setItem('sidebarCollapsed', String(!prev))
                return !prev
              })
            }}
          />
        )}
        {view === 'detail' && selectedCharacter && (
          <CharacterDetail
            key={selectedCharacter.id}
            character={selectedCharacter}
            statusNames={statusNames}
            onBack={() => {
              if (previousView === 'tournament' && tournamentConfig) {
                setView('tournament')
                setSelectedCharacter(null)
              } else {
                handleBack()
              }
            }}
            onUpdated={handleCharacterUpdated}
            onDeleted={handleCharacterDeleted}
            onStartMode={(mode) => handleGalleryModeChange(mode, selectedCharacter.id)}
            characterIds={displayedCharacters.map(c => c.id)}
            onNavigate={handleSelectCharacter}
            allTags={tags.map(t => t.name)}
            allGroups={groups.map(g => g.name)}
            onWorkflowAction={handleWorkflowAction}
            libraries={libraries}
            activeLibraryId={activeLibrary?.id || null}
            onMoveToLibrary={async (charId, libId) => {
              await window.api.moveCharacterToLibrary(charId, libId)
              handleBack()
              refreshAll()
            }}
            onCopyToLibrary={async (charId, libId) => {
              await window.api.copyCharacterToLibrary(charId, libId)
            }}
            onExportCharacter={async (charId) => {
              await window.api.exportCharacter(charId)
            }}
          />
        )}
        {view === 'tournament' && tournamentConfig && (
          <TournamentView
            config={tournamentConfig}
            statusNames={statusNames}
            onSelectCharacter={handleTournamentSelectCharacter}
            onExit={handleExitTournament}
          />
        )}
      </main>

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={handleImportDone} />
      )}

      {showAddNew && (
        <AddCharacterModal onClose={() => setShowAddNew(false)} onDone={handleAddDone} />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSettingsChanged={loadSettings}
        />
      )}

      {showTournamentSetup && (
        <TournamentSetupModal
          characters={characters}
          tags={tags}
          statusNames={statusNames}
          onClose={() => setShowTournamentSetup(false)}
          onStart={handleStartTournament}
        />
      )}

      {showLoadTournament && (
        <LoadTournamentModal
          onClose={() => setShowLoadTournament(false)}
          onLoad={handleLoadTournament}
        />
      )}

      {showManageTags && (
        <ManageTagsModal
          onClose={() => setShowManageTags(false)}
          onChanged={refreshAll}
        />
      )}

      {showManageGroups && (
        <ManageGroupsModal
          onClose={() => setShowManageGroups(false)}
          onChanged={refreshAll}
        />
      )}

      {showManageCustomFields && (
        <ManageCustomFieldsModal
          onClose={() => setShowManageCustomFields(false)}
          onChanged={refreshAll}
        />
      )}

      {showWordCloud && (
        <WordCloudModal
          onClose={() => setShowWordCloud(false)}
          onChanged={refreshAll}
        />
      )}

      {showManageLibraries && (
        <ManageLibrariesModal
          libraries={libraries}
          activeLibraryId={activeLibrary?.id || ''}
          onClose={() => setShowManageLibraries(false)}
          onChanged={loadLibraries}
          onSwitchLibrary={handleSwitchLibrary}
        />
      )}

      {showExportImport && (
        <ExportImportModal
          activeLibrary={activeLibrary}
          stats={stats ? { total: stats.totalChars, withImages: stats.withImages } : null}
          onClose={() => setShowExportImport(false)}
          onLibraryImported={() => {
            loadLibraries()
            refreshAll()
          }}
        />
      )}

      {showAdvancedFilter && (
        <AdvancedFilterModal
          onClose={() => setShowAdvancedFilter(false)}
          onApply={(filter, status) => {
            const isEmpty = !filter.tagIds?.length && !filter.excludeTagIds?.length &&
              !filter.groupIds?.length && !filter.excludeGroupIds?.length &&
              !filter.customFieldFilters?.length && !filter.textSearch
            setAdvancedFilter(isEmpty ? null : filter)
            setStatusFilter(status)
            // Clear simple sidebar filters when advanced is applied
            if (!isEmpty) {
              setSelectedTagId(null)
              setSelectedGroupId(null)
            }
          }}
          currentFilter={advancedFilter}
          currentStatusFilter={statusFilter}
          tags={tags}
          groups={groups}
          customFields={customFields}
          statusNames={statusNames}
        />
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={displayedCharacters.length}
          allTags={tags.map(t => t.name)}
          allGroups={groups.map(g => g.name)}
          statusNames={statusNames}
          customFields={customFields}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBatchAddTag={handleBatchAddTag}
          onBatchAddToGroup={handleBatchAddToGroup}
          onBatchSetPriority={handleBatchSetPriority}
          onBatchSetStatus={handleBatchSetStatus}
          onBatchSetCustomField={handleBatchSetCustomField}
          onBatchDelete={handleBatchDelete}
          onBatchPullOffShelf={handleBatchPullOffShelf}
          libraries={libraries}
          activeLibraryId={activeLibrary?.id || null}
          onBatchMoveToLibrary={async (libId) => {
            for (const id of selectedIds) {
              await window.api.moveCharacterToLibrary(id, libId)
            }
            handleClearSelection()
            refreshAll()
          }}
        />
      )}
    </div>
  )
}

export default App
