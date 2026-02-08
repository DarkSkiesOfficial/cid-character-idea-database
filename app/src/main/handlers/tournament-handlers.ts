import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'
import type { Tournament, TournamentMatch, TournamentStatus } from '../../shared/types'

interface CreateTournamentData {
  name: string
  format: string
  filter_criteria?: string | null
}

interface SaveStateData {
  tournamentId: number
  matches: TournamentMatch[]
  status?: TournamentStatus
  winnerId?: number | null
}

export function registerTournamentHandlers(): void {
  // Create a new tournament
  ipcMain.handle(IPC.TOURNAMENT_CREATE, (_, data: CreateTournamentData) => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO tournaments (name, format, filter_criteria)
      VALUES (?, ?, ?)
    `)
    const result = stmt.run(data.name, data.format, data.filter_criteria ?? null)
    return result.lastInsertRowid as number
  })

  // Get a single tournament with its matches
  ipcMain.handle(IPC.TOURNAMENT_GET, (_, id: number) => {
    const db = getDb()
    const tournament = db.prepare(`
      SELECT * FROM tournaments WHERE id = ?
    `).get(id) as Tournament | undefined

    if (!tournament) return null

    const matches = db.prepare(`
      SELECT * FROM tournament_matches
      WHERE tournament_id = ?
      ORDER BY bracket, round, match_number
    `).all(id) as TournamentMatch[]

    return { ...tournament, matches }
  })

  // Get all tournaments (list view)
  ipcMain.handle(IPC.TOURNAMENT_GET_ALL, () => {
    const db = getDb()
    const tournaments = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = t.id AND character1_id IS NOT NULL) as match_count
      FROM tournaments t
      ORDER BY created_at DESC
    `).all() as (Tournament & { match_count: number })[]

    return tournaments
  })

  // Save tournament state (matches and optionally completion status)
  ipcMain.handle(IPC.TOURNAMENT_SAVE_STATE, (_, data: SaveStateData) => {
    const db = getDb()
    const { tournamentId, matches, status, winnerId } = data

    const deleteStmt = db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?')
    const insertStmt = db.prepare(`
      INSERT INTO tournament_matches
        (tournament_id, bracket, round, match_number, character1_id, character2_id, winner_id, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      // Clear existing matches
      deleteStmt.run(tournamentId)

      // Insert all matches
      for (const m of matches) {
        insertStmt.run(
          tournamentId,
          m.bracket,
          m.round,
          m.match_number,
          m.character1_id,
          m.character2_id,
          m.winner_id,
          m.completed_at
        )
      }

      // Update tournament status if provided
      if (status) {
        const updateStmt = db.prepare(`
          UPDATE tournaments
          SET status = ?,
              winner_id = ?,
              completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END
          WHERE id = ?
        `)
        updateStmt.run(status, winnerId ?? null, status, tournamentId)
      }
    })

    transaction()
    return true
  })

  // Delete a tournament
  ipcMain.handle(IPC.TOURNAMENT_DELETE, (_, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(id)
    return true
  })
}
