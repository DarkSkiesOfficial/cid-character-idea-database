import { useState } from 'react'
import type { LibraryEntry } from '../../../shared/types'

const ACCENT_PRESETS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#db2777', '#7c2d12', '#4f46e5', '#0891b2', '#65a30d'
]

const ICON_PRESETS = [
  '\u{1F4DA}', '\u{1F4D6}', '\u{2B50}', '\u{1F525}', '\u{1F3A8}',
  '\u{1F9EA}', '\u{1F512}', '\u{1F680}', '\u{1F4A0}', '\u{1F30C}'
]

interface ManageLibrariesModalProps {
  libraries: LibraryEntry[]
  activeLibraryId: string
  onClose: () => void
  onChanged: () => void
  onSwitchLibrary: (libraryId: string) => void
}

function ManageLibrariesModal({
  libraries,
  activeLibraryId,
  onClose,
  onChanged,
  onSwitchLibrary
}: ManageLibrariesModalProps): JSX.Element {
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newColor, setNewColor] = useState(ACCENT_PRESETS[1])
  const [newIcon, setNewIcon] = useState(ICON_PRESETS[0])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(false)

  const handlePickFolder = async () => {
    const path = await window.api.pickLibraryFolder()
    if (path) setNewPath(path)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newPath.trim()) return
    setCreating(true)
    const result = await window.api.createLibrary({
      name: newName.trim(),
      path: newPath.trim(),
      accentColor: newColor,
      icon: newIcon
    })
    setCreating(false)
    if (!result.error) {
      setNewName('')
      setNewPath('')
      onChanged()
      onSwitchLibrary(result.id)
    }
  }

  const handleStartRename = (lib: LibraryEntry) => {
    setEditingId(lib.id)
    setEditName(lib.name)
  }

  const handleSaveRename = async (lib: LibraryEntry) => {
    if (editName.trim() && editName.trim() !== lib.name) {
      await window.api.updateLibrary(lib.id, { name: editName.trim() })
      onChanged()
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteLibrary(id, deleteFiles)
    setConfirmDeleteId(null)
    setDeleteFiles(false)
    onChanged()
  }

  const handleSetDefault = async (id: string) => {
    await window.api.updateLibrary(id, { isDefault: true })
    onChanged()
  }

  const handleUpdateColor = async (id: string, color: string) => {
    await window.api.updateLibrary(id, { accentColor: color })
    onChanged()
  }

  const handleUpdateIcon = async (id: string, icon: string) => {
    await window.api.updateLibrary(id, { icon })
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-[560px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-800">
          <h2 className="text-lg font-display font-semibold text-surface-100">Manage Libraries</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Create New Library */}
          <div className="bg-surface-800/50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-surface-300">Create New Library</h3>
            <div>
              <label className="text-xs text-surface-500 block mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., NSFW Collection"
                className="w-full input-field"
              />
            </div>
            <div>
              <label className="text-xs text-surface-500 block mb-1">Folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={e => setNewPath(e.target.value)}
                  placeholder="Select a folder..."
                  className="flex-1 input-field"
                  readOnly
                />
                <button onClick={handlePickFolder} className="btn-secondary text-sm px-3">
                  Browse
                </button>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="text-xs text-surface-500 block mb-1">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_PRESETS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                        newColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-800 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <label className="text-xs text-surface-500 block mb-1">Icon</label>
                <div className="flex flex-wrap gap-1">
                  {ICON_PRESETS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewIcon(icon)}
                      className={`w-6 h-6 text-sm rounded cursor-pointer transition-colors ${
                        newIcon === icon ? 'bg-accent-600/30 ring-1 ring-accent-500' : 'hover:bg-surface-700'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newPath.trim() || creating}
              className="btn-primary w-full"
            >
              {creating ? 'Creating...' : 'Create Library'}
            </button>
          </div>

          {/* Library List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-surface-300">Your Libraries</h3>
            {libraries.map(lib => (
              <div
                key={lib.id}
                className="bg-surface-800/50 rounded-lg p-3 space-y-2"
                style={{ borderLeft: `3px solid ${lib.accentColor}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{lib.icon}</span>
                  {editingId === lib.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleSaveRename(lib)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(lib); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 input-field text-sm py-0.5"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-surface-200 cursor-pointer hover:text-surface-100"
                      onClick={() => handleStartRename(lib)}
                      title="Click to rename"
                    >
                      {lib.name}
                    </span>
                  )}
                  {lib.id === activeLibraryId && (
                    <span className="text-xs text-accent-400 bg-accent-600/20 px-2 py-0.5 rounded">Active</span>
                  )}
                  {lib.isDefault && (
                    <span className="text-xs text-surface-500" title="Default library on startup">Default</span>
                  )}
                </div>

                <div className="text-xs text-surface-600 truncate" title={lib.path}>
                  {lib.path}
                </div>

                {/* Color + Icon pickers */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex flex-wrap gap-1">
                    {ACCENT_PRESETS.map(color => (
                      <button
                        key={color}
                        onClick={() => handleUpdateColor(lib.id, color)}
                        className={`w-3.5 h-3.5 rounded-full cursor-pointer transition-transform ${
                          lib.accentColor === color ? 'ring-1 ring-white scale-110' : 'hover:scale-110 opacity-50 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {ICON_PRESETS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => handleUpdateIcon(lib.id, icon)}
                        className={`w-5 h-5 text-xs rounded cursor-pointer transition-colors ${
                          lib.icon === icon ? 'bg-accent-600/30' : 'hover:bg-surface-700 opacity-50 hover:opacity-100'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 pt-1">
                  {lib.id !== activeLibraryId && (
                    <button
                      onClick={() => { onSwitchLibrary(lib.id); onClose() }}
                      className="text-xs text-accent-400 hover:text-accent-300 cursor-pointer transition-colors"
                    >
                      Switch to
                    </button>
                  )}
                  {!lib.isDefault && (
                    <button
                      onClick={() => handleSetDefault(lib.id)}
                      className="text-xs text-surface-500 hover:text-surface-300 cursor-pointer transition-colors"
                    >
                      Set as default
                    </button>
                  )}
                  {lib.id !== activeLibraryId && libraries.length > 1 && (
                    <>
                      {confirmDeleteId === lib.id ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <label className="text-xs text-surface-500 flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={deleteFiles}
                              onChange={e => setDeleteFiles(e.target.checked)}
                              className="rounded"
                            />
                            Delete files
                          </label>
                          <button
                            onClick={() => handleDelete(lib.id)}
                            className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(null); setDeleteFiles(false) }}
                            className="text-xs text-surface-500 hover:text-surface-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(lib.id)}
                          className="text-xs text-surface-600 hover:text-red-400 cursor-pointer transition-colors ml-auto"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManageLibrariesModal
