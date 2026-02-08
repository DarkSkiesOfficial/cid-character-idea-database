import { useState, useEffect, useRef } from 'react'

interface CustomFieldWithCount {
  id: number
  name: string
  sort_order: number
  show_on_card: number
  created_at: string
  usage_count: number
}

interface ManageCustomFieldsModalProps {
  onClose: () => void
  onChanged: () => void
}

export default function ManageCustomFieldsModal({ onClose, onChanged }: ManageCustomFieldsModalProps) {
  const [fields, setFields] = useState<CustomFieldWithCount[]>([])
  const [search, setSearch] = useState('')
  const [newFieldName, setNewFieldName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const newFieldRef = useRef<HTMLInputElement>(null)

  const loadFields = async () => {
    const data = await window.api.getAllCustomFields()
    setFields(data)
  }

  useEffect(() => { loadFields() }, [])
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus() }, [editingId])

  const filtered = search
    ? fields.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : fields

  const handleCreate = async () => {
    const trimmed = newFieldName.trim()
    if (!trimmed) return
    const result = await window.api.createCustomField(trimmed)
    if (result?.error) return
    setNewFieldName('')
    await loadFields()
    onChanged()
    newFieldRef.current?.focus()
  }

  const startRename = (field: CustomFieldWithCount) => {
    setEditingId(field.id)
    setEditName(field.name)
    setConfirmDeleteId(null)
  }

  const commitRename = async () => {
    if (!editingId || !editName.trim()) return
    await window.api.renameCustomField(editingId, editName.trim())
    setEditingId(null)
    await loadFields()
    onChanged()
  }

  const commitDelete = async (fieldId: number) => {
    await window.api.deleteCustomField(fieldId)
    setConfirmDeleteId(null)
    await loadFields()
    onChanged()
  }

  const toggleShowOnCard = async (field: CustomFieldWithCount) => {
    await window.api.updateCustomField(field.id, { show_on_card: !field.show_on_card })
    await loadFields()
    onChanged()
  }

  const handleDragStart = (fieldId: number) => {
    setDragId(fieldId)
  }

  const handleDragOver = (e: React.DragEvent, fieldId: number) => {
    e.preventDefault()
    setDragOverId(fieldId)
  }

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }

    const ordered = [...fields]
    const dragIndex = ordered.findIndex(f => f.id === dragId)
    const targetIndex = ordered.findIndex(f => f.id === targetId)
    if (dragIndex === -1 || targetIndex === -1) return

    const [moved] = ordered.splice(dragIndex, 1)
    ordered.splice(targetIndex, 0, moved)

    const orderedIds = ordered.map(f => f.id)
    await window.api.reorderCustomFields(orderedIds)
    setDragId(null)
    setDragOverId(null)
    await loadFields()
    onChanged()
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDragOverId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Manage Custom Fields</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        {/* Create new field */}
        <div className="px-6 pt-4 pb-2">
          <form onSubmit={e => { e.preventDefault(); handleCreate() }} className="flex gap-2">
            <input
              ref={newFieldRef}
              type="text"
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              placeholder="New field name..."
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary text-sm" disabled={!newFieldName.trim()}>
              + Add
            </button>
          </form>
        </div>

        {/* Search + count */}
        <div className="px-6 pt-2 pb-2">
          {fields.length > 5 && (
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter fields..."
              className="input-field w-full mb-2"
            />
          )}
          <p className="text-xs text-surface-500">{fields.length} field{fields.length !== 1 ? 's' : ''} defined</p>
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {filtered.length === 0 && fields.length > 0 && (
            <p className="text-surface-500 text-sm py-4 text-center">No matching fields</p>
          )}
          {filtered.length === 0 && fields.length === 0 && (
            <p className="text-surface-500 text-sm py-4 text-center">No custom fields yet. Add one above.</p>
          )}
          {filtered.map(field => (
            <div
              key={field.id}
              className={`flex items-center gap-2 py-2 border-b border-surface-800/50 group/row ${dragOverId === field.id ? 'border-t-2 border-t-accent-500' : ''}`}
              draggable={!editingId}
              onDragStart={() => handleDragStart(field.id)}
              onDragOver={e => handleDragOver(e, field.id)}
              onDrop={() => handleDrop(field.id)}
              onDragEnd={handleDragEnd}
            >
              {/* Drag handle */}
              <span className="text-surface-600 cursor-grab active:cursor-grabbing select-none" title="Drag to reorder">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                </svg>
              </span>

              {editingId === field.id ? (
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
                  <span className="text-sm text-surface-200 flex-1 truncate">{field.name}</span>
                  <span className="text-xs text-surface-500 tabular-nums shrink-0">{field.usage_count} used</span>

                  {/* Show on card toggle */}
                  <button
                    onClick={() => toggleShowOnCard(field)}
                    className={`shrink-0 p-1 rounded transition-colors ${field.show_on_card ? 'text-accent-400 hover:text-accent-300' : 'text-surface-600 hover:text-surface-400'}`}
                    title={field.show_on_card ? 'Shown on card back — click to hide' : 'Hidden from card back — click to show'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M7 6h10M7 18h10" />
                    </svg>
                  </button>

                  {confirmDeleteId === field.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => commitDelete(field.id)} className="btn-danger text-xs px-2 py-0.5">Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost text-xs px-2 py-0.5">No</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button onClick={() => startRename(field)} className="btn-ghost text-xs px-2 py-0.5" title="Rename">Rename</button>
                      <button onClick={() => { setConfirmDeleteId(field.id); setEditingId(null) }} className="btn-ghost text-xs px-2 py-0.5 hover:text-red-400" title="Delete">&times;</button>
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
