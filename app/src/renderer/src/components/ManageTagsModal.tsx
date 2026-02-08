import { useState, useEffect, useRef } from 'react'

interface TagWithCount {
  id: number
  name: string
  category: string | null
  character_count: number
}

interface ManageTagsModalProps {
  onClose: () => void
  onChanged: () => void
}

export default function ManageTagsModal({ onClose, onChanged }: ManageTagsModalProps) {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [mergingId, setMergingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  const loadTags = async () => {
    const data = await window.api.getAllTags()
    setTags(data)
  }

  useEffect(() => { loadTags() }, [])
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const filtered = search
    ? tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags

  const sorted = [...filtered].sort((a, b) => b.character_count - a.character_count)

  const startRename = (tag: TagWithCount) => {
    setEditingId(tag.id)
    setEditName(tag.name)
    setMergingId(null)
    setConfirmDeleteId(null)
  }

  const commitRename = async () => {
    if (!editingId || !editName.trim()) return
    await window.api.renameTag(editingId, editName.trim())
    setEditingId(null)
    await loadTags()
    onChanged()
  }

  const commitMerge = async (sourceId: number, targetId: number) => {
    await window.api.mergeTags(sourceId, targetId)
    setMergingId(null)
    await loadTags()
    onChanged()
  }

  const commitDelete = async (tagId: number) => {
    await window.api.deleteTag(tagId)
    setConfirmDeleteId(null)
    await loadTags()
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Manage Tags</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter tags..."
            className="input-field w-full"
          />
          <p className="text-xs text-surface-500 mt-2">{tags.length} tags total</p>
        </div>

        {/* Create tags */}
        <div className="px-6 pb-3">
          <form onSubmit={async (e) => {
            e.preventDefault()
            if (!newTagInput.trim()) return
            const names = newTagInput.split(',').map(s => s.trim()).filter(Boolean)
            for (const name of names) {
              await window.api.createTag(name)
            }
            setNewTagInput('')
            await loadTags()
            onChanged()
          }} className="flex items-center gap-2">
            <input
              type="text"
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              placeholder="New tag (comma-separated for bulk)..."
              className="input-field flex-1 text-sm"
            />
            <button type="submit" className="btn-primary text-xs px-3 py-1.5">Add</button>
          </form>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {sorted.length === 0 && (
            <p className="text-surface-500 text-sm py-4 text-center">No tags found</p>
          )}
          {sorted.map(tag => (
            <div key={tag.id} className="flex items-center gap-2 py-2 border-b border-surface-800/50 group">
              {editingId === tag.id ? (
                <form onSubmit={e => { e.preventDefault(); commitRename() }} className="flex-1 flex items-center gap-2">
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                    className="input-field flex-1 text-sm"
                  />
                  <button type="submit" className="btn-primary text-xs px-2 py-1">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="btn-ghost text-xs px-2 py-1">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-sm text-surface-200 flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-surface-500 tabular-nums">{tag.character_count}</span>

                  {confirmDeleteId === tag.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => commitDelete(tag.id)} className="btn-danger text-xs px-2 py-0.5">Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost text-xs px-2 py-0.5">No</button>
                    </div>
                  ) : mergingId === tag.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        className="select-field text-xs py-0.5"
                        defaultValue=""
                        onChange={e => { if (e.target.value) commitMerge(tag.id, Number(e.target.value)) }}
                      >
                        <option value="" disabled>Merge into...</option>
                        {tags.filter(t => t.id !== tag.id).sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.character_count})</option>
                        ))}
                      </select>
                      <button onClick={() => setMergingId(null)} className="btn-ghost text-xs px-2 py-0.5">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startRename(tag)} className="btn-ghost text-xs px-2 py-0.5" title="Rename">Rename</button>
                      <button onClick={() => { setMergingId(tag.id); setEditingId(null); setConfirmDeleteId(null) }} className="btn-ghost text-xs px-2 py-0.5" title="Merge into another tag">Merge</button>
                      <button onClick={() => { setConfirmDeleteId(tag.id); setEditingId(null); setMergingId(null) }} className="btn-ghost text-xs px-2 py-0.5 hover:text-red-400" title="Delete">&times;</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-800 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Done</button>
        </div>
      </div>
    </div>
  )
}
