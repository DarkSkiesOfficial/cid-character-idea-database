import { useState, useRef, useCallback, useEffect } from 'react'
import TextToolbar from './TextToolbar'
import DuplicateWarning from './DuplicateWarning'
import type { DuplicateMatch } from './DuplicateWarning'
import ImageDuplicateModal from './ImageDuplicateModal'
import type { DuplicateMatch as ImageDupeMatch } from './ImageDuplicateModal'

interface AddCharacterModalProps {
  onClose: () => void
  onDone: () => void
}

interface PendingImageDupeCheck {
  sourcePath: string
  matches: ImageDupeMatch[]
  remainingPaths: string[]
}

function AddCharacterModal({ onClose, onDone }: AddCharacterModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [seedText, setSeedText] = useState('')
  const [imagePrompts, setImagePrompts] = useState('')
  const [priority, setPriority] = useState(3)
  const [groupNames, setGroupNames] = useState<string[]>([])
  const [newGroupInput, setNewGroupInput] = useState('')
  const [addedCount, setAddedCount] = useState(0)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [deleteSource, setDeleteSource] = useState(
    () => localStorage.getItem('deleteSourceOnImport') === 'true'
  )
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [imageDupeCheck, setImageDupeCheck] = useState<PendingImageDupeCheck | null>(null)
  const seedRef = useRef<HTMLTextAreaElement>(null)
  const imagePromptsRef = useRef<HTMLTextAreaElement>(null)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced duplicate check when seed text changes
  useEffect(() => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current)
    setDupDismissed(false)

    if (seedText.trim().length < 30) {
      setDuplicates([])
      return
    }

    dupTimerRef.current = setTimeout(async () => {
      const matches = await window.api.checkDuplicates(seedText)
      setDuplicates(matches)
    }, 500)

    return () => {
      if (dupTimerRef.current) clearTimeout(dupTimerRef.current)
    }
  }, [seedText])

  const clearForm = () => {
    setName('')
    setSeedText('')
    setImagePrompts('')
    setPriority(3)
    setGroupNames([])
    setNewGroupInput('')
    setPendingImages([])
    setDuplicates([])
    setDupDismissed(false)
    setTimeout(() => seedRef.current?.focus(), 50)
  }

  const handleAddAndContinue = async () => {
    if (!seedText.trim()) return

    const created = await window.api.createCharacter({
      name: name || null,
      seed_text: seedText,
      image_prompts: imagePrompts || null,
      priority,
      group_names: groupNames
    })

    // Attach any pending images
    if (created && pendingImages.length > 0) {
      const deleteSource = localStorage.getItem('deleteSourceOnImport') === 'true'
      for (const imgPath of pendingImages) {
        await window.api.addImage(created.id, imgPath, { deleteSource })
      }
    }

    setAddedCount((c) => c + 1)
    setLastAdded(name || 'Unnamed character')
    clearForm()
  }

  const handleAddAndClose = async () => {
    if (seedText.trim()) {
      const created = await window.api.createCharacter({
        name: name || null,
        seed_text: seedText,
        image_prompts: imagePrompts || null,
        priority,
        group_names: groupNames
      })

      if (created && pendingImages.length > 0) {
        const deleteSource = localStorage.getItem('deleteSourceOnImport') === 'true'
        for (const imgPath of pendingImages) {
          await window.api.addImage(created.id, imgPath, { deleteSource })
        }
      }
    }
    onDone()
  }

  const handleClose = () => {
    if (addedCount > 0) {
      onDone()
    } else {
      onClose()
    }
  }

  // Process image paths with dupe checking before adding to pending list
  const processImagePaths = async (paths: string[]) => {
    for (let i = 0; i < paths.length; i++) {
      const sourcePath = paths[i]
      const matches: ImageDupeMatch[] = await window.api.checkImageDuplicates(sourcePath)

      if (matches.length > 0) {
        setImageDupeCheck({
          sourcePath,
          matches,
          remainingPaths: paths.slice(i + 1)
        })
        return
      }

      setPendingImages((prev) => [...prev, sourcePath])
    }
  }

  const handleImageDupeKeepBoth = async () => {
    if (!imageDupeCheck) return
    setPendingImages((prev) => [...prev, imageDupeCheck.sourcePath])
    const remaining = imageDupeCheck.remainingPaths
    setImageDupeCheck(null)
    if (remaining.length > 0) {
      await processImagePaths(remaining)
    }
  }

  const handleImageDupeSkip = async () => {
    if (!imageDupeCheck) return
    const remaining = imageDupeCheck.remainingPaths
    setImageDupeCheck(null)
    if (remaining.length > 0) {
      await processImagePaths(remaining)
    }
  }

  const handlePickImages = async () => {
    const paths = await window.api.pickImages()
    if (paths.length > 0) {
      await processImagePaths(paths)
    }
  }

  const handleRemovePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddGroup = () => {
    const trimmed = newGroupInput.trim()
    if (trimmed && !groupNames.includes(trimmed)) {
      setGroupNames((prev) => [...prev, trimmed])
      setNewGroupInput('')
    }
  }

  const handleRemoveGroup = (index: number) => {
    setGroupNames((prev) => prev.filter((_, i) => i !== index))
  }

  // Drag and drop
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
      await processImagePaths(paths)
    }
  }, [])

  const handleViewExisting = (id: number) => {
    // Close modal and navigate to the existing character
    // For now just dismiss — full navigation would need app-level routing
    setDupDismissed(true)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 bg-accent-600/20 border-4 border-dashed border-accent-500 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-surface-900 rounded-xl px-8 py-6 text-center shadow-2xl">
            <p className="text-xl text-accent-400 font-semibold">Drop images here</p>
            <p className="text-sm text-surface-400 mt-1">PNG, JPG, GIF, WebP</p>
          </div>
        </div>
      )}

      {/* Image duplicate modal */}
      {imageDupeCheck && (
        <ImageDuplicateModal
          sourcePath={imageDupeCheck.sourcePath}
          matches={imageDupeCheck.matches}
          onKeepBoth={handleImageDupeKeepBoth}
          onSkip={handleImageDupeSkip}
          onReplace={handleImageDupeSkip}
        />
      )}

      <div className="bg-surface-900 rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col border border-surface-700">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-surface-100">New Character</h2>
            {addedCount > 0 && (
              <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                {addedCount} added
              </span>
            )}
          </div>
          <button onClick={handleClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        {lastAdded && (
          <div className="px-6 py-2 bg-green-900/20 border-b border-green-900/30 text-sm text-green-400">
            Added "{lastAdded}" — ready for the next one.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Duplicate warning */}
          {duplicates.length > 0 && !dupDismissed && (
            <DuplicateWarning
              matches={duplicates}
              onDismiss={() => setDupDismissed(true)}
              onViewExisting={handleViewExisting}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full input-field"
                placeholder="Optional..." />
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full select-field">
                <option value={5}>5 - Must do</option>
                <option value={4}>4 - High</option>
                <option value={3}>3 - Normal</option>
                <option value={2}>2 - Low</option>
                <option value={1}>1 - Someday</option>
              </select>
            </div>
          </div>

          {/* Groups */}
          <div>
            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Groups</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {groupNames.map((gn, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-accent-900/30 text-accent-300 text-xs px-2 py-0.5 rounded-full border border-accent-800/50">
                  {gn}
                  <button type="button" onClick={() => handleRemoveGroup(i)}
                    className="text-accent-600 hover:text-red-400">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newGroupInput} onChange={(e) => setNewGroupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddGroup()
                  }
                }}
                className="flex-1 input-field"
                placeholder="Type group name, press Enter..." />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">
              Seed Text <span className="text-red-400">*</span>
            </label>
            <TextToolbar textareaRef={seedRef} value={seedText} onChange={setSeedText} />
            <textarea ref={seedRef} value={seedText} onChange={(e) => setSeedText(e.target.value)}
              rows={8}
              className="w-full bg-surface-800 text-surface-100 rounded px-4 py-3 text-sm font-mono
                         focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y leading-relaxed"
              placeholder="Paste your character seed idea here..." />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-1">Image Prompts</label>
            <TextToolbar textareaRef={imagePromptsRef} value={imagePrompts} onChange={setImagePrompts} />
            <textarea ref={imagePromptsRef} value={imagePrompts} onChange={(e) => setImagePrompts(e.target.value)}
              rows={4}
              className="w-full bg-surface-800 text-surface-100 rounded px-4 py-3 text-sm font-mono
                         focus:outline-none focus:ring-1 focus:ring-accent-500 resize-y leading-relaxed"
              placeholder="Optional — paste image generation prompts..." />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Images</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer group" title="Source files will be permanently removed after successful copy">
                  <input
                    type="checkbox"
                    checked={deleteSource}
                    onChange={() => {
                      setDeleteSource((prev) => {
                        const next = !prev
                        localStorage.setItem('deleteSourceOnImport', String(next))
                        return next
                      })
                    }}
                    className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className={`text-xs transition-colors ${deleteSource ? 'text-red-400' : 'text-surface-500 group-hover:text-surface-400'}`}>
                    Delete originals on import
                  </span>
                </label>
                <button type="button" onClick={handlePickImages} className="btn-ghost">
                  + Browse files
                </button>
              </div>
            </div>
            {pendingImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {pendingImages.map((imgPath, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden bg-surface-800">
                    <img
                      src={`local-file://${encodeURIComponent(imgPath)}`}
                      alt=""
                      className="w-full aspect-[2/3] object-cover"
                    />
                    <button
                      onClick={() => handleRemovePendingImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs
                                 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-surface-700 rounded-lg p-4 text-center text-surface-600 text-xs">
                Drag and drop images here, or click "Browse files" above.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-surface-800">
            <button type="button" onClick={handleClose} className="btn-secondary">
              {addedCount > 0 ? 'Done' : 'Cancel'}
            </button>
            <button type="button" onClick={handleAddAndContinue} disabled={!seedText.trim()}
              className="btn-secondary disabled:opacity-50">
              Add & Next
            </button>
            <button type="button" onClick={handleAddAndClose} disabled={!seedText.trim()}
              className="btn-primary px-6 disabled:opacity-50">
              Add & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddCharacterModal
