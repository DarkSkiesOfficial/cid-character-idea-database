import { useState, useEffect, useCallback, useRef } from 'react'
import type { CharacterWithDetails } from '../../../shared/types'
import type { StatusDisplayNames } from '../App'
import MarkdownView from './MarkdownView'
import ImageLightbox from './ImageLightbox'

interface CharacterStub {
  id: number
  name: string | null
}

interface SwipeViewProps {
  characterIds: CharacterStub[]
  statusNames: StatusDisplayNames
  startAtId?: number | null
  onSelectCharacter: (id: number) => void
  onExit: () => void
}

function localFileUrl(filePath: string): string {
  return `local-file://${encodeURIComponent(filePath)}`
}

type PanelVisibility = {
  filmStrip: boolean
  seed: boolean
}

function SwipeView({
  characterIds,
  statusNames,
  startAtId,
  onSelectCharacter,
  onExit
}: SwipeViewProps): JSX.Element {
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
  const [panels, setPanels] = useState<PanelVisibility>(() => {
    const saved = localStorage.getItem('swipeViewPanels')
    return saved ? JSON.parse(saved) : { filmStrip: true, seed: true }
  })
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visitedRef = useRef<Set<number>>(new Set())
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  const totalCount = characterIds.length

  // Persist panel state
  useEffect(() => {
    localStorage.setItem('swipeViewPanels', JSON.stringify(panels))
  }, [panels])

  // Fetch character details on index change
  useEffect(() => {
    if (totalCount === 0) return
    let cancelled = false
    setLoading(true)
    setImageIndex(0)

    const stub = characterIds[currentIndex]
    if (!stub) return

    window.api.getCharacter(stub.id).then((data: CharacterWithDetails | null) => {
      if (!cancelled && data) {
        setChar(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [currentIndex, characterIds, totalCount])

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

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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
  }, [onExit, goNext, goPrev])

  const togglePanel = (panel: keyof PanelVisibility) => {
    setPanels(p => ({ ...p, [panel]: !p[panel] }))
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

  const statusLabel = statusNames[char.status as keyof StatusDisplayNames] || char.status
  const statusColor = char.status === 'active'
    ? 'bg-status-active-bg text-status-active border-status-active/30'
    : char.status === 'archived'
      ? 'bg-surface-700/50 text-surface-400 border-surface-600/30'
      : 'bg-status-waiting-bg text-status-waiting border-status-waiting/25'

  // How many panels are open affects center image sizing
  const panelsOpen = (panels.filmStrip ? 1 : 0) + (panels.seed ? 1 : 0)

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
              {autoPlay ? 'Pause' : 'Auto'}
            </button>
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

          {/* Panel toggles */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => togglePanel('filmStrip')}
              className={panels.filmStrip ? 'btn-toolbar-active' : 'btn-toolbar'}
              title={panels.filmStrip ? 'Hide thumbnails' : 'Show thumbnails'}
            >
              Thumbnails
            </button>
            <button
              onClick={() => togglePanel('seed')}
              className={panels.seed ? 'btn-toolbar-active' : 'btn-toolbar'}
              title={panels.seed ? 'Hide info panel' : 'Show info panel'}
            >
              Info
            </button>
          </div>
        </div>

        <div className="text-xs text-surface-500 tabular-nums">
          {currentIndex + 1} / {totalCount}
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-[11px] rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
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

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Prev arrow */}
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

        {/* Left panel: tags + film strip */}
        {panels.filmStrip && (
          <div className="shrink-0 flex flex-col gap-3 py-4 pr-2" style={{ width: 150 }}>
            {char.tags.length > 0 && (
              <div className="shrink-0 px-2">
                <div className="flex flex-wrap gap-1">
                  {char.tags.map(tag => (
                    <span key={tag.id} className="px-2 py-0.5 text-[10px] rounded-full bg-accent-500/15 text-accent-400 border border-accent-500/20">
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {char.groups.length > 0 && (
              <div className="shrink-0 px-2">
                <div className="flex flex-wrap gap-1">
                  {char.groups.map(g => (
                    <span key={g.id} className="px-1.5 py-0.5 text-[10px] rounded-full bg-surface-700/60 text-surface-500 border border-surface-600/30">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {images.length > 0 ? (
              <div className="flex-1 overflow-y-auto px-2 space-y-2 min-h-0">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setImageIndex(i)}
                    className={`relative w-full rounded-lg overflow-hidden border transition-all ${
                      i === imageIndex
                        ? 'border-accent-500 shadow-sm shadow-accent-500/30'
                        : 'border-transparent hover:border-surface-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="relative w-full" style={{ paddingBottom: '133%' }}>
                      <img
                        src={localFileUrl(img.file_path)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-surface-700 text-xs">
                No images
              </div>
            )}
          </div>
        )}

        {/* Center: main image — takes up remaining space */}
        <div className="flex-1 flex flex-col min-w-0 relative group">
          {currentImage ? (
            <div className="relative flex-1 flex items-center justify-center min-h-0 p-2">
              <img
                src={localFileUrl(currentImage.file_path)}
                alt={char.name || 'Character'}
                className="max-w-full max-h-full object-contain cursor-pointer select-none"
                draggable={false}
                onClick={() => setLightboxOpen(true)}
              />

              {/* Name overlay — flush to bottom of container */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-12
                              bg-gradient-to-t from-black/80 via-black/40 to-transparent
                              pointer-events-none">
                <h1 className="text-xl font-bold font-display text-white truncate">
                  {char.name || <span className="italic text-surface-500 font-sans">Unnamed</span>}
                </h1>
              </div>

              {images.length > 1 && (
                <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-black/50
                                text-white/70 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {imageIndex + 1} / {images.length}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-surface-600">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h1 className="text-lg font-bold font-display text-surface-400">
                {char.name || <span className="italic text-surface-500 font-sans">Unnamed</span>}
              </h1>
              <span className="text-sm">No images</span>
            </div>
          )}
        </div>

        {/* Right panel: seed text — wider */}
        {panels.seed && (
          <div className="shrink-0 flex flex-col py-4 pl-3 pr-2 border-l border-surface-800/50"
               style={{ width: panelsOpen === 2 ? 380 : 440 }}>
            {!currentImage && (
              <h2 className="text-sm font-bold text-surface-300 px-2 mb-2 truncate">{char.name || 'Unnamed'}</h2>
            )}

            <div className="flex-1 overflow-y-auto px-2 min-h-0">
              <MarkdownView content={char.seed_text} />
            </div>

            <div className="shrink-0 pt-3 px-2 border-t border-surface-800/40 mt-2">
              <button
                onClick={() => onSelectCharacter(char.id)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs
                           text-accent-400 bg-accent-500/10 hover:bg-accent-500/20 transition-colors border border-accent-500/20"
              >
                Open Full Details
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Next arrow */}
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

export default SwipeView
