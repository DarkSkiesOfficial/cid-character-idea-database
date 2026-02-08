import { useState } from 'react'
import AutocompleteInput from './AutocompleteInput'

type CharacterStatus = 'waiting' | 'active' | 'archived'

interface StatusDisplayNames {
  waiting: string
  active: string
  archived: string
}

interface CustomFieldStub {
  id: number
  name: string
}

interface LibraryEntry {
  id: string
  name: string
  accentColor: string
  icon: string
}

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  allTags: string[]
  allGroups: string[]
  statusNames: StatusDisplayNames
  customFields?: CustomFieldStub[]
  onSelectAll: () => void
  onClearSelection: () => void
  onBatchAddTag: (tagName: string) => void
  onBatchAddToGroup: (groupName: string) => void
  onBatchSetPriority: (priority: number) => void
  onBatchSetStatus: (status: CharacterStatus) => void
  onBatchSetCustomField?: (fieldId: number, value: string) => void
  onBatchDelete: () => void
  onBatchPullOffShelf?: () => void
  libraries?: LibraryEntry[]
  activeLibraryId?: string | null
  onBatchMoveToLibrary?: (libraryId: string) => void
}

type ActiveAction = 'tag' | 'group' | 'priority' | 'status' | 'customfield' | 'delete' | null

export default function BulkActionBar({
  selectedCount, totalCount, allTags, allGroups, statusNames, customFields,
  onSelectAll, onClearSelection, onBatchAddTag, onBatchAddToGroup,
  onBatchSetPriority, onBatchSetStatus, onBatchSetCustomField, onBatchDelete,
  onBatchPullOffShelf, libraries, activeLibraryId, onBatchMoveToLibrary
}: BulkActionBarProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [tagValue, setTagValue] = useState('')
  const [groupValue, setGroupValue] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)
  const [customFieldValue, setCustomFieldValue] = useState('')

  const toggleAction = (action: ActiveAction) => {
    setActiveAction(prev => prev === action ? null : action)
    setTagValue('')
    setGroupValue('')
    setSelectedFieldId(null)
    setCustomFieldValue('')
  }

  return (
    <div className="fixed bottom-0 left-64 right-0 z-40 bg-surface-900/95 backdrop-blur border-t border-surface-700 shadow-2xl">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Selection info */}
        <div className="flex items-center gap-2 mr-2">
          <span className="text-sm font-medium text-accent-400">{selectedCount} selected</span>
          <span className="text-xs text-surface-500">of {totalCount}</span>
        </div>

        {/* Select all / Clear */}
        <button onClick={onSelectAll} className="btn-ghost text-xs">Select All</button>
        <button onClick={onClearSelection} className="btn-ghost text-xs">Clear</button>

        <div className="w-px h-6 bg-surface-700 mx-1" />

        {/* Action buttons */}
        <button
          onClick={() => toggleAction('tag')}
          className={activeAction === 'tag' ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
        >
          + Tag
        </button>
        <button
          onClick={() => toggleAction('group')}
          className={activeAction === 'group' ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
        >
          + Group
        </button>
        <button
          onClick={() => toggleAction('priority')}
          className={activeAction === 'priority' ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
        >
          Priority
        </button>
        <button
          onClick={() => toggleAction('status')}
          className={activeAction === 'status' ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
        >
          Status
        </button>

        {onBatchPullOffShelf && (
          <button
            onClick={() => { onBatchPullOffShelf(); setActiveAction(null) }}
            className="btn-toolbar text-xs"
          >
            Pull Off Shelf
          </button>
        )}

        {libraries && libraries.length > 1 && onBatchMoveToLibrary && (() => {
          const targetLibs = libraries.filter(l => l.id !== activeLibraryId)
          if (targetLibs.length === 0) return null
          return (
            <div className="relative group/bulklib">
              <button className="btn-toolbar text-xs">
                Move to Library
              </button>
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover/bulklib:block bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                {targetLibs.map(lib => (
                  <button
                    key={lib.id}
                    onClick={() => { onBatchMoveToLibrary(lib.id); setActiveAction(null) }}
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

        {customFields && customFields.length > 0 && (
          <button
            onClick={() => toggleAction('customfield')}
            className={activeAction === 'customfield' ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
          >
            Set Field
          </button>
        )}

        <div className="w-px h-6 bg-surface-700 mx-1" />

        <button
          onClick={() => toggleAction('delete')}
          className={activeAction === 'delete' ? 'btn-danger text-xs' : 'btn-danger-ghost text-xs'}
        >
          Delete
        </button>
      </div>

      {/* Action panels */}
      {activeAction === 'tag' && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-surface-400">Add tag:</span>
          <AutocompleteInput
            suggestions={allTags}
            value={tagValue}
            onChange={setTagValue}
            onSubmit={(val) => { onBatchAddTag(val); setActiveAction(null); setTagValue('') }}
            placeholder="Tag name..."
            className="input-field w-56 text-sm"
            dropUp
          />
        </div>
      )}

      {activeAction === 'group' && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-surface-400">Add to group:</span>
          <AutocompleteInput
            suggestions={allGroups}
            value={groupValue}
            onChange={setGroupValue}
            onSubmit={(val) => { onBatchAddToGroup(val); setActiveAction(null); setGroupValue('') }}
            placeholder="Group name..."
            className="input-field w-56 text-sm"
            dropUp
          />
        </div>
      )}

      {activeAction === 'priority' && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-surface-400">Set priority:</span>
          {[1, 2, 3, 4, 5].map(p => (
            <button
              key={p}
              onClick={() => { onBatchSetPriority(p); setActiveAction(null) }}
              className="btn-toolbar text-xs w-8 h-8 flex items-center justify-center"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {activeAction === 'status' && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-surface-400">Set status:</span>
          {(['waiting', 'active', 'archived'] as CharacterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => { onBatchSetStatus(s); setActiveAction(null) }}
              className="btn-toolbar text-xs"
            >
              {statusNames[s]}
            </button>
          ))}
        </div>
      )}

      {activeAction === 'customfield' && customFields && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-surface-400">Set field:</span>
          <select
            className="select-field text-xs"
            value={selectedFieldId ?? ''}
            onChange={e => setSelectedFieldId(Number(e.target.value))}
          >
            <option value="" disabled>Choose field...</option>
            {customFields.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {selectedFieldId && (
            <>
              <input
                value={customFieldValue}
                onChange={e => setCustomFieldValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customFieldValue.trim() && selectedFieldId) {
                    onBatchSetCustomField?.(selectedFieldId, customFieldValue.trim())
                    setActiveAction(null)
                  }
                }}
                placeholder="Value..."
                className="input-field w-48 text-sm"
                autoFocus
              />
              <button
                onClick={() => {
                  if (selectedFieldId && customFieldValue.trim()) {
                    onBatchSetCustomField?.(selectedFieldId, customFieldValue.trim())
                    setActiveAction(null)
                  }
                }}
                className="btn-primary text-xs"
              >
                Apply
              </button>
            </>
          )}
        </div>
      )}

      {activeAction === 'delete' && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-red-400">Delete {selectedCount} character{selectedCount > 1 ? 's' : ''}?</span>
          <button
            onClick={() => { onBatchDelete(); setActiveAction(null) }}
            className="btn-danger text-xs"
          >
            Confirm Delete
          </button>
          <button onClick={() => setActiveAction(null)} className="btn-ghost text-xs">Cancel</button>
        </div>
      )}
    </div>
  )
}
