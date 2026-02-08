import { useState } from 'react'
import type { ImportPreview, LibraryEntry } from '../../../shared/types'

type Tab = 'export' | 'import'

interface ExportImportModalProps {
  activeLibrary: LibraryEntry | null
  stats: { total: number; withImages: number } | null
  onClose: () => void
  onLibraryImported: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function ExportImportModal({
  activeLibrary,
  stats,
  onClose,
  onLibraryImported
}: ExportImportModalProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('export')

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ path: string; characterCount: number; imageCount: number } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Import state
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importName, setImportName] = useState('')
  const [confirmMerge, setConfirmMerge] = useState(false)

  // Character import state
  const [importingChar, setImportingChar] = useState(false)
  const [charImportResult, setCharImportResult] = useState<string | null>(null)

  const handleExportLibrary = async () => {
    setExporting(true)
    setExportResult(null)
    setExportError(null)
    try {
      const result = await window.api.exportLibrary()
      if (result.canceled) {
        setExporting(false)
        return
      }
      if (result.error) {
        setExportError(result.error)
      } else {
        setExportResult(result)
      }
    } catch (err) {
      setExportError((err as Error).message)
    }
    setExporting(false)
  }

  const handleSelectArchive = async () => {
    setPreview(null)
    setImportError(null)
    setImportResult(null)
    setConfirmMerge(false)

    const result = await window.api.importLibraryPreview()
    if (result.canceled) return

    if (!result.valid) {
      setImportError(result.error || 'Invalid archive')
      return
    }

    setPreview(result as ImportPreview)
    setImportName(result.metadata?.libraryName || 'Imported Library')
  }

  const handleImportAsNew = async () => {
    if (!preview) return
    setImporting(true)
    setImportError(null)

    try {
      const result = await window.api.importLibraryAsNew({
        zipPath: preview.zipPath,
        libraryName: importName.trim() || 'Imported Library'
      })
      if (result.error) {
        setImportError(result.error)
      } else {
        setImportResult(`Imported "${result.libraryName}" with ${result.characterCount} characters. Switch to it from the library dropdown.`)
        setPreview(null)
        onLibraryImported()
      }
    } catch (err) {
      setImportError((err as Error).message)
    }
    setImporting(false)
  }

  const handleMergeIntoCurrent = async () => {
    if (!preview) return
    setImporting(true)
    setImportError(null)
    setConfirmMerge(false)

    try {
      const result = await window.api.importLibraryMerge({ zipPath: preview.zipPath })
      if (result.error) {
        setImportError(result.error)
      } else {
        setImportResult(`Merged ${result.importedCount} characters into current library.`)
        setPreview(null)
        onLibraryImported()
      }
    } catch (err) {
      setImportError((err as Error).message)
    }
    setImporting(false)
  }

  const handleImportCharacter = async () => {
    setImportingChar(true)
    setCharImportResult(null)
    try {
      const result = await window.api.importCharacter()
      if (result.canceled) {
        setImportingChar(false)
        return
      }
      if (result.error) {
        setCharImportResult(`Error: ${result.error}`)
      } else {
        setCharImportResult(`Imported "${result.characterName}" successfully.`)
        onLibraryImported()
      }
    } catch (err) {
      setCharImportResult(`Error: ${(err as Error).message}`)
    }
    setImportingChar(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-surface-100">Export & Import</h2>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-surface-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-700">
          <button
            onClick={() => setTab('export')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'export'
                ? 'text-accent-400 border-b-2 border-accent-500'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            Export
          </button>
          <button
            onClick={() => setTab('import')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === 'import'
                ? 'text-accent-400 border-b-2 border-accent-500'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            Import
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'export' && (
            <>
              {/* Library info */}
              <div className="bg-surface-800 rounded-lg p-4 border border-surface-700">
                <div className="text-sm text-surface-400 mb-1">Active Library</div>
                <div className="text-surface-100 font-medium">
                  {activeLibrary?.icon} {activeLibrary?.name || 'Default'}
                </div>
                {stats && (
                  <div className="text-xs text-surface-500 mt-1">
                    {stats.total} characters, {stats.withImages} with images
                  </div>
                )}
              </div>

              <p className="text-sm text-surface-400">
                Export the entire library as a zip archive containing the database and all character folders. Use this for backups or sharing.
              </p>

              <button
                onClick={handleExportLibrary}
                disabled={exporting}
                className="btn-primary w-full py-2.5"
              >
                {exporting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Exporting...
                  </span>
                ) : 'Export Full Library'}
              </button>

              {exportResult && (
                <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-sm text-green-300">
                  Exported {exportResult.characterCount} characters and {exportResult.imageCount} images.
                  <div className="text-xs text-green-400/70 mt-1 break-all">{exportResult.path}</div>
                </div>
              )}

              {exportError && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                  {exportError}
                </div>
              )}
            </>
          )}

          {tab === 'import' && (
            <>
              <p className="text-sm text-surface-400">
                Import a previously exported library archive, or a single character export.
              </p>

              {/* Library import */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-surface-200">Library Archive</h3>

                <button
                  onClick={handleSelectArchive}
                  disabled={importing}
                  className="btn-secondary w-full py-2"
                >
                  Select Library Archive...
                </button>

                {importError && !preview && (
                  <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                    {importError}
                  </div>
                )}

                {preview && (
                  <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-surface-100 font-medium">{preview.metadata.libraryName}</div>
                        <div className="text-xs text-surface-500 mt-0.5">
                          {preview.metadata.characterCount} characters, {preview.metadata.imageCount} images
                        </div>
                        <div className="text-xs text-surface-500">
                          Exported {new Date(preview.metadata.exportDate).toLocaleDateString()} &middot; {formatBytes(preview.totalSize)}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-700 text-surface-400">
                        v{preview.metadata.schemaVersion}
                      </span>
                    </div>

                    {preview.characterNames.length > 0 && (
                      <div className="text-xs text-surface-500">
                        <span className="text-surface-400">Characters: </span>
                        {preview.characterNames.slice(0, 8).join(', ')}
                        {preview.metadata.characterCount > 8 && ` and ${preview.metadata.characterCount - 8} more`}
                      </div>
                    )}

                    {/* Import as New Library */}
                    <div className="space-y-2 pt-2 border-t border-surface-700">
                      <label className="text-xs text-surface-400">Library name</label>
                      <input
                        type="text"
                        value={importName}
                        onChange={e => setImportName(e.target.value)}
                        className="input-field w-full text-sm"
                        placeholder="Library name"
                      />
                      <button
                        onClick={handleImportAsNew}
                        disabled={importing || !importName.trim()}
                        className="btn-primary w-full py-2 text-sm"
                      >
                        {importing ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Importing...
                          </span>
                        ) : 'Import as New Library'}
                      </button>
                    </div>

                    {/* Merge into Current */}
                    <div className="pt-2 border-t border-surface-700">
                      {!confirmMerge ? (
                        <button
                          onClick={() => setConfirmMerge(true)}
                          disabled={importing}
                          className="btn-ghost w-full py-2 text-sm text-surface-400 hover:text-surface-200"
                        >
                          Merge into Current Library
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-400">
                            This will add all {preview.metadata.characterCount} characters to your current library.
                            Duplicate names will not be skipped. This cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmMerge(false)}
                              className="btn-ghost flex-1 py-1.5 text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleMergeIntoCurrent}
                              disabled={importing}
                              className="btn-danger flex-1 py-1.5 text-sm"
                            >
                              {importing ? 'Merging...' : 'Confirm Merge'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {importError && (
                      <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                        {importError}
                      </div>
                    )}
                  </div>
                )}

                {importResult && (
                  <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 text-sm text-green-300">
                    {importResult}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-surface-700 pt-3">
                <h3 className="text-sm font-medium text-surface-200 mb-2">Single Character</h3>
                <button
                  onClick={handleImportCharacter}
                  disabled={importingChar}
                  className="btn-secondary w-full py-2 text-sm"
                >
                  {importingChar ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Importing...
                    </span>
                  ) : 'Import Character from Archive...'}
                </button>

                {charImportResult && (
                  <div className={`mt-2 rounded-lg p-3 text-sm ${
                    charImportResult.startsWith('Error')
                      ? 'bg-red-900/30 border border-red-700/50 text-red-300'
                      : 'bg-green-900/30 border border-green-700/50 text-green-300'
                  }`}>
                    {charImportResult}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-700 flex justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-1.5 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
