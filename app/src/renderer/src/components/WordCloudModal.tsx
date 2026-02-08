import { useState, useEffect, useRef } from 'react'
import type { CloudTag, WordFrequency } from '../../../shared/types'

type Tab = 'discover' | 'accepted' | 'hidden'

interface WordCloudModalProps {
  onClose: () => void
  onChanged: () => void
}

export default function WordCloudModal({ onClose, onChanged }: WordCloudModalProps) {
  const [words, setWords] = useState<WordFrequency[]>([])
  const [cloudTags, setCloudTags] = useState<CloudTag[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('discover')
  const [search, setSearch] = useState('')
  const [minCount, setMinCount] = useState(2)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [combineMode, setCombineMode] = useState<string | null>(null)
  const [phraseInput, setPhraseInput] = useState('')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFeedback = (msg: string) => {
    setActionFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setActionFeedback(null), 2500)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [wordData, tagData] = await Promise.all([
        window.api.extractCloudWords(),
        window.api.getAllCloudTags()
      ])
      setWords(wordData)
      setCloudTags(tagData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  // Keyboard: Escape closes modal or cancels combine mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (combineMode) {
          setCombineMode(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [combineMode, onClose])

  // Filter words for discover tab
  const filteredWords = words.filter((w) => {
    if (w.count < minCount) return false
    if (w.status === 'accepted') return false
    if (search && !w.word.includes(search.toLowerCase())) return false
    return true
  })

  // Accepted words from cloud_tags
  const acceptedTags = cloudTags.filter((ct) => ct.status === 'accepted')
  const hiddenTags = cloudTags.filter((ct) => ct.status === 'hidden')

  // Compute font size from frequency (log scale)
  const maxCount = filteredWords.length > 0 ? Math.max(...filteredWords.map((w) => w.count)) : 1
  const wordSize = (count: number): number => {
    const minSize = 0.8
    const maxSize = 2.2
    if (maxCount <= 1) return minSize
    const ratio = Math.log(count) / Math.log(maxCount)
    return minSize + ratio * (maxSize - minSize)
  }

  const handleAccept = async (word: string) => {
    const result = await window.api.acceptCloudWord(word)
    if (result.error) {
      showFeedback(result.error)
      return
    }
    showFeedback(`"${word}" accepted — tagged ${result.matchCount} characters`)
    setSelectedWord(null)
    await loadData()
    onChanged()
  }

  const handleHide = async (word: string) => {
    await window.api.hideCloudWord(word)
    showFeedback(`"${word}" hidden`)
    setSelectedWord(null)
    await loadData()
  }

  const handleUnhide = async (id: number) => {
    await window.api.unhideCloudWord(id)
    showFeedback('Word restored')
    await loadData()
  }

  const handleReset = async (id: number) => {
    await window.api.resetCloudWord(id)
    showFeedback('Word reset to pending')
    await loadData()
    onChanged()
  }

  const handleCombineStart = (word: string) => {
    setCombineMode(word)
    setSelectedWord(null)
  }

  const handleCombineTarget = async (targetWord: string) => {
    if (!combineMode || combineMode === targetWord) return
    await window.api.combineCloudWords(combineMode, targetWord)
    showFeedback(`"${combineMode}" merged into "${targetWord}"`)
    setCombineMode(null)
    await loadData()
    onChanged()
  }

  const handleAddPhrase = async () => {
    const trimmed = phraseInput.trim()
    if (!trimmed) return
    const result = await window.api.addCloudPhrase(trimmed)
    if (result.error) {
      showFeedback(result.error)
      return
    }
    showFeedback(`"${trimmed}" added — ${result.match_count} matches`)
    setPhraseInput('')
    await loadData()
  }

  const handleWordClick = (word: string) => {
    if (combineMode) {
      handleCombineTarget(word)
      return
    }
    setSelectedWord(selectedWord === word ? null : word)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-100">Tag Discovery</h2>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-surface-300 text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 pt-3 flex gap-1">
          {(['discover', 'accepted', 'hidden'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setSelectedWord(null)
                setCombineMode(null)
              }}
              className={`px-3 py-1.5 text-sm rounded-t-md cursor-pointer transition-colors ${
                tab === t
                  ? 'bg-surface-800 text-surface-100 border-b-2 border-accent-500'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`}
            >
              {t === 'discover' && `Discover${filteredWords.length > 0 ? ` (${filteredWords.length})` : ''}`}
              {t === 'accepted' && `Accepted (${acceptedTags.length})`}
              {t === 'hidden' && `Hidden (${hiddenTags.length})`}
            </button>
          ))}
        </div>

        {/* Controls bar */}
        <div className="px-6 py-3 border-b border-surface-800 flex items-center gap-3">
          {tab === 'discover' && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter words..."
                className="input-field flex-1 text-sm"
              />
              <div className="flex items-center gap-2 text-xs text-surface-400 shrink-0">
                <span>Min:</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={minCount}
                  onChange={(e) => setMinCount(Number(e.target.value))}
                  className="w-20 accent-accent-500"
                />
                <span className="tabular-nums w-4 text-center">{minCount}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPhrase()
                  }}
                  placeholder="Add phrase..."
                  className="input-field text-sm w-32"
                />
                <button
                  onClick={handleAddPhrase}
                  disabled={!phraseInput.trim()}
                  className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </>
          )}
          {(tab === 'accepted' || tab === 'hidden') && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filter ${tab} words...`}
              className="input-field flex-1 text-sm"
            />
          )}
        </div>

        {/* Combine mode banner */}
        {combineMode && (
          <div className="px-6 py-2 bg-accent-900/30 border-b border-accent-800/50 flex items-center justify-between">
            <span className="text-sm text-accent-300">
              Click a word to merge &quot;{combineMode}&quot; into it
            </span>
            <button
              onClick={() => setCombineMode(null)}
              className="btn-ghost text-xs px-2 py-0.5"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Feedback toast */}
        {actionFeedback && (
          <div className="px-6 py-1.5 bg-surface-800 text-xs text-accent-400 border-b border-surface-700">
            {actionFeedback}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-surface-500 text-sm">Analyzing seed texts...</div>
            </div>
          ) : tab === 'discover' ? (
            /* Discover tab — weighted word grid */
            filteredWords.length === 0 ? (
              <div className="text-surface-500 text-sm text-center py-8">
                {words.length === 0
                  ? 'No seed texts to analyze'
                  : 'No words match the current filters'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-baseline">
                {filteredWords.map((w) => (
                  <div key={w.word} className="relative inline-flex flex-col items-center">
                    <button
                      onClick={() => combineMode ? handleWordClick(w.word) : handleAccept(w.word)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        if (!combineMode) handleHide(w.word)
                      }}
                      className={`px-2.5 py-1 rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        combineMode
                          ? combineMode === w.word
                            ? 'bg-accent-700/40 text-accent-300 ring-1 ring-accent-500'
                            : 'bg-surface-800 text-surface-200 hover:bg-accent-900/40 hover:text-accent-300'
                          : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                      }`}
                      style={{ fontSize: `${wordSize(w.count)}rem` }}
                      title="Click to accept, right-click to hide"
                    >
                      {w.word}
                      <span
                        className="text-surface-500 font-normal"
                        style={{ fontSize: '0.7rem' }}
                      >
                        {w.count}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : tab === 'accepted' ? (
            /* Accepted tab — list of accepted words */
            acceptedTags.length === 0 ? (
              <div className="text-surface-500 text-sm text-center py-8">
                No accepted words yet. Switch to Discover to start.
              </div>
            ) : (
              <div className="space-y-0">
                {acceptedTags
                  .filter(
                    (ct) => !search || ct.word.includes(search.toLowerCase())
                  )
                  .map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center gap-3 py-2 border-b border-surface-800/50 group"
                    >
                      <span className="text-sm text-surface-200 flex-1">
                        {ct.word}
                      </span>
                      <span className="text-xs text-surface-500 tabular-nums">
                        {ct.match_count} chars
                      </span>
                      {ct.tag_id && (
                        <span className="text-xs text-accent-400/70 px-1.5 py-0.5 bg-accent-900/20 rounded">
                          tag
                        </span>
                      )}
                      <button
                        onClick={() => handleReset(ct.id)}
                        className="btn-ghost text-xs px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Reset
                      </button>
                    </div>
                  ))}
              </div>
            )
          ) : (
            /* Hidden tab — list of hidden words */
            hiddenTags.length === 0 ? (
              <div className="text-surface-500 text-sm text-center py-8">
                No hidden words.
              </div>
            ) : (
              <div className="space-y-0">
                {hiddenTags
                  .filter(
                    (ct) => !search || ct.word.includes(search.toLowerCase())
                  )
                  .map((ct) => {
                    const mergedTarget = ct.merged_into
                      ? cloudTags.find((t) => t.id === ct.merged_into)
                      : null
                    return (
                      <div
                        key={ct.id}
                        className="flex items-center gap-3 py-2 border-b border-surface-800/50 group"
                      >
                        <span className="text-sm text-surface-400 flex-1">
                          {ct.word}
                          {mergedTarget && (
                            <span className="text-xs text-surface-600 ml-2">
                              &#8594; {mergedTarget.word}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleUnhide(ct.id)}
                          className="btn-ghost text-xs px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Unhide
                        </button>
                      </div>
                    )
                  })}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-800 flex items-center justify-between">
          <span className="text-xs text-surface-600">
            {words.length} unique words across all seed texts
          </span>
          <button onClick={onClose} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
