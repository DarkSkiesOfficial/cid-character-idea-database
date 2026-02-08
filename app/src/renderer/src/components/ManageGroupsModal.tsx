import { useState, useEffect, useRef } from 'react'

interface GroupWithCount {
  id: number
  name: string
  created_at: string
  character_count: number
}

interface ManageGroupsModalProps {
  onClose: () => void
  onChanged: () => void
}

export default function ManageGroupsModal({ onClose, onChanged }: ManageGroupsModalProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [mergingId, setMergingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [newGroupInput, setNewGroupInput] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  const loadGroups = async () => {
    const data = await window.api.getAllGroups()
    setGroups(data)
  }

  useEffect(() => { loadGroups() }, [])
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const filtered = search
    ? groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups

  const sorted = [...filtered].sort((a, b) => b.character_count - a.character_count)

  const startRename = (group: GroupWithCount) => {
    setEditingId(group.id)
    setEditName(group.name)
    setMergingId(null)
    setConfirmDeleteId(null)
  }

  const commitRename = async () => {
    if (!editingId || !editName.trim()) return
    await window.api.renameGroup(editingId, editName.trim())
    setEditingId(null)
    await loadGroups()
    onChanged()
  }

  const commitMerge = async (sourceId: number, targetId: number) => {
    await window.api.mergeGroups(sourceId, targetId)
    setMergingId(null)
    await loadGroups()
    onChanged()
  }

  const commitDelete = async (groupId: number) => {
    await window.api.deleteGroup(groupId)
    setConfirmDeleteId(null)
    await loadGroups()
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Manage Groups</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter groups..."
            className="input-field w-full"
          />
          <p className="text-xs text-surface-500 mt-2">{groups.length} groups total</p>
        </div>

        {/* Create groups */}
        <div className="px-6 pb-3">
          <form onSubmit={async (e) => {
            e.preventDefault()
            if (!newGroupInput.trim()) return
            const names = newGroupInput.split(',').map(s => s.trim()).filter(Boolean)
            for (const name of names) {
              await window.api.createGroup(name)
            }
            setNewGroupInput('')
            await loadGroups()
            onChanged()
          }} className="flex items-center gap-2">
            <input
              type="text"
              value={newGroupInput}
              onChange={e => setNewGroupInput(e.target.value)}
              placeholder="New group (comma-separated for bulk)..."
              className="input-field flex-1 text-sm"
            />
            <button type="submit" className="btn-primary text-xs px-3 py-1.5">Add</button>
          </form>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {sorted.length === 0 && (
            <p className="text-surface-500 text-sm py-4 text-center">No groups found</p>
          )}
          {sorted.map(group => (
            <div key={group.id} className="flex items-center gap-2 py-2 border-b border-surface-800/50 group/row">
              {editingId === group.id ? (
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
                  <span className="text-sm text-surface-200 flex-1 truncate">{group.name}</span>
                  <span className="text-xs text-surface-500 tabular-nums">{group.character_count}</span>

                  {confirmDeleteId === group.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => commitDelete(group.id)} className="btn-danger text-xs px-2 py-0.5">Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost text-xs px-2 py-0.5">No</button>
                    </div>
                  ) : mergingId === group.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        className="select-field text-xs py-0.5"
                        defaultValue=""
                        onChange={e => { if (e.target.value) commitMerge(group.id, Number(e.target.value)) }}
                      >
                        <option value="" disabled>Merge into...</option>
                        {groups.filter(g => g.id !== group.id).sort((a, b) => a.name.localeCompare(b.name)).map(g => (
                          <option key={g.id} value={g.id}>{g.name} ({g.character_count})</option>
                        ))}
                      </select>
                      <button onClick={() => setMergingId(null)} className="btn-ghost text-xs px-2 py-0.5">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button onClick={() => startRename(group)} className="btn-ghost text-xs px-2 py-0.5" title="Rename">Rename</button>
                      <button onClick={() => { setMergingId(group.id); setEditingId(null); setConfirmDeleteId(null) }} className="btn-ghost text-xs px-2 py-0.5" title="Merge into another group">Merge</button>
                      <button onClick={() => { setConfirmDeleteId(group.id); setEditingId(null); setMergingId(null) }} className="btn-ghost text-xs px-2 py-0.5 hover:text-red-400" title="Delete">&times;</button>
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
