import { useState, useCallback, useMemo, useEffect } from 'react'
import type { CharacterWithDetails, TournamentConfig, BracketState, BracketType } from '../../../shared/types'
import { generateBracket, advanceWinner, serializeToMatches, getFinalRankings } from '../utils/bracketGenerator'
import TournamentBracket from './TournamentBracket'

interface TournamentViewProps {
  config: TournamentConfig
  statusNames: { waiting: string; active: string; archived: string }
  onSelectCharacter: (id: number) => void
  onExit: () => void
}

// Priority colors matching CharacterGrid
const priorityColors: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-green-500',
  5: 'bg-green-500'
}

function TournamentView({
  config,
  statusNames,
  onSelectCharacter,
  onExit
}: TournamentViewProps): JSX.Element {
  const [bracket, setBracket] = useState<BracketState | null>(() => {
    try {
      if (config.characters.length < 2) return null
      return generateBracket({
        characters: config.characters,
        format: config.format,
        shuffle: config.shuffle
      })
    } catch (e) {
      console.error('Failed to generate bracket:', e)
      return null
    }
  })
  const [showBracket, setShowBracket] = useState(false)
  const [savedTournamentId, setSavedTournamentId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<BracketState[]>([])

  // Current match to display
  const currentMatch = useMemo(() => {
    if (!bracket || !bracket.currentMatch) return null
    const { bracket: bracketType, round, match } = bracket.currentMatch

    if (bracketType === 'winners') {
      return bracket.winners[round - 1]?.[match]
    } else if (bracketType === 'losers') {
      return bracket.losers[round - 1]?.[match]
    } else if (bracketType === 'grand_final') {
      return bracket.grandFinal
    }
    return null
  }, [bracket])

  // Match count and progress
  const { completedMatches, totalMatches } = useMemo(() => {
    let completed = 0
    let total = 0

    if (!bracket) return { completedMatches: 0, totalMatches: 0 }

    for (const round of bracket.winners) {
      for (const m of round) {
        if (!m.isBye) {
          total++
          if (m.winner) completed++
        }
      }
    }
    for (const round of bracket.losers) {
      for (const m of round) {
        if (!m.isBye) {
          total++
          if (m.winner) completed++
        }
      }
    }
    if (bracket.grandFinal) {
      total++
      if (bracket.grandFinal.winner) completed++
    }

    return { completedMatches: completed, totalMatches: total }
  }, [bracket])

  // Handle picking a winner
  const handlePickWinner = useCallback((winner: CharacterWithDetails) => {
    if (!bracket || !bracket.currentMatch) return

    // Save current state for undo
    setHistory(prev => [...prev, bracket])

    const { bracket: bracketType, round, match } = bracket.currentMatch
    const newBracket = advanceWinner(bracket, bracketType, round, match, winner)
    setBracket(newBracket)
  }, [bracket])

  // Undo last match
  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setBracket(prev)
  }, [history])

  // Save tournament to DB
  const handleSave = useCallback(async () => {
    if (!bracket) return
    setSaving(true)
    try {
      const tournamentId = await window.api.createTournament({
        name: config.name,
        format: config.format,
        filter_criteria: null
      })

      const matches = serializeToMatches(bracket, tournamentId)
      await window.api.saveTournamentState({
        tournamentId,
        matches,
        status: bracket.isComplete ? 'completed' : 'in_progress',
        winnerId: bracket.champion?.id ?? null
      })

      setSavedTournamentId(tournamentId)
    } finally {
      setSaving(false)
    }
  }, [bracket, config])

  // Restart with same characters
  const handleRestart = useCallback(() => {
    const newBracket = generateBracket({
      characters: config.characters,
      format: config.format,
      shuffle: true
    })
    setBracket(newBracket)
    setHistory([])
    setSavedTournamentId(null)
  }, [config])

  // Keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && history.length > 0) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, history.length])

  // Get bracket type display name
  const getBracketTypeName = (type: BracketType, round: number): string => {
    if (!bracket) return ''
    if (type === 'grand_final') return 'Grand Final'
    if (type === 'losers') return `Losers Round ${round}`
    if (type === 'winners') {
      if (round === bracket.totalWinnersRounds) return 'Winners Final'
      if (round === bracket.totalWinnersRounds - 1) return 'Winners Semi-Final'
      return `Winners Round ${round}`
    }
    return ''
  }

  const rankings = bracket?.isComplete ? getFinalRankings(bracket) : []

  // Error state
  if (!bracket) {
    return (
      <div className="h-full flex flex-col bg-surface-950 view-enter">
        <div className="shrink-0 px-4 py-3 border-b border-surface-800 bg-surface-900/50">
          <button onClick={onExit} className="btn-ghost text-sm">
            <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Exit
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-surface-400 mb-4">Failed to generate tournament bracket.</p>
            <p className="text-sm text-surface-500">Need at least 2 characters to start a tournament.</p>
            <button onClick={onExit} className="btn-primary mt-6">Return to Grid</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-950 view-enter">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="btn-ghost text-sm">
            <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Exit
          </button>
          <h1 className="font-display text-xl text-surface-100">{config.name}</h1>
          <span className="text-sm text-surface-500">
            {config.format === 'single' ? 'Single Elimination' : 'Double Elimination'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-surface-400">
            {completedMatches} / {totalMatches} matches
          </span>

          {history.length > 0 && (
            <button onClick={handleUndo} className="btn-toolbar text-xs">
              <svg className="w-3.5 h-3.5 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo
            </button>
          )}

          <button
            onClick={() => setShowBracket(!showBracket)}
            className={showBracket ? 'btn-toolbar-active text-xs' : 'btn-toolbar text-xs'}
          >
            <svg className="w-3.5 h-3.5 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Bracket
          </button>

          {!savedTournamentId && (
            <button onClick={handleSave} disabled={saving} className="btn-secondary text-xs">
              {saving ? 'Saving...' : 'Save Tournament'}
            </button>
          )}
          {savedTournamentId && (
            <span className="text-xs text-green-400">Saved</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {showBracket ? (
          <TournamentBracket bracket={bracket} />
        ) : bracket.isComplete ? (
          /* Results View */
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="text-center mb-8">
              <div className="text-sm text-surface-500 uppercase tracking-wider mb-2">Champion</div>
              <div className="text-4xl font-display text-accent-400 mb-4">
                {bracket.champion?.name || 'Unnamed'}
              </div>
            </div>

            {/* Champion card */}
            {bracket.champion && (
              <div className="w-64 mb-8">
                <div
                  className="aspect-[2/3] bg-surface-800 rounded-xl overflow-hidden shadow-2xl ring-4 ring-accent-500/50 cursor-pointer hover:ring-accent-400/70 transition-all"
                  onClick={() => onSelectCharacter(bracket.champion!.id)}
                >
                  {bracket.champion.cover_image || bracket.champion.images[0] ? (
                    <img
                      src={`local-file://${encodeURIComponent((bracket.champion.cover_image || bracket.champion.images[0]).file_path)}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl text-surface-600">
                      {bracket.champion.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rankings */}
            {rankings.length > 1 && (
              <div className="w-full max-w-md mb-8">
                <div className="text-sm text-surface-500 uppercase tracking-wider mb-3 text-center">Final Standings</div>
                <div className="space-y-2">
                  {rankings.map((char, idx) => (
                    <div
                      key={char.id}
                      className="flex items-center gap-3 bg-surface-800 rounded-lg p-3 cursor-pointer hover:bg-surface-700 transition-colors"
                      onClick={() => onSelectCharacter(char.id)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-surface-400 text-black' :
                        'bg-amber-700 text-white'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 font-medium text-surface-100">
                        {char.name || <span className="italic text-surface-500">Unnamed</span>}
                      </div>
                      <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              {bracket.champion && (
                <button onClick={() => onSelectCharacter(bracket.champion!.id)} className="btn-secondary">
                  View Details
                </button>
              )}
              <button onClick={handleRestart} className="btn-secondary">
                Restart Tournament
              </button>
              <button onClick={onExit} className="btn-primary">
                Exit
              </button>
            </div>
          </div>
        ) : currentMatch ? (
          /* Match Display */
          <div className="h-full flex flex-col p-6 overflow-auto">
            {/* Match header */}
            <div className="text-center mb-4 shrink-0">
              <div className="text-sm text-surface-500 uppercase tracking-wider">
                {bracket.currentMatch && getBracketTypeName(bracket.currentMatch.bracket, bracket.currentMatch.round)}
              </div>
            </div>

            {/* Character comparison - equal width columns */}
            <div className="flex-1 flex items-start justify-center gap-8 mx-auto w-full px-4">
              {/* Character 1 */}
              {currentMatch.character1 && (
                <MatchCard
                  character={currentMatch.character1}
                  statusNames={statusNames}
                  onPick={() => handlePickWinner(currentMatch.character1!)}
                  onView={() => onSelectCharacter(currentMatch.character1!.id)}
                />
              )}

              {/* VS divider */}
              <div className="flex items-center justify-center shrink-0 pt-32">
                <div className="text-2xl font-bold text-surface-600">VS</div>
              </div>

              {/* Character 2 */}
              {currentMatch.character2 && (
                <MatchCard
                  character={currentMatch.character2}
                  statusNames={statusNames}
                  onPick={() => handlePickWinner(currentMatch.character2!)}
                  onView={() => onSelectCharacter(currentMatch.character2!.id)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-surface-500">
            No matches available
          </div>
        )}
      </div>
    </div>
  )
}

// Match card sub-component
interface MatchCardProps {
  character: CharacterWithDetails
  statusNames: { waiting: string; active: string; archived: string }
  onPick: () => void
  onView: () => void
}

function MatchCard({ character, statusNames, onPick, onView }: MatchCardProps): JSX.Element {
  const coverImage = character.cover_image || character.images[0]
  const statusLabel = statusNames[character.status]

  // Get first ~6 lines of seed text
  const seedExcerpt = character.seed_text
    .replace(/<START>[\s\S]*?<END>/g, '')
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 6)
    .join('\n')

  return (
    <div className="flex-1 flex flex-col min-w-0 max-w-sm">
      {/* Image - portrait aspect ratio */}
      <div
        className="aspect-[2/3] bg-surface-800 rounded-xl overflow-hidden mb-3 cursor-pointer hover:ring-2 hover:ring-surface-600 transition-all"
        onClick={onView}
      >
        {coverImage ? (
          <img
            src={`local-file://${encodeURIComponent(coverImage.file_path)}`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-surface-600">
            {character.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={onView}
            className="font-display text-xl text-surface-100 hover:text-accent-400 transition-colors truncate"
          >
            {character.name || <span className="italic text-surface-500 font-sans">Unnamed</span>}
          </button>
          <div className={`w-3 h-3 rounded-full ${priorityColors[character.priority] || 'bg-surface-600'}`} />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded ${
            character.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-surface-700 text-surface-400'
          }`}>
            {statusLabel}
          </span>
          {character.groups.length > 0 && (
            <span className="text-xs text-surface-500">
              {character.groups[0].name}
              {character.groups.length > 1 && ` +${character.groups.length - 1}`}
            </span>
          )}
        </div>

        <p className="text-sm text-surface-400 line-clamp-6 whitespace-pre-line">
          {seedExcerpt}
        </p>
      </div>

      {/* Pick button */}
      <button onClick={onPick} className="btn-primary w-full py-2.5 text-base mt-auto">
        Pick Winner
      </button>
    </div>
  )
}

export default TournamentView
