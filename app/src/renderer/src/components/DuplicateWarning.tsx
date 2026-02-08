interface DuplicateMatch {
  id: number
  name: string | null
  similarity: number
  preview: string
}

interface DuplicateWarningProps {
  matches: DuplicateMatch[]
  onDismiss: () => void
  onViewExisting: (id: number) => void
}

function DuplicateWarning({ matches, onDismiss, onViewExisting }: DuplicateWarningProps): JSX.Element {
  if (matches.length === 0) return <></>

  const best = matches[0]

  return (
    <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm text-amber-300 font-medium">
          Possible duplicate{matches.length > 1 ? 's' : ''} found
        </p>
        <button onClick={onDismiss}
          className="text-xs text-amber-500 hover:text-amber-300 shrink-0">
          Dismiss
        </button>
      </div>

      <div className="space-y-2">
        {matches.slice(0, 3).map((match) => (
          <div key={match.id}
            className="flex items-start gap-3 bg-surface-900/50 rounded px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm text-surface-200 font-medium truncate">
                  {match.name || 'Unnamed'}
                </span>
                <span className="text-xs bg-amber-800/60 text-amber-300 px-1.5 py-0.5 rounded shrink-0">
                  {match.similarity}% match
                </span>
              </div>
              <p className="text-xs text-surface-500 truncate">{match.preview}</p>
            </div>
            <button onClick={() => onViewExisting(match.id)}
              className="text-xs text-accent-400 hover:text-accent-300 shrink-0 mt-0.5">
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DuplicateWarning
export type { DuplicateMatch }
