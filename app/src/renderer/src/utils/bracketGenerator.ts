import type {
  CharacterWithDetails,
  BracketNode,
  BracketState,
  BracketType,
  TournamentFormat,
  TournamentMatch
} from '../../../shared/types'

export interface BracketGeneratorOptions {
  characters: CharacterWithDetails[]
  format: TournamentFormat
  shuffle: boolean
}

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function createEmptyNode(bracket: BracketType, round: number, matchNumber: number): BracketNode {
  return {
    bracket,
    round,
    matchNumber,
    character1: null,
    character2: null,
    winner: null,
    isBye: false
  }
}

function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

export function generateBracket(options: BracketGeneratorOptions): BracketState {
  const { format, shuffle } = options
  let chars = [...options.characters]

  if (chars.length < 2) {
    throw new Error('Tournament requires at least 2 characters')
  }

  if (shuffle) {
    chars = shuffleArray(chars)
  }

  // Pad to next power of 2
  const bracketSize = nextPowerOf2(chars.length)
  const totalWinnersRounds = Math.log2(bracketSize)

  // Build winners bracket first round
  const winnersFirstRound: BracketNode[] = []
  for (let i = 0; i < bracketSize / 2; i++) {
    const char1 = chars[i * 2] ?? null
    const char2 = chars[i * 2 + 1] ?? null
    const isBye = !char1 || !char2

    winnersFirstRound.push({
      bracket: 'winners',
      round: 1,
      matchNumber: i,
      character1: char1,
      character2: char2,
      winner: isBye ? (char1 || char2) : null,
      isBye
    })
  }

  // Build remaining winners rounds (empty)
  const winners: BracketNode[][] = [winnersFirstRound]
  for (let r = 2; r <= totalWinnersRounds; r++) {
    const roundSize = Math.pow(2, totalWinnersRounds - r)
    const roundNodes: BracketNode[] = []
    for (let m = 0; m < roundSize; m++) {
      roundNodes.push(createEmptyNode('winners', r, m))
    }
    winners.push(roundNodes)
  }

  // Propagate bye winners forward through winners bracket
  propagateWinners(winners)

  // Build losers bracket for double elimination
  let losers: BracketNode[][] = []
  let grandFinal: BracketNode | null = null
  let totalLosersRounds = 0

  if (format === 'double') {
    // Double elimination losers bracket has (totalWinnersRounds - 1) * 2 rounds
    // Each winners round drops losers into the losers bracket
    totalLosersRounds = (totalWinnersRounds - 1) * 2

    // First losers round receives losers from winners round 1
    // Subsequent rounds alternate between:
    // - "minor" rounds (losers vs losers from previous losers round)
    // - "major" rounds (losers bracket survivors vs new drop-downs from winners)

    for (let lr = 1; lr <= totalLosersRounds; lr++) {
      // Losers round size depends on which type of round it is
      // Minor rounds (odd) halve from previous losers round
      // Major rounds (even) stay same size but receive drop-downs
      let roundSize: number

      if (lr === 1) {
        // First losers round: half of first winners round losers
        roundSize = Math.pow(2, totalWinnersRounds - 2)
      } else if (lr % 2 === 0) {
        // Major round: same size as previous
        roundSize = losers[lr - 2].length
      } else {
        // Minor round: halve from previous
        roundSize = losers[lr - 2].length / 2
      }

      const roundNodes: BracketNode[] = []
      for (let m = 0; m < roundSize; m++) {
        roundNodes.push(createEmptyNode('losers', lr, m))
      }
      losers.push(roundNodes)
    }

    // Grand final
    grandFinal = createEmptyNode('grand_final', 1, 0)
  }

  // Find first playable match
  const currentMatch = findNextMatch({ winners, losers, grandFinal, currentMatch: null, totalWinnersRounds, totalLosersRounds, format, isComplete: false, champion: null })

  return {
    winners,
    losers,
    grandFinal,
    currentMatch,
    totalWinnersRounds,
    totalLosersRounds,
    format,
    isComplete: false,
    champion: null
  }
}

function propagateWinners(winners: BracketNode[][]): void {
  // Track which matches are "dead" — no participants, will never produce a winner.
  // A first-round match is dead if both characters are null.
  // A later-round match is dead if both its feeder matches are dead.
  // Only auto-resolve a bye when the opposing feeder is dead (not just unplayed).
  const isDead: boolean[][] = winners.map(round => round.map(() => false))

  for (let m = 0; m < winners[0].length; m++) {
    if (!winners[0][m].character1 && !winners[0][m].character2) {
      isDead[0][m] = true
    }
  }

  for (let round = 0; round < winners.length - 1; round++) {
    // Place winners from resolved matches into their next-round slots
    for (let match = 0; match < winners[round].length; match++) {
      const node = winners[round][match]
      if (node.winner) {
        const nextMatch = winners[round + 1][Math.floor(match / 2)]
        if (match % 2 === 0) {
          nextMatch.character1 = node.winner
        } else {
          nextMatch.character2 = node.winner
        }
      }
    }

    // Now check each next-round match for byes or dead status
    for (let m = 0; m < winners[round + 1].length; m++) {
      const nextMatch = winners[round + 1][m]
      const feeder1Dead = isDead[round][m * 2]
      const feeder2Dead = (m * 2 + 1 < isDead[round].length) ? isDead[round][m * 2 + 1] : true

      if (feeder1Dead && feeder2Dead) {
        isDead[round + 1][m] = true
      } else if (feeder2Dead && nextMatch.character1 && !nextMatch.character2 && !nextMatch.winner) {
        nextMatch.winner = nextMatch.character1
        nextMatch.isBye = true
      } else if (feeder1Dead && !nextMatch.character1 && nextMatch.character2 && !nextMatch.winner) {
        nextMatch.winner = nextMatch.character2
        nextMatch.isBye = true
      }
    }
  }
}

export function advanceWinner(
  state: BracketState,
  bracket: BracketType,
  round: number,
  matchNumber: number,
  winner: CharacterWithDetails
): BracketState {
  // Deep clone the state
  const newState: BracketState = {
    ...state,
    winners: state.winners.map(r => r.map(m => ({ ...m }))),
    losers: state.losers.map(r => r.map(m => ({ ...m }))),
    grandFinal: state.grandFinal ? { ...state.grandFinal } : null
  }

  let match: BracketNode | null = null
  let loser: CharacterWithDetails | null = null

  if (bracket === 'winners') {
    match = newState.winners[round - 1][matchNumber]
  } else if (bracket === 'losers') {
    match = newState.losers[round - 1][matchNumber]
  } else if (bracket === 'grand_final' && newState.grandFinal) {
    match = newState.grandFinal
  }

  if (!match) return state

  // Determine the loser
  loser = match.character1?.id === winner.id ? match.character2 : match.character1

  // Set winner
  match.winner = winner

  // Advance winner to next match
  if (bracket === 'winners') {
    if (round < newState.totalWinnersRounds) {
      // Advance to next winners round
      const nextMatch = newState.winners[round][Math.floor(matchNumber / 2)]
      if (matchNumber % 2 === 0) {
        nextMatch.character1 = winner
      } else {
        nextMatch.character2 = winner
      }
    } else if (state.format === 'single') {
      // Single elimination: winners final winner is champion
      newState.champion = winner
      newState.isComplete = true
    } else {
      // Double elimination: winners final winner goes to grand final
      if (newState.grandFinal) {
        newState.grandFinal.character1 = winner
      }
    }

    // In double elim, drop loser to losers bracket
    if (state.format === 'double' && loser && round <= newState.totalWinnersRounds) {
      dropToLosersBracket(newState, round, matchNumber, loser)
    }
  } else if (bracket === 'losers') {
    if (round < newState.totalLosersRounds) {
      // Advance in losers bracket
      // Losers bracket has alternating structure:
      // - Odd rounds (1, 3, 5...): receive dropdowns, match winners advance to next round same position
      // - Even rounds (2, 4, 6...): internal matches, winners advance with halved position

      const nextRoundIdx = round // array is 0-indexed, round is 1-indexed, so nextRound = round (not round+1)
      let nextMatchNum: number

      if (round % 2 === 1) {
        // Odd round: advance to next round at same match position
        nextMatchNum = matchNumber
      } else {
        // Even round: advance to next round at halved position
        nextMatchNum = Math.floor(matchNumber / 2)
      }

      if (newState.losers[nextRoundIdx]) {
        const nextMatch = newState.losers[nextRoundIdx][nextMatchNum]
        if (nextMatch) {
          // Fill the appropriate slot
          if (!nextMatch.character1) {
            nextMatch.character1 = winner
          } else if (!nextMatch.character2) {
            nextMatch.character2 = winner
          }
        }
      }
    } else {
      // Losers final winner goes to grand final
      if (newState.grandFinal) {
        newState.grandFinal.character2 = winner
      }
    }
  } else if (bracket === 'grand_final') {
    // Grand final winner is champion
    // In true double elim, if the losers bracket winner wins, there's a bracket reset
    // For simplicity, we'll do single grand final
    newState.champion = winner
    newState.isComplete = true
  }

  // Find next match
  newState.currentMatch = findNextMatch(newState)

  return newState
}

function checkAndResolveBye(match: BracketNode): void {
  if (match.character1 && !match.character2 && !match.winner) {
    match.winner = match.character1
    match.isBye = true
  } else if (!match.character1 && match.character2 && !match.winner) {
    match.winner = match.character2
    match.isBye = true
  }
}

function dropToLosersBracket(
  state: BracketState,
  winnersRound: number,
  matchNumber: number,
  loser: CharacterWithDetails
): void {
  // Determine which losers round this goes to
  // Winners round 1 losers go to losers round 1
  // Winners round 2 losers go to losers round 2 (major round)
  // etc.

  let losersRound: number
  if (winnersRound === 1) {
    losersRound = 1
  } else {
    // Winners round N goes to losers round 2*(N-1)
    losersRound = 2 * (winnersRound - 1)
  }

  if (losersRound > state.totalLosersRounds) return
  if (!state.losers[losersRound - 1]) return

  // Find a slot in that losers round
  const losersRoundMatches = state.losers[losersRound - 1]
  const targetMatch = Math.floor(matchNumber / (winnersRound === 1 ? 2 : 1))

  if (targetMatch < losersRoundMatches.length) {
    const match = losersRoundMatches[targetMatch]
    if (!match.character1) {
      match.character1 = loser
    } else if (!match.character2) {
      match.character2 = loser
    }
    checkAndResolveBye(match)
  }
}

export function findNextMatch(state: BracketState): { bracket: BracketType; round: number; match: number } | null {
  // Check winners bracket first
  for (let r = 0; r < state.winners.length; r++) {
    for (let m = 0; m < state.winners[r].length; m++) {
      const match = state.winners[r][m]
      if (match.character1 && match.character2 && !match.winner && !match.isBye) {
        return { bracket: 'winners', round: r + 1, match: m }
      }
    }
  }

  // Then losers bracket
  for (let r = 0; r < state.losers.length; r++) {
    for (let m = 0; m < state.losers[r].length; m++) {
      const match = state.losers[r][m]
      if (match.character1 && match.character2 && !match.winner && !match.isBye) {
        return { bracket: 'losers', round: r + 1, match: m }
      }
    }
  }

  // Finally grand final
  if (state.grandFinal && state.grandFinal.character1 && state.grandFinal.character2 && !state.grandFinal.winner) {
    return { bracket: 'grand_final', round: 1, match: 0 }
  }

  return null
}

// Serialize bracket state to TournamentMatch[] for DB storage
export function serializeToMatches(state: BracketState, tournamentId?: number): TournamentMatch[] {
  const matches: TournamentMatch[] = []

  // Winners bracket
  for (let r = 0; r < state.winners.length; r++) {
    for (const node of state.winners[r]) {
      matches.push({
        tournament_id: tournamentId,
        bracket: 'winners',
        round: node.round,
        match_number: node.matchNumber,
        character1_id: node.character1?.id ?? null,
        character2_id: node.character2?.id ?? null,
        winner_id: node.winner?.id ?? null,
        completed_at: node.winner ? new Date().toISOString() : null
      })
    }
  }

  // Losers bracket
  for (let r = 0; r < state.losers.length; r++) {
    for (const node of state.losers[r]) {
      matches.push({
        tournament_id: tournamentId,
        bracket: 'losers',
        round: node.round,
        match_number: node.matchNumber,
        character1_id: node.character1?.id ?? null,
        character2_id: node.character2?.id ?? null,
        winner_id: node.winner?.id ?? null,
        completed_at: node.winner ? new Date().toISOString() : null
      })
    }
  }

  // Grand final
  if (state.grandFinal) {
    matches.push({
      tournament_id: tournamentId,
      bracket: 'grand_final',
      round: 1,
      match_number: 0,
      character1_id: state.grandFinal.character1?.id ?? null,
      character2_id: state.grandFinal.character2?.id ?? null,
      winner_id: state.grandFinal.winner?.id ?? null,
      completed_at: state.grandFinal.winner ? new Date().toISOString() : null
    })
  }

  return matches
}

// Rehydrate bracket state from saved matches
export function rehydrateFromMatches(
  matches: TournamentMatch[],
  characterMap: Map<number, CharacterWithDetails>,
  format: TournamentFormat
): BracketState {
  const getChar = (id: number | null) => id ? characterMap.get(id) ?? null : null

  // Group matches by bracket
  const winnersMatches = matches.filter(m => m.bracket === 'winners')
  const losersMatches = matches.filter(m => m.bracket === 'losers')
  const grandFinalMatch = matches.find(m => m.bracket === 'grand_final')

  // Determine bracket size from winners matches
  const maxWinnersRound = Math.max(...winnersMatches.map(m => m.round), 1)
  const totalWinnersRounds = maxWinnersRound
  const totalLosersRounds = format === 'double' ? (totalWinnersRounds - 1) * 2 : 0

  // Rebuild winners bracket
  const winners: BracketNode[][] = []
  for (let r = 1; r <= totalWinnersRounds; r++) {
    const roundMatches = winnersMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number)
    winners.push(roundMatches.map(m => ({
      bracket: 'winners' as BracketType,
      round: m.round,
      matchNumber: m.match_number,
      character1: getChar(m.character1_id),
      character2: getChar(m.character2_id),
      winner: getChar(m.winner_id),
      isBye: (!m.character1_id || !m.character2_id) && m.winner_id !== null
    })))
  }

  // Rebuild losers bracket
  const losers: BracketNode[][] = []
  if (format === 'double') {
    for (let r = 1; r <= totalLosersRounds; r++) {
      const roundMatches = losersMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number)
      losers.push(roundMatches.map(m => ({
        bracket: 'losers' as BracketType,
        round: m.round,
        matchNumber: m.match_number,
        character1: getChar(m.character1_id),
        character2: getChar(m.character2_id),
        winner: getChar(m.winner_id),
        isBye: false
      })))
    }
  }

  // Grand final
  let grandFinal: BracketNode | null = null
  if (grandFinalMatch) {
    grandFinal = {
      bracket: 'grand_final',
      round: 1,
      matchNumber: 0,
      character1: getChar(grandFinalMatch.character1_id),
      character2: getChar(grandFinalMatch.character2_id),
      winner: getChar(grandFinalMatch.winner_id),
      isBye: false
    }
  }

  // Determine completion and champion
  let isComplete = false
  let champion: CharacterWithDetails | null = null

  if (format === 'single') {
    const finalMatch = winners[winners.length - 1]?.[0]
    if (finalMatch?.winner) {
      isComplete = true
      champion = finalMatch.winner
    }
  } else if (grandFinal?.winner) {
    isComplete = true
    champion = grandFinal.winner
  }

  const state: BracketState = {
    winners,
    losers,
    grandFinal,
    currentMatch: null,
    totalWinnersRounds,
    totalLosersRounds,
    format,
    isComplete,
    champion
  }

  state.currentMatch = findNextMatch(state)
  return state
}

// Utility: get bracket info string
export function getBracketInfo(charCount: number): { bracketSize: number; rounds: number; byes: number } {
  const bracketSize = nextPowerOf2(charCount)
  const rounds = Math.log2(bracketSize)
  const byes = bracketSize - charCount
  return { bracketSize, rounds, byes }
}

// Get all participants sorted by final placement
export function getFinalRankings(state: BracketState): CharacterWithDetails[] {
  const rankings: CharacterWithDetails[] = []

  if (state.champion) {
    rankings.push(state.champion)
  }

  if (state.format === 'single') {
    // Single elim: trace back through bracket
    // Second place is whoever lost to the champion in the final
    const finalMatch = state.winners[state.winners.length - 1]?.[0]
    if (finalMatch) {
      const runnerUp = finalMatch.character1?.id === state.champion?.id
        ? finalMatch.character2
        : finalMatch.character1
      if (runnerUp) rankings.push(runnerUp)
    }

    // Semi-final losers tie for 3rd/4th
    if (state.winners.length >= 2) {
      const semis = state.winners[state.winners.length - 2]
      for (const match of semis) {
        if (match.winner && match.character1 && match.character2) {
          const loser = match.winner.id === match.character1.id ? match.character2 : match.character1
          if (loser && !rankings.some(r => r.id === loser.id)) {
            rankings.push(loser)
          }
        }
      }
    }
  } else {
    // Double elim: runner-up is grand final loser
    if (state.grandFinal) {
      const runnerUp = state.grandFinal.character1?.id === state.champion?.id
        ? state.grandFinal.character2
        : state.grandFinal.character1
      if (runnerUp) rankings.push(runnerUp)
    }
  }

  return rankings
}
