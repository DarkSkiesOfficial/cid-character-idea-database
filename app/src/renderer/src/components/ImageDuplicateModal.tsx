interface DuplicateMatch {
  type: 'exact' | 'similar'
  imageId: number
  characterId: number
  characterName: string | null
  filePath: string
  similarity: number
}

interface ImageDuplicateModalProps {
  sourcePath: string
  matches: DuplicateMatch[]
  onKeepBoth: () => void
  onSkip: () => void
  onReplace: (imageId: number) => void
}

function ImageDuplicateModal({ sourcePath, matches, onKeepBoth, onSkip, onReplace }: ImageDuplicateModalProps): JSX.Element {
  const bestMatch = matches[0]
  const isExact = bestMatch.type === 'exact'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col border border-surface-700">
        <div className="px-6 py-4 border-b border-surface-800 shrink-0">
          <h2 className="text-lg font-semibold text-surface-100">
            {isExact ? 'Exact Duplicate Found' : 'Similar Image Found'}
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            {isExact
              ? 'This image is byte-identical to one already in your library.'
              : `This image is ${Math.round(bestMatch.similarity * 100)}% visually similar to an existing image.`
            }
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* New image */}
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">New Image</p>
              <div className="rounded-lg overflow-hidden bg-surface-800">
                <img
                  src={`local-file://${encodeURIComponent(sourcePath)}`}
                  alt="New"
                  className="w-full aspect-[2/3] object-cover"
                />
              </div>
            </div>

            {/* Existing match */}
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                Existing — {bestMatch.characterName || 'Unnamed'}
              </p>
              <div className="rounded-lg overflow-hidden bg-surface-800">
                <img
                  src={`local-file://${encodeURIComponent(bestMatch.filePath)}`}
                  alt="Existing"
                  className="w-full aspect-[2/3] object-cover"
                />
              </div>
              {!isExact && (
                <p className="text-xs text-surface-500 mt-1.5 text-center">
                  {Math.round(bestMatch.similarity * 100)}% match
                </p>
              )}
            </div>
          </div>

          {matches.length > 1 && (
            <p className="text-xs text-surface-500 mt-3">
              +{matches.length - 1} other {matches.length - 1 === 1 ? 'match' : 'matches'} found
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-surface-800 flex justify-end gap-3 shrink-0">
          <button onClick={onSkip} className="btn-secondary">
            Skip
          </button>
          <button onClick={() => onReplace(bestMatch.imageId)} className="btn-secondary">
            Replace Existing
          </button>
          <button onClick={onKeepBoth} className="btn-primary">
            Keep Both
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageDuplicateModal

export type { DuplicateMatch }
