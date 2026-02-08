import { useState, useEffect, useCallback, useRef } from 'react'
import type { CharacterWithDetails } from '../../../shared/types'
import type { StatusDisplayNames } from '../App'
import MarkdownView from './MarkdownView'
import ImageLightbox from './ImageLightbox'

interface CharacterStub {
  id: number
  name: string | null
}

interface SlideshowViewProps {
  characterIds: CharacterStub[]
  statusNames: StatusDisplayNames
  startAtId?: number | null
  onSelectCharacter: (id: number) => void
  onExit: () => void
}

function localFileUrl(filePath: string): string {
  return `local-file://${encodeURIComponent(filePath)}`
}

function SlideshowView({
  characterIds,
  statusNames,
  startAtId,
  onSelectCharacter,
  onExit
}: SlideshowViewProps): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (startAtId) {
      const idx = characterIds.findIndex(c => c.id === startAtId)
      return idx >= 0 ? idx : 0
    }
    return 0
  })
  const [imageIndex, setImageIndex] = useState(0)
  const [char, setChar] = useState<CharacterWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayInterval, setAutoPlayInterval] = useState(5000)
  const [randomOrder, setRandomOrder] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [priorityEditing, setPriorityEditing] = useState(false)
  const [localPriority, setLocalPriority] = useState<number | null>(null)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seedScrollRef = useRef<HTMLDivElement>(null)
  const visitedRef = useRef<Set<number>>(new Set())
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  const totalCount = characterIds.length

  // Fetch full character details when index changes
  useEffect(() => {
    if (totalCount === 0) return
    let cancelled = false
    setLoading(true)
    setImageIndex(0)
    setLocalPriority(null)
    setPriorityEditing(false)
    if (seedScrollRef.current) seedScrollRef.current.scrollTop = 0

    const stub = characterIds[currentIndex]
    if (!stub) return

    window.api.getCharacter(stub.id).then((data: CharacterWithDetails | null) => {
      if (!cancelled && data) {
        setChar(data)
        setLocalPriority(data.priority)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [currentIndex, characterIds, totalCount])

  // Pick a random index that hasn't been visited recently
  const pickRandom = useCallback(() => {
    if (totalCount <= 1) return 0
    visitedRef.current.add(currentIndexRef.current)
    if (visitedRef.current.size >= totalCount) visitedRef.current.clear()
    let next: number
    do {
      next = Math.floor(Math.random() * totalCount)
    } while (visitedRef.current.has(next) && visitedRef.current.size < totalCount)
    return next
  }, [totalCount])

  // Auto-play
  useEffect(() => {
    if (autoPlay && totalCount > 1) {
      autoPlayRef.current = setInterval(() => {
        if (randomOrder) {
          setCurrentIndex(pickRandom())
        } else {
          setCurrentIndex(i => (i + 1) % totalCount)
        }
      }, autoPlayInterval)
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    }
  }, [autoPlay, autoPlayInterval, totalCount, randomOrder, pickRandom])

  const goNext = useCallback(() => {
    setAutoPlay(false)
    if (randomOrder) {
      setCurrentIndex(pickRandom())
    } else {
      setCurrentIndex(i => (i + 1) % totalCount)
    }
  }, [totalCount, randomOrder, pickRandom])

  const goPrev = useCallback(() => {
    setAutoPlay(false)
    setCurrentIndex(i => (i - 1 + totalCount) % totalCount)
  }, [totalCount])

  const goNextImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!char?.images.length) return
    setImageIndex(i => (i + 1) % char.images.length)
  }, [char])

  const goPrevImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!char?.images.length) return
    setImageIndex(i => (i - 1 + char.images.length) % char.images.length)
  }, [char])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (priorityEditing) return
      if (e.key === 'Escape') onExit()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === ' ') {
        e.preventDefault()
        setAutoPlay(p => !p)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onExit, goNext, goPrev, priorityEditing])

  const handlePriorityChange = async (newPriority: number) => {
    if (!char) return
    await window.api.updateCharacter(char.id, { priority: newPriority })
    setLocalPriority(newPriority)
    setPriorityEditing(false)
  }

  if (totalCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <p className="text-surface-500 text-lg mb-4">No characters to display</p>
          <button onClick={onExit} className="px-4 py-2 bg-surface-800 text-surface-300 rounded-lg hover:bg-surface-700 transition-colors">
            Back to Grid
          </button>
        </div>
      </div>
    )
  }

  if (loading || !char) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950">
        <div className="text-surface-600 text-sm">Loading...</div>
      </div>
    )
  }

  const images = char.images || []
  const currentImage = images[Math.min(imageIndex, images.length - 1)] || null
  const priority = localPriority ?? char.priority

  const statusLabel = statusNames[char.status as keyof StatusDisplayNames] || char.status
  const statusColor = char.status === 'active'
    ? 'bg-status-active-bg text-status-active border-status-active/30'
    : char.status === 'archived'
      ? 'bg-surface-700/50 text-surface-400 border-surface-600/30'
      : 'bg-status-waiting-bg text-status-waiting border-status-waiting/25'

  const priorityColors: Record<number, string> = {
    5: 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]',
    4: 'bg-green-500',
    3: 'bg-yellow-500',
    2: 'bg-orange-500',
    1: 'bg-red-500',
    0: 'bg-surface-600'
  }

  return (
    <div className="h-full flex flex-col bg-surface-950 relative select-none view-enter">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0 bg-surface-900/60 border-b border-surface-800/50">
        <div className="flex items-center gap-3">
          {/* Playback cluster */}
          <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-1">
            <button
              onClick={() => setAutoPlay(p => !p)}
              className={autoPlay ? 'btn-toolbar-active' : 'btn-toolbar'}
            >
              {autoPlay ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              {autoPlay ? 'Pause' : 'Play'}
            </button>
            {autoPlay && (
              <select
                value={autoPlayInterval}
                onChange={e => setAutoPlayInterval(Number(e.target.value))}
                className="select-field text-[11px]"
              >
                <option value={3000}>3s</option>
                <option value={5000}>5s</option>
                <option value={8000}>8s</option>
                <option value={12000}>12s</option>
                <option value={20000}>20s</option>
              </select>
            )}
            <button
              onClick={() => { setRandomOrder(r => !r); visitedRef.current.clear() }}
              className={randomOrder ? 'btn-toolbar-active' : 'btn-toolbar'}
              title={randomOrder ? 'Shuffle on' : 'Shuffle off'}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4h3l2 5m0 0l3 7h4l4-12h-3M4 20h3l2-5m0 0l3-7" />
              </svg>
              Shuffle
            </button>
          </div>
        </div>

        <div className="text-xs text-surface-500 tabular-nums">
          {currentIndex + 1} / {totalCount}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setPriorityEditing(p => !p)}
              className="btn-toolbar"
              title="Change priority"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[priority] || 'bg-surface-600'}`} />
              P{priority}
            </button>
            {priorityEditing && (
              <div className="absolute top-full right-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg p-2 flex gap-1 z-50 shadow-xl">
                {[0, 1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium transition-all
                      ${priority === p
                        ? 'bg-accent-500 text-white ring-2 ring-accent-400/40'
                        : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-surface-700" />

          <button
            onClick={onExit}
            className="btn-ghost"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit
          </button>
        </div>
      </div>

      {/* Main content — always image left, info right */}
      <div className="flex-1 flex items-stretch min-h-0">
        {/* Prev character arrow */}
        {totalCount > 1 && (
          <button
            onClick={goPrev}
            className="shrink-0 w-12 flex items-center justify-center text-surface-600 hover:text-surface-300
                       transition-colors hover:bg-surface-800/40"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Image panel — no extra padding, image fills the space, letterboxed for landscape */}
        <div className="relative flex flex-col py-4" style={{ width: '58%', minWidth: 340 }}>
          <div className="relative flex-1 flex items-center justify-center overflow-hidden group min-h-0
                          bg-surface-900/30 border border-surface-800/50 rounded-lg">
            {currentImage ? (
              <>
                <img
                  key={currentImage.file_path}
                  src={localFileUrl(currentImage.file_path)}
                  alt={char.name || 'Character'}
                  className="max-w-full max-h-full object-contain cursor-pointer select-none animate-fade-in"
                  draggable={false}
                  onClick={() => setLightboxOpen(true)}
                />
                {/* Image nav overlay — visible on hover */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goPrevImage}
                      className="absolute left-2 bottom-3 px-3 py-1.5 rounded-lg bg-black/50 text-white/70
                                 hover:bg-black/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 text-xs"
                    >
                      &#8249; Prev
                    </button>
                    <button
                      onClick={goNextImage}
                      className="absolute right-2 bottom-3 px-3 py-1.5 rounded-lg bg-black/50 text-white/70
                                 hover:bg-black/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 text-xs"
                    >
                      Next &#8250;
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full
                                    bg-black/50 text-white/60 text-[10px] opacity-0 group-hover:opacity-100 transition-all">
                      {imageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-surface-600">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">No images</span>
              </div>
            )}
          </div>

          {/* Tags & Groups below image */}
          <div className="mt-3 space-y-2 shrink-0 px-1">
            {char.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {char.tags.map(tag => (
                  <span key={tag.id} className="px-2 py-0.5 text-[11px] rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/20">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            {char.groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {char.groups.map(g => (
                  <span key={g.id} className="px-2 py-0.5 text-[11px] rounded-full bg-surface-700/60 text-surface-400 border border-surface-600/30">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="flex flex-col min-w-0 py-4 px-6" style={{ flex: 1 }}>
          <h1 className="text-2xl font-bold font-display text-surface-100 mb-1 truncate">
            {char.name || <span className="italic text-surface-500 font-sans">Unnamed Character</span>}
          </h1>
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-2 py-0.5 text-[11px] rounded-full border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div ref={seedScrollRef} className="flex-1 overflow-y-auto pr-2 min-h-0">
            <MarkdownView content={char.seed_text} />
          </div>
        </div>

        {/* Next character arrow */}
        {totalCount > 1 && (
          <button
            onClick={goNext}
            className="shrink-0 w-12 flex items-center justify-center text-surface-600 hover:text-surface-300
                       transition-colors hover:bg-surface-800/40"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-8 py-2 shrink-0 border-t border-surface-800/50 bg-surface-900/40">
        <div className="flex-1 max-w-md">
          <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500/60 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => onSelectCharacter(char.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-accent-400
                     hover:bg-accent-500/10 transition-colors"
        >
          Open Details
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      {lightboxOpen && currentImage && (
        <ImageLightbox
          images={images.map(img => ({
            path: img.file_path,
            characterName: char.name,
            characterId: char.id
          }))}
          initialIndex={imageIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

export default SlideshowView
