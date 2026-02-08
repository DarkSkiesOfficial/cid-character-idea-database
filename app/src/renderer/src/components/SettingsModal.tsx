import { useState, useEffect } from 'react'

interface SettingsModalProps {
  onClose: () => void
  onSettingsChanged: () => void
}

interface SettingEntry {
  key: string
  value: string
}

function SettingsModal({ onClose, onSettingsChanged }: SettingsModalProps): JSX.Element {
  const [waitingLabel, setWaitingLabel] = useState('Waiting')
  const [activeLabel, setActiveLabel] = useState('Active')
  const [archivedLabel, setArchivedLabel] = useState('Archived')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hideArchivedDefault, setHideArchivedDefault] = useState(true)
  const [reindexing, setReindexing] = useState(false)
  const [reindexResult, setReindexResult] = useState<string | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      const settings: SettingEntry[] = await window.api.getSettings()
      for (const s of settings) {
        if (s.key === 'status_display_waiting') setWaitingLabel(s.value)
        if (s.key === 'status_display_active') setActiveLabel(s.value)
        if (s.key === 'status_display_archived') setArchivedLabel(s.value)
        if (s.key === 'hide_archived_default') setHideArchivedDefault(s.value !== 'false')
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await window.api.setSetting('status_display_waiting', waitingLabel.trim() || 'Waiting')
    await window.api.setSetting('status_display_active', activeLabel.trim() || 'Active')
    await window.api.setSetting('status_display_archived', archivedLabel.trim() || 'Archived')
    await window.api.setSetting('hide_archived_default', String(hideArchivedDefault))
    setSaving(false)
    setSaved(true)
    onSettingsChanged()
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[480px] max-h-[85vh] flex flex-col border border-surface-700">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Settings</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Display Names */}
          <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Status Display Names</h3>
            <p className="text-xs text-surface-600 mb-4">Customize how status labels appear throughout the app.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-yellow-400 w-20 shrink-0">waiting</span>
                <input
                  value={waitingLabel}
                  onChange={(e) => setWaitingLabel(e.target.value)}
                  className="flex-1 input-field"
                  placeholder="Waiting"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400 w-20 shrink-0">active</span>
                <input
                  value={activeLabel}
                  onChange={(e) => setActiveLabel(e.target.value)}
                  className="flex-1 input-field"
                  placeholder="Active"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-500 w-20 shrink-0">archived</span>
                <input
                  value={archivedLabel}
                  onChange={(e) => setArchivedLabel(e.target.value)}
                  className="flex-1 input-field"
                  placeholder="Archived"
                />
              </div>
            </div>
          </div>

          {/* Archive Behavior */}
          <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Archive Behavior</h3>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hideArchivedDefault}
                onChange={(e) => setHideArchivedDefault(e.target.checked)}
                className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-accent-500 focus:ring-accent-500 cursor-pointer"
              />
              <span className="text-sm text-surface-300">Hide archived characters from default views</span>
            </label>
            <p className="text-xs text-surface-600 mt-1.5 ml-7">
              Archived characters can always be found by clicking the archived status filter in the sidebar.
            </p>
          </div>

          {/* Image Indexing */}
          <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Image Indexing</h3>
            <p className="text-xs text-surface-600 mb-3">Compute hashes for existing images to enable duplicate detection.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setReindexing(true)
                  setReindexResult(null)
                  const result = await window.api.reindexImageHashes()
                  setReindexing(false)
                  setReindexResult(`Indexed ${result.indexed} of ${result.total} images`)
                  setTimeout(() => setReindexResult(null), 3000)
                }}
                disabled={reindexing}
                className="btn-secondary disabled:opacity-50"
              >
                {reindexing ? 'Indexing...' : 'Reindex Images'}
              </button>
              {reindexResult && (
                <span className="text-xs text-green-400">{reindexResult}</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-surface-800 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className={saved ? 'btn-primary bg-green-600 hover:bg-green-500' : 'btn-primary'}>
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
