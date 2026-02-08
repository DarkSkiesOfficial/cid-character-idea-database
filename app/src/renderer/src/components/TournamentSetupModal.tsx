import { useState, useMemo, useEffect } from 'react'
import type { CharacterWithDetails, TournamentFormat, TournamentConfig, CharacterStatus } from '../../../shared/types'
import { getBracketInfo } from '../utils/bracketGenerator'

interface TagWithCount {
  id: number
  name: string
  category: string | null
  character_count: number
}

interface TournamentSetupModalProps {
  characters: CharacterWithDetails[]
  tags: TagWithCount[]
  statusNames: { waiting: string; active: string; archived: string }
  onClose: () => void
  onStart: (config: TournamentConfig) => void
}

type Scope = 'all' | 'status' | 'tag' | 'manual'
type Step = 1 | 2 | 3

function TournamentSetupModal({
  characters,
  tags,
  statusNames,
  onClose,
  onStart
}: TournamentSetupModalProps): JSX.Element {
  // Step 1: Name & Format
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('single')

  // Step 2: Character Selection
  const [scope, setScope] = useState<Scope>('all')
  const [statusFilter, setStatusFilter] = useState<CharacterStatus>('waiting')
  const [tagFilter, setTagFilter] = useState<number | null>(null)
  const [manualSelection, setManualSelection] = useState<Set<number>>(new Set())
  const [tagFilteredCharacters, setTagFilteredCharacters] = useState<CharacterWithDetails[]>([])

  // Fetch characters with specific tag when tag filter changes
  useEffect(() => {
    if (scope === 'tag' && tagFilter) {
      window.api.getAllCharacters({ tagFilter }).then(setTagFilteredCharacters)
    }
  }, [scope, tagFilter])

  // Step 3: Review
  const [shuffle, setShuffle] = useState(true)

  // Characters filtered by scope
  // Note: characters from App.tsx are summaries, not full CharacterWithDetails
  const scopedCharacters = useMemo(() => {
    switch (scope) {
      case 'all':
        return characters
      case 'status':
        return characters.filter(c => c.status === statusFilter)
      case 'tag':
        // Use separately fetched tag-filtered characters
        return tagFilteredCharacters
      case 'manual':
        return characters.filter(c => manualSelection.has(c.id))
    }
  }, [characters, scope, statusFilter, tagFilter, manualSelection, tagFilteredCharacters])

  // Bracket info preview
  const bracketInfo = useMemo(() => {
    if (scopedCharacters.length < 2) return null
    return getBracketInfo(scopedCharacters.length)
  }, [scopedCharacters.length])

  const handleManualToggle = (id: number) => {
    setManualSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setManualSelection(new Set(characters.map(c => c.id)))
  }

  const handleSelectNone = () => {
    setManualSelection(new Set())
  }

  const handleStart = () => {
    onStart({
      name: name || 'Tournament',
      format,
      characters: scopedCharacters,
      shuffle
    })
  }

  const canProceedStep1 = true // Name is optional
  const canProceedStep2 = scopedCharacters.length >= 2
  const canStart = scopedCharacters.length >= 2

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[800px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-surface-100">Tournament Setup</h2>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${s <= step ? 'bg-accent-500' : 'bg-surface-700'}`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-surface-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Name & Format */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-2">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Best Girl 2026"
                  className="input-field w-full"
                  autoFocus
                />
                <p className="text-xs text-surface-600 mt-1">Optional. Defaults to "Tournament" if left blank.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-3">
                  Format
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormat('single')}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      format === 'single'
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <div className="font-semibold text-surface-100 mb-1">Single Elimination</div>
                    <div className="text-sm text-surface-400">
                      One loss and you're out. Quick and decisive.
                    </div>
                  </button>
                  <button
                    onClick={() => setFormat('double')}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      format === 'double'
                        ? 'border-accent-500 bg-accent-500/10'
                        : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <div className="font-semibold text-surface-100 mb-1">Double Elimination</div>
                    <div className="text-sm text-surface-400">
                      Losers get a second chance. More matches, fairer results.
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Character Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-3">
                  Character Selection
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setScope('all')}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      scope === 'all'
                        ? 'bg-accent-600 text-white'
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                    }`}
                  >
                    All Characters
                  </button>
                  <button
                    onClick={() => setScope('status')}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      scope === 'status'
                        ? 'bg-accent-600 text-white'
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                    }`}
                  >
                    By Status
                  </button>
                  <button
                    onClick={() => setScope('tag')}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      scope === 'tag'
                        ? 'bg-accent-600 text-white'
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                    }`}
                  >
                    By Tag
                  </button>
                  <button
                    onClick={() => setScope('manual')}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      scope === 'manual'
                        ? 'bg-accent-600 text-white'
                        : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                    }`}
                  >
                    Manual Pick
                  </button>
                </div>
              </div>

              {/* Status filter dropdown */}
              {scope === 'status' && (
                <div>
                  <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as CharacterStatus)}
                    className="select-field w-full"
                  >
                    <option value="waiting">{statusNames.waiting}</option>
                    <option value="active">{statusNames.active}</option>
                    <option value="archived">{statusNames.archived}</option>
                  </select>
                </div>
              )}

              {/* Tag filter dropdown */}
              {scope === 'tag' && (
                <div>
                  <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider block mb-2">
                    Tag
                  </label>
                  <select
                    value={tagFilter ?? ''}
                    onChange={e => setTagFilter(e.target.value ? Number(e.target.value) : null)}
                    className="select-field w-full"
                  >
                    <option value="">Select a tag...</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.character_count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual selection grid */}
              {scope === 'manual' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-surface-400">
                      {manualSelection.size} selected
                    </span>
                    <div className="flex gap-2">
                      <button onClick={handleSelectAll} className="btn-ghost text-xs">
                        Select All
                      </button>
                      <button onClick={handleSelectNone} className="btn-ghost text-xs">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {characters.map(c => {
                      const isSelected = manualSelection.has(c.id)
                      // Handle both full CharacterWithDetails and summaries
                      const imagePath = (c as any).image_paths?.[0] || (c.cover_image?.file_path) || (c.images?.[0]?.file_path)
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleManualToggle(c.id)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                            isSelected
                              ? 'border-accent-500'
                              : 'border-transparent hover:border-surface-600'
                          }`}
                        >
                          <div className="aspect-[2/3] bg-surface-800">
                            {imagePath ? (
                              <img
                                src={`local-file://${encodeURIComponent(imagePath)}`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl text-surface-600">
                                {c.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <div className="text-xs text-white truncate">
                              {c.name || <span className="italic text-surface-400">Unnamed</span>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Character count preview */}
              <div className={`p-4 rounded-lg ${scopedCharacters.length >= 2 ? 'bg-surface-800' : 'bg-red-900/20 border border-red-800'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-300">Characters selected</span>
                  <span className={`text-lg font-semibold ${scopedCharacters.length >= 2 ? 'text-surface-100' : 'text-red-400'}`}>
                    {scopedCharacters.length}
                  </span>
                </div>
                {scopedCharacters.length < 2 && (
                  <p className="text-xs text-red-400 mt-2">Need at least 2 characters to run a tournament.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-surface-800 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-surface-400">Name</span>
                  <span className="text-surface-100 font-medium">{name || 'Tournament'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Format</span>
                  <span className="text-surface-100 font-medium">
                    {format === 'single' ? 'Single Elimination' : 'Double Elimination'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Characters</span>
                  <span className="text-surface-100 font-medium">{scopedCharacters.length}</span>
                </div>
                {bracketInfo && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Bracket Size</span>
                      <span className="text-surface-100 font-medium">{bracketInfo.bracketSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Rounds</span>
                      <span className="text-surface-100 font-medium">
                        {bracketInfo.rounds}
                        {format === 'double' && ` winners + ${(bracketInfo.rounds - 1) * 2} losers + grand final`}
                      </span>
                    </div>
                    {bracketInfo.byes > 0 && (
                      <div className="flex justify-between">
                        <span className="text-surface-400">Byes</span>
                        <span className="text-yellow-400 font-medium">{bracketInfo.byes} (auto-advance)</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-800 rounded-lg">
                <div>
                  <div className="font-medium text-surface-100">Shuffle Seeding</div>
                  <div className="text-sm text-surface-400">Randomize initial bracket positions</div>
                </div>
                <button
                  onClick={() => setShuffle(!shuffle)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    shuffle ? 'bg-accent-500' : 'bg-surface-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      shuffle ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Character preview grid */}
              <div>
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Participants
                </div>
                <div className="grid grid-cols-8 gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {scopedCharacters.map(c => {
                    // Handle both full CharacterWithDetails (has images array) and summaries (has image_paths)
                    const imagePath = (c as any).image_paths?.[0] || (c.cover_image?.file_path) || (c.images?.[0]?.file_path)
                    return (
                      <div key={c.id} className="aspect-[2/3] bg-surface-800 rounded overflow-hidden">
                        {imagePath ? (
                          <img
                            src={`local-file://${encodeURIComponent(imagePath)}`}
                            alt={c.name || ''}
                            className="w-full h-full object-cover"
                            title={c.name || 'Unnamed'}
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-lg text-surface-600"
                            title={c.name || 'Unnamed'}
                          >
                            {c.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-800 flex justify-between shrink-0">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="btn-ghost"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep((step + 1) as Step)}
                disabled={step === 2 && !canProceedStep2}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Tournament
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TournamentSetupModal
