import type { BracketState, BracketNode } from '../../../shared/types'

interface TournamentBracketProps {
  bracket: BracketState
}

function TournamentBracket({ bracket }: TournamentBracketProps): JSX.Element {
  const { winners, losers, grandFinal, currentMatch, format } = bracket

  return (
    <div className="h-full overflow-auto p-6">
      {/* Winners Bracket */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">
          {format === 'double' ? 'Winners Bracket' : 'Bracket'}
        </h3>
        <div className="flex gap-6 items-start">
          {winners.map((round, roundIdx) => (
            <div key={roundIdx} className="flex flex-col gap-4" style={{ marginTop: roundIdx > 0 ? `${Math.pow(2, roundIdx) * 20}px` : 0 }}>
              <div className="text-xs text-surface-500 text-center mb-2">
                {roundIdx === winners.length - 1
                  ? (format === 'double' ? 'Winners Final' : 'Final')
                  : roundIdx === winners.length - 2
                  ? (format === 'double' ? 'Winners Semi' : 'Semi-Final')
                  : `Round ${roundIdx + 1}`}
              </div>
              {round.map((match, matchIdx) => (
                <BracketMatchNode
                  key={matchIdx}
                  match={match}
                  isCurrent={
                    currentMatch?.bracket === 'winners' &&
                    currentMatch.round === roundIdx + 1 &&
                    currentMatch.match === matchIdx
                  }
                  spacing={Math.pow(2, roundIdx) * 40}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Losers Bracket (double elimination only) */}
      {format === 'double' && losers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">
            Losers Bracket
          </h3>
          <div className="flex gap-6 items-start">
            {losers.map((round, roundIdx) => (
              <div key={roundIdx} className="flex flex-col gap-4">
                <div className="text-xs text-surface-500 text-center mb-2">
                  {roundIdx === losers.length - 1 ? 'Losers Final' : `Losers R${roundIdx + 1}`}
                </div>
                {round.map((match, matchIdx) => (
                  <BracketMatchNode
                    key={matchIdx}
                    match={match}
                    isCurrent={
                      currentMatch?.bracket === 'losers' &&
                      currentMatch.round === roundIdx + 1 &&
                      currentMatch.match === matchIdx
                    }
                    spacing={40}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand Final (double elimination only) */}
      {format === 'double' && grandFinal && (
        <div>
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">
            Grand Final
          </h3>
          <BracketMatchNode
            match={grandFinal}
            isCurrent={currentMatch?.bracket === 'grand_final'}
            spacing={40}
          />
        </div>
      )}
    </div>
  )
}

interface BracketMatchNodeProps {
  match: BracketNode
  isCurrent: boolean
  spacing: number
}

function BracketMatchNode({ match, isCurrent, spacing }: BracketMatchNodeProps): JSX.Element {
  const isComplete = match.winner !== null
  const isEmpty = !match.character1 && !match.character2

  return (
    <div
      className={`w-48 rounded-lg border-2 transition-all ${
        isCurrent
          ? 'border-accent-500 bg-accent-500/10 shadow-lg shadow-accent-500/20'
          : isComplete
          ? 'border-surface-700 bg-surface-800/50'
          : isEmpty
          ? 'border-surface-800 bg-surface-900'
          : 'border-surface-700 bg-surface-800'
      }`}
      style={{ marginBottom: spacing - 40 > 0 ? `${spacing - 40}px` : undefined }}
    >
      {/* Character 1 slot */}
      <div
        className={`px-3 py-2 border-b border-surface-700 flex items-center gap-2 ${
          match.winner?.id === match.character1?.id ? 'bg-green-500/10' : ''
        }`}
      >
        {match.character1 ? (
          <>
            <CharacterMini character={match.character1} />
            {match.winner?.id === match.character1.id && (
              <svg className="w-4 h-4 text-green-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </>
        ) : (
          <span className="text-xs text-surface-600 italic">TBD</span>
        )}
      </div>

      {/* Character 2 slot */}
      <div
        className={`px-3 py-2 flex items-center gap-2 ${
          match.winner?.id === match.character2?.id ? 'bg-green-500/10' : ''
        }`}
      >
        {match.character2 ? (
          <>
            <CharacterMini character={match.character2} />
            {match.winner?.id === match.character2.id && (
              <svg className="w-4 h-4 text-green-400 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </>
        ) : match.isBye ? (
          <span className="text-xs text-surface-600 italic">BYE</span>
        ) : (
          <span className="text-xs text-surface-600 italic">TBD</span>
        )}
      </div>
    </div>
  )
}

interface CharacterMiniProps {
  character: { id: number; name: string | null; cover_image?: { file_path: string } | null; images: { file_path: string }[] }
}

function CharacterMini({ character }: CharacterMiniProps): JSX.Element {
  const coverImage = character.cover_image || character.images[0]

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-6 h-6 rounded bg-surface-700 overflow-hidden shrink-0">
        {coverImage ? (
          <img
            src={`local-file://${encodeURIComponent(coverImage.file_path)}`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-surface-500">
            {character.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <span className="text-xs text-surface-200 truncate">
        {character.name || <span className="italic text-surface-500">Unnamed</span>}
      </span>
    </div>
  )
}

export default TournamentBracket
