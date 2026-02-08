import { useState, useEffect, useRef } from 'react'
import type { ParsedSeed } from '../../../shared/types'
import TextToolbar from './TextToolbar'
import DuplicateWarning from './DuplicateWarning'
import type { DuplicateMatch } from './DuplicateWarning'

interface ImportModalProps {
  onClose: () => void
  onDone: () => void
}

type EntryAction = 'accept' | 'skip'

interface ReviewEntry extends ParsedSeed {
  action: EntryAction
  editedName: string | null
  editedText: string
}

function ImportModal({ onClose, onDone }: ImportModalProps): JSX.Element {
  const [step, setStep] = useState<'pick' | 'review' | 'importing' | 'done'>('pick')
  const [entries, setEntries] = useState<ReviewEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [editingText, setEditingText] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const importTextRef = useRef<HTMLTextAreaElement>(null)

  // Check for duplicates when viewing an entry
  useEffect(() => {
    setDupDismissed(false)
    const current = entries[currentIndex]
    if (!current || current.editedText.trim().length < 30) {
      setDuplicates([])
      return
    }

    let cancelled = false
    window.api.checkDuplicates(current.editedText).then((matches) => {
      if (!cancelled) setDuplicates(matches)
    })
    return () => { cancelled = true }
  }, [currentIndex, entries])

  const handlePickFile = async () => {
    const parsed = await window.api.parseImportFile()
    if (!parsed || parsed.length === 0) return

    setEntries(parsed.map((p: ParsedSeed) => ({
      ...p,
      action: 'accept' as EntryAction,
      editedName: null,
      editedText: p.raw_text
    })))
    setStep('review')
  }

  const updateEntry = (index: number, updates: Partial<ReviewEntry>) => {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, ...updates } : e))
  }

  const handleMergeWithNext = () => {
    if (currentIndex >= entries.length - 1) return

    setEntries((prev) => {
      const updated = [...prev]
      const current = updated[currentIndex]
      const next = updated[currentIndex + 1]

      // Merge: combine text with a separator, keep current's name if it has one
      updated[currentIndex] = {
        ...current,
        editedText: current.editedText + '\n\n---\n\n' + next.editedText,
        raw_text: current.raw_text + '\n\n---\n\n' + next.raw_text,
        editedName: current.editedName || next.editedName,
        flagged: false,
        flag_reason: null
      }

      // Remove the next entry
      updated.splice(currentIndex + 1, 1)
      return updated
    })
  }

  const handleCommit = async () => {
    setStep('importing')
    const toImport = entries
      .filter((e) => e.action === 'accept')
      .map((e) => ({
        raw_text: e.editedText,
        name: e.editedName || null
      }))

    await window.api.commitImport(toImport)
    setImportedCount(toImport.length)
    setStep('done')
  }

  const accepted = entries.filter((e) => e.action === 'accept').length
  const skipped = entries.filter((e) => e.action === 'skip').length
  const current = entries[currentIndex]

  // When navigating away from an entry, exit edit mode
  const navigateTo = (index: number) => {
    setEditingText(false)
    setCurrentIndex(index)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-surface-100">Import Seed File</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'pick' && (
            <div className="text-center py-12">
              <p className="text-surface-400 mb-6">
                Select a text file containing character seed ideas separated by <code className="bg-surface-800 px-1.5 py-0.5 rounded text-surface-300">---</code> lines.
              </p>
              <button onClick={handlePickFile} className="btn-primary px-6">
                Choose File
              </button>
            </div>
          )}

          {step === 'review' && current && (
            <div>
              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-surface-800 rounded-full h-2">
                  <div className="bg-accent-500 h-2 rounded-full transition-all"
                    style={{ width: `${((currentIndex + 1) / entries.length) * 100}%` }} />
                </div>
                <span className="text-sm text-surface-400 shrink-0">
                  {currentIndex + 1} / {entries.length}
                </span>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mb-4 text-sm">
                <span className="text-green-400">{accepted} accepted</span>
                <span className="text-surface-500">{skipped} skipped</span>
              </div>

              {/* Flag warning */}
              {current.flagged && (
                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 mb-4 text-sm text-yellow-300">
                  {current.flag_reason}
                </div>
              )}

              {/* Duplicate warning */}
              {duplicates.length > 0 && !dupDismissed && (
                <DuplicateWarning
                  matches={duplicates}
                  onDismiss={() => setDupDismissed(true)}
                  onViewExisting={() => setDupDismissed(true)}
                />
              )}

              {/* Name field */}
              <div className="mb-3">
                <label className="text-xs text-surface-500 block mb-1">Name</label>
                <input
                  value={current.editedName || ''}
                  onChange={(e) => updateEntry(currentIndex, { editedName: e.target.value || null })}
                  placeholder={current.detected_name ? `Detected: "${current.detected_name}" — type to use it or leave blank` : 'No name detected — type one if you want'}
                  className="w-full input-field"
                />
              </div>

              {/* Seed text — view or edit */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-surface-500">Seed Text</label>
                  <button
                    onClick={() => setEditingText(!editingText)}
                    className="text-xs text-accent-400 hover:text-accent-300">
                    {editingText ? 'Done editing' : 'Edit'}
                  </button>
                </div>
                {editingText ? (
                  <>
                    <TextToolbar
                      textareaRef={importTextRef}
                      value={current.editedText}
                      onChange={(val) => updateEntry(currentIndex, { editedText: val })}
                    />
                    <textarea
                      ref={importTextRef}
                      value={current.editedText}
                      onChange={(e) => updateEntry(currentIndex, { editedText: e.target.value })}
                      className="w-full input-field font-mono leading-relaxed max-h-[40vh] min-h-[200px] resize-y"
                    />
                  </>
                ) : (
                  <div className="bg-surface-950 rounded-lg px-4 py-3 text-sm text-surface-300 whitespace-pre-wrap
                                  font-mono leading-relaxed max-h-[40vh] overflow-y-auto">
                    {current.editedText}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      updateEntry(currentIndex, { action: 'accept' })
                      navigateTo(Math.min(currentIndex + 1, entries.length - 1))
                    }}
                    className={current.action === 'accept'
                      ? 'btn-primary bg-green-600 hover:bg-green-500'
                      : 'btn-primary bg-green-700 hover:bg-green-600'
                    }>
                    Accept
                  </button>
                  <button
                    onClick={() => {
                      updateEntry(currentIndex, { action: 'skip' })
                      navigateTo(Math.min(currentIndex + 1, entries.length - 1))
                    }}
                    className={current.action === 'skip'
                      ? 'btn-secondary bg-surface-600'
                      : 'btn-secondary'
                    }>
                    Skip
                  </button>
                  {currentIndex < entries.length - 1 && (
                    <button
                      onClick={handleMergeWithNext}
                      className="btn-secondary bg-amber-800 hover:bg-amber-700 text-amber-100"
                      title="Merge this entry with the next one (for ideas that got split by internal --- lines)">
                      Merge with next
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigateTo(Math.max(currentIndex - 1, 0))}
                    disabled={currentIndex === 0}
                    className="btn-toolbar disabled:opacity-30">
                    &larr; Prev
                  </button>
                  <button
                    onClick={() => navigateTo(Math.min(currentIndex + 1, entries.length - 1))}
                    disabled={currentIndex === entries.length - 1}
                    className="btn-toolbar disabled:opacity-30">
                    Next &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <p className="text-surface-300 text-lg">Importing characters...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-12">
              <p className="text-green-400 text-lg mb-2">Imported {importedCount} characters</p>
              <p className="text-surface-500 text-sm mb-6">They've been added to your library and folders created on disk.</p>
              <button onClick={onDone} className="btn-primary px-6">
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer — commit button */}
        {step === 'review' && (
          <div className="px-6 py-4 border-t border-surface-800 flex justify-end shrink-0">
            <button onClick={handleCommit}
              disabled={accepted === 0}
              className="btn-primary px-6 disabled:bg-surface-700 disabled:text-surface-500">
              Import {accepted} Characters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImportModal
