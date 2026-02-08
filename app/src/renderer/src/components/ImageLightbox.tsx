import { useEffect, useCallback, useState } from 'react'

interface LightboxImage {
  path: string
  characterName: string | null
  characterId: number
}

interface ImageLightboxProps {
  images: LightboxImage[]
  initialIndex: number
  onClose: () => void
}

function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps): JSX.Element {
  const [index, setIndex] = useState(initialIndex)
  const current = images[index]

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length)
  }, [images.length])

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goNext, goPrev])

  if (!current) return <></>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                     flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image — click to close */}
      <img
        src={`local-file://${encodeURIComponent(current.path)}`}
        alt={current.characterName || 'Character image'}
        className="max-h-[90vh] max-w-[90vw] object-contain select-none cursor-pointer"
        draggable={false}
      />

      {/* Next arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                     flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Info bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full">
        <span className="text-sm text-white/80">{current.characterName || 'Unnamed'}</span>
        <span className="text-xs text-white/40">{index + 1} / {images.length}</span>
      </div>
    </div>
  )
}

export default ImageLightbox
