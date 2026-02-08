import { useState, useEffect } from 'react'
import type { Tournament } from '../../../shared/types'

interface LoadTournamentModalProps {
  onClose: () => void
  onLoad: (tournamentId: number) => void
}

interface TournamentListItem extends Tournament {
  match_count: number
}

function LoadTournamentModal({ onClose, onLoad }: LoadTournamentModalProps): JSX.Element {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadTournaments()
  }, [])

  const loadTournaments = async () => {
    setLoading(true)
    try {
      const list = await window.api.getAllTournaments()
      setTournaments(list)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await window.api.deleteTournament(id)
      setTournaments(prev => prev.filter(t => t.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col border border-surface-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-surface-100">Load Tournament</h2>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-surface-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-surface-500 py-8">Loading...</div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-surface-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-surface-500">No saved tournaments</p>
              <p className="text-sm text-surface-600 mt-1">Start a tournament and save it to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map(t => (
                <div
                  key={t.id}
                  className="bg-surface-800 rounded-lg p-4 hover:bg-surface-750 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-surface-100 truncate">{t.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          t.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {t.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-surface-400">
                        <span>{t.format === 'single' ? 'Single Elim' : 'Double Elim'}</span>
                        <span>{t.match_count} matches</span>
                        <span>{formatDate(t.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting === t.id}
                        className="btn-danger-ghost text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {deleting === t.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={() => onLoad(t.id)}
                        className="btn-primary text-xs"
                      >
                        {t.status === 'completed' ? 'View' : 'Continue'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-800 flex justify-end shrink-0">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoadTournamentModal
