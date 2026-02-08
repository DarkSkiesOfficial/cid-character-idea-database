import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CharacterWithDetails } from '../../../shared/types'
import type { StatusDisplayNames } from '../App'
import ImageLightbox from './ImageLightbox'
import MarkdownView from './MarkdownView'

interface CoverFlowStub {
  id: number
  name: string | null
  coverImage: string | null
}

interface CoverFlowViewProps {
  characterIds: CoverFlowStub[]
  statusNames: StatusDisplayNames
  startAtId?: number | null
  onSelectCharacter: (id: number) => void
  onExit: () => void
}

function localFileUrl(filePath: string): string {
  return `local-file://${encodeURIComponent(filePath)}`
}

function getCardStyle(offset: number): React.CSSProperties {
  const abs = Math.abs(offset)
  const width = offset === 0 ? 380 : abs === 1 ? 260 : 200
  const height = offset === 0 ? 540 : abs === 1 ? 380 : 300

  const rotateY = offset === 0 ? 0 : offset < 0 ? (abs === 1 ? 28 : 45) : (abs === 1 ? -28 : -45)
  const translateZ = offset === 0 ? 60 : abs === 1 ? -60 : -120
  const translateX = offset === 0 ? 0 : offset * (abs === 1 ? 280 : 420)

  return {
    width,
    height,
    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg)`,
    opacity: offset === 0 ? 1 : abs === 1 ? 0.55 : 0.25,
    zIndex: 10 - abs,
    transition: 'all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
    willChange: 'transform, opacity',
    pointerEvents: offset === 0 ? 'auto' as const : 'none' as const
  }
}

function CoverFlowView({
  characterIds,
  statusNames,
  startAtId,
  onSelectCharacter,
  onExit
}: CoverFlowViewProps): JSX.Element {
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [progressKey, setProgressKey] = useState(0)
  const [priorityEditing, setPriorityEditing] = useState(false)
  const [localPriority, setLocalPriority] = useState<number | null>(null)

  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visitedRef = useRef<Set<number>>(new Set())
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalCount = characterIds.length

  // Fetch full character data for center card
  useEffect(() => {
    if (totalCount === 0) return
    let cancelled = false
    setLoading(true)
    setImageIndex(0)
    setLocalPriority(null)
    setPriorityEditing(false)

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

  // Reset progress bar when character changes or autoplay toggles
  useEffect(() => {
    setProgressKey(k => k + 1)
  }, [currentIndex, autoPlay])

  // Listen for fullscreen changes from main process
  useEffect(() => {
    const cleanup = window.api.onFullscreenChanged((fs: boolean) => {
      setIsFullscreen(fs)
      if (!fs) setToolbarVisible(true)
    })
    return cleanup
  }, [])

  // Toolbar auto-hide in fullscreen
  const resetToolbarTimer = useCallback(() => {
    if (!isFullscreen) return
    setToolbarVisible(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => setToolbarVisible(false), 3000)
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) {
      setToolbarVisible(true)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      return
    }
    const handleMouseMove = (): void => resetToolbarTimer()
    window.addEventListener('mousemove', handleMouseMove)
    resetToolbarTimer()
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [isFullscreen, resetToolbarTimer])

  const toggleFullscreen = useCallback(() => {
    window.api.toggleFullscreen()
  }, [])

  // Pick a random non-recently-visited index
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

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (lightboxOpen) return
      if (priorityEditing && e.key !== 'Escape') return

      switch (e.key) {
        case 'Escape':
          if (priorityEditing) {
            setPriorityEditing(false)
          } else if (isFullscreen) {
            toggleFullscreen()
          } else {
            onExit()
          }
          break
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
        case ' ':
          e.preventDefault()
          setAutoPlay(p => !p)
          break
        case 'Enter':
          if (char) onSelectCharacter(char.id)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'ArrowUp':
          e.preventDefault()
          if (char && char.images.length > 1) {
            setImageIndex(i => (i - 1 + char.images.length) % char.images.length)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (char && char.images.length > 1) {
            setImageIndex(i => (i + 1) % char.images.length)
          }
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onExit, goNext, goPrev, char, lightboxOpen, priorityEditing, isFullscreen, toggleFullscreen, onSelectCharacter])

  const handlePriorityChange = async (newPriority: number): Promise<void> => {
    if (!char) return
    await window.api.updateCharacter(char.id, { priority: newPriority })
    setLocalPriority(newPriority)
    setPriorityEditing(false)
  }

  // Compute visible cards — center first, then outward, skipping duplicates
  const visibleCards = useMemo(() => {
    if (totalCount === 0) return []
    const seen = new Set<number>()
    const cards: { offset: number; idx: number; stub: CoverFlowStub }[] = []
    // Process center first, then nearest positions outward
    const priorityOrder = [0, -1, 1, -2, 2]
    for (const offset of priorityOrder) {
      const idx = ((currentIndex + offset) % totalCount + totalCount) % totalCount
      if (seen.has(idx)) continue
      seen.add(idx)
      cards.push({ offset, idx, stub: characterIds[idx] })
    }
    return cards
  }, [currentIndex, totalCount, characterIds])

  // Preload adjacent images
  useEffect(() => {
    const preloadOffsets = [-3, -2, -1, 1, 2, 3]
    preloadOffsets.forEach(offset => {
      const idx = ((currentIndex + offset) % totalCount + totalCount) % totalCount
      const stub = characterIds[idx]
      if (stub?.coverImage) {
        const img = new Image()
        img.src = localFileUrl(stub.coverImage)
      }
    })
  }, [currentIndex, totalCount, characterIds])

  // Empty state
  if (totalCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950 view-enter">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-surface-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-surface-500 text-lg mb-2">No characters with images</p>
          <p className="text-surface-600 text-sm mb-4">Cover Flow only shows characters that have images.</p>
          <button onClick={onExit} className="btn-secondary">Back to Grid</button>
        </div>
      </div>
    )
  }

  const images = char?.images || []
  const currentImage = images[Math.min(imageIndex, images.length - 1)] || null
  const priority = localPriority ?? char?.priority ?? 0
  const statusLabel = char ? (statusNames[char.status as keyof StatusDisplayNames] || char.status) : ''
  const statusColor = char?.status === 'active'
    ? 'bg-status-active-bg text-status-active border-status-active/30'
    : char?.status === 'archived'
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
      {/* Toolbar */}
      <div
        className={`flex items-center justify-between px-4 py-2 shrink-0 bg-surface-900/60 border-b border-surface-800/50 z-30 transition-opacity duration-500 ${
          toolbarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
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
          {/* Priority editor */}
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

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="btn-toolbar"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4m-7 7l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            )}
          </button>

          <button onClick={onExit} className="btn-ghost">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit
          </button>
        </div>
      </div>

      {/* Carousel area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative overflow-hidden">
        {/* Subtle radial gradient backdrop */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(30,32,36,1) 0%, rgba(18,20,22,1) 70%)' }}
        />

        {/* 3D perspective wrapper */}
        <div
          className="relative flex items-center justify-center"
          style={{ perspective: '1200px', transformStyle: 'preserve-3d', width: '100%', height: '70%', minHeight: 400 }}
        >
          {/* Navigation click zones */}
          {totalCount > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-0 top-0 bottom-0 w-1/4 z-20 flex items-center justify-start pl-6 opacity-0 hover:opacity-100 transition-opacity"
                aria-label="Previous character"
              >
                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:bg-accent-500/30 hover:border-accent-500/40 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              </button>
              <button
                onClick={goNext}
                className="absolute right-0 top-0 bottom-0 w-1/4 z-20 flex items-center justify-end pr-6 opacity-0 hover:opacity-100 transition-opacity"
                aria-label="Next character"
              >
                <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:bg-accent-500/30 hover:border-accent-500/40 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </>
          )}

          {/* Cards */}
          {visibleCards.map(({ offset, idx, stub }) => {
            const isCenter = offset === 0
            const imgSrc = isCenter && char && currentImage
              ? localFileUrl(currentImage.file_path)
              : stub.coverImage
                ? localFileUrl(stub.coverImage)
                : null

            return (
              <div
                key={`${idx}-${stub.id}`}
                className={`coverflow-card ${isCenter ? 'center' : ''}`}
                style={getCardStyle(offset)}
                onClick={isCenter && char ? () => setLightboxOpen(true) : undefined}
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={stub.name || 'Character'}
                    className="w-full h-full object-contain bg-black"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                    <span className="text-2xl font-bold text-surface-600 opacity-30">?</span>
                  </div>
                )}
                {/* Name overlay on each card */}
                <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <span className="text-white text-xs font-medium truncate block">
                    {stub.name || 'Unnamed'}
                  </span>
                </div>

                {/* Image cycling for center card */}
                {isCenter && images.length > 1 && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="px-1.5 py-0.5 rounded-full bg-black/50 text-white/70 text-[10px] backdrop-blur-sm">
                      {imageIndex + 1}/{images.length}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Image cycling dots for center card */}
        {char && images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2 relative z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setImageIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === imageIndex ? 'bg-accent-400 scale-125' : 'bg-surface-600 hover:bg-surface-500'
                }`}
              />
            ))}
          </div>
        )}

        {/* Info panel below carousel */}
        <div className="relative z-10 text-center px-8 py-3 w-full max-w-2xl mx-auto shrink-0">
          {loading ? (
            <div className="text-surface-600 text-sm">Loading...</div>
          ) : char ? (
            <>
              <h2
                className="text-2xl font-display text-surface-100 mb-1 truncate cursor-pointer hover:text-accent-400 transition-colors"
                onClick={() => onSelectCharacter(char.id)}
              >
                {char.name || <span className="italic text-surface-500 font-sans text-xl">Unnamed Character</span>}
              </h2>

              <div className="flex items-center justify-center gap-3 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[priority] || 'bg-surface-600'}`} />
                <span className={`px-2 py-0.5 text-[11px] rounded-full border ${statusColor}`}>
                  {statusLabel}
                </span>
                {images.length > 0 && (
                  <span className="text-surface-600 text-[11px]">{images.length} image{images.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {char.seed_text && (
                <div className="text-sm text-surface-400 leading-relaxed line-clamp-3 mb-2">
                  <MarkdownView content={char.seed_text} />
                </div>
              )}

              {char.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mb-1">
                  {char.tags.slice(0, 8).map(tag => (
                    <span key={tag.id} className="px-2 py-0.5 text-[11px] rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/20">
                      {tag.name}
                    </span>
                  ))}
                  {char.tags.length > 8 && (
                    <span className="px-2 py-0.5 text-[11px] rounded-full bg-surface-700/50 text-surface-500">
                      +{char.tags.length - 8}
                    </span>
                  )}
                </div>
              )}

              {char.groups.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {char.groups.map(g => (
                    <span key={g.id} className="px-2 py-0.5 text-[11px] rounded-full bg-surface-700/60 text-surface-400 border border-surface-600/30">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className={`flex items-center justify-between px-8 py-2 shrink-0 border-t border-surface-800/50 bg-surface-900/40 z-30 transition-opacity duration-500 ${
          toolbarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex-1 max-w-md">
          <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500/60 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => char && onSelectCharacter(char.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-accent-400 hover:bg-accent-500/10 transition-colors"
        >
          Open Details
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      {/* Auto-play progress bar */}
      {autoPlay && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-800 z-40">
          <div
            key={progressKey}
            className="h-full bg-accent-500/60"
            style={{ animation: `coverFlowProgress ${autoPlayInterval}ms linear forwards` }}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && char && currentImage && (
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

export default CoverFlowView
