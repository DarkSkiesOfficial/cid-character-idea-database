import { ipcMain } from 'electron'
import { getDb } from '../database'
import { IPC } from '../../shared/ipc-channels'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall',
  'must', 'can', 'need', 'dare', 'ought', 'used', 'not', 'no', 'nor', 'so', 'yet',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too',
  'very', 'just', 'only', 'also', 'own', 'same', 'that', 'this', 'these', 'those',
  'then', 'there', 'here', 'when', 'where', 'why', 'how', 'what', 'which', 'who',
  'whom', 'whose', 'all', 'any', 'every', 'much', 'many', 'another', 'either',
  'neither', 'enough', 'several', 'about', 'above', 'across', 'after', 'against',
  'along', 'among', 'around', 'before', 'behind', 'below', 'beneath', 'beside',
  'between', 'beyond', 'during', 'except', 'inside', 'into', 'like', 'near',
  'off', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'toward',
  'towards', 'under', 'until', 'upon', 'within', 'without', 'again', 'already',
  'always', 'away', 'back', 'even', 'ever', 'far', 'first', 'get', 'got',
  'goes', 'going', 'gone', 'good', 'great', 'her', 'hers', 'herself', 'him',
  'himself', 'his', 'its', 'itself', 'let', 'lets', 'made', 'make', 'makes',
  'making', 'me', 'mine', 'myself', 'my', 'new', 'now', 'old', 'one', 'ones',
  'our', 'ours', 'ourselves', 'put', 'quite', 'really', 'right', 'said', 'say',
  'says', 'she', 'still', 'take', 'takes', 'taken', 'tell', 'tells', 'them',
  'themselves', 'they', 'thing', 'things', 'think', 'though', 'thought', 'thus',
  'together', 'told', 'two', 'us', 'use', 'using', 'want', 'wants', 'way',
  'well', 'went', 'while', 'will', 'with', 'work', 'works', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'we', 'he', 'it', 'i', 'if',
  'up', 'down', 'left', 'right', 'come', 'came', 'being', 'been', 'having',
  'doing', 'done', 'able', 'being', 'been', 'become', 'became',
  // Markdown / URL artifacts
  'http', 'https', 'www', 'jpg', 'png', 'gif', 'svg', 'webp', 'com', 'org', 'net',
  'img', 'src', 'alt', 'href', 'html', 'css', 'pdf', 'file'
])

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractWords(
  rows: { id: number; seed_text: string }[]
): Map<string, Set<number>> {
  const wordMap = new Map<string, Set<number>>()

  for (const { id, seed_text } of rows) {
    const cleaned = seed_text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/[*#>`~_\[\](){}|\\]/g, ' ')
      .replace(/\b\d+\b/g, '')

    const tokens = cleaned.toLowerCase().split(/[\s,;:.!?\-/]+/)

    for (const raw of tokens) {
      const word = raw.replace(/^['"]+|['"]+$/g, '').trim()
      if (word.length < 3) continue
      if (STOP_WORDS.has(word)) continue

      if (!wordMap.has(word)) wordMap.set(word, new Set())
      wordMap.get(word)!.add(id)
    }
  }

  return wordMap
}

interface CloudTagRow {
  id: number
  word: string
  status: string
  merged_into: number | null
  tag_id: number | null
  match_count: number
  created_at: string
}

export function registerWordCloudHandlers(): void {
  // Extract words from all seed texts, cross-reference with cloud_tags for stored decisions
  ipcMain.handle(IPC.CLOUD_EXTRACT_WORDS, () => {
    const db = getDb()
    const rows = db.prepare('SELECT id, seed_text FROM characters').all() as {
      id: number
      seed_text: string
    }[]

    const wordMap = extractWords(rows)

    // Load all cloud_tags for cross-referencing
    const cloudTags = db.prepare('SELECT * FROM cloud_tags').all() as CloudTagRow[]
    const cloudByWord = new Map<string, CloudTagRow>()
    const mergedInto = new Map<number, number>() // id -> target id
    for (const ct of cloudTags) {
      cloudByWord.set(ct.word.toLowerCase(), ct)
      if (ct.merged_into !== null) {
        mergedInto.set(ct.id, ct.merged_into)
      }
    }

    // Scan for user-added phrases (multi-word entries in cloud_tags)
    const phrases = cloudTags.filter(
      (ct) => ct.word.includes(' ') && ct.status !== 'hidden'
    )
    for (const phrase of phrases) {
      const regex = new RegExp(escapeRegex(phrase.word), 'gi')
      const charIds = new Set<number>()
      for (const { id, seed_text } of rows) {
        if (regex.test(seed_text)) charIds.add(id)
      }
      if (charIds.size > 0) {
        wordMap.set(phrase.word.toLowerCase(), charIds)
      }
    }

    // Build merge target map (word -> target word) for folding counts
    const mergeTargetWord = new Map<string, string>()
    for (const ct of cloudTags) {
      if (ct.merged_into !== null) {
        const target = cloudTags.find((t) => t.id === ct.merged_into)
        if (target) {
          mergeTargetWord.set(ct.word.toLowerCase(), target.word.toLowerCase())
        }
      }
    }

    // Fold merged word counts into their targets
    for (const [sourceWord, targetWord] of mergeTargetWord) {
      const sourceIds = wordMap.get(sourceWord)
      if (sourceIds) {
        if (!wordMap.has(targetWord)) wordMap.set(targetWord, new Set())
        const targetIds = wordMap.get(targetWord)!
        for (const id of sourceIds) targetIds.add(id)
        wordMap.delete(sourceWord)
      }
    }

    // Update match_count for known cloud_tags
    const updateCount = db.prepare(
      'UPDATE cloud_tags SET match_count = ? WHERE id = ?'
    )
    const updateMany = db.transaction(() => {
      for (const ct of cloudTags) {
        const ids = wordMap.get(ct.word.toLowerCase())
        const count = ids ? ids.size : 0
        if (count !== ct.match_count) {
          updateCount.run(count, ct.id)
        }
      }
    })
    updateMany()

    // Build result array
    const results: {
      word: string
      count: number
      characterIds: number[]
      cloud_tag_id: number | null
      status: string | null
    }[] = []

    for (const [word, charIds] of wordMap) {
      const ct = cloudByWord.get(word)

      // Skip hidden words and merged-away words
      if (ct && ct.status === 'hidden') continue
      if (ct && ct.merged_into !== null) continue

      results.push({
        word,
        count: charIds.size,
        characterIds: Array.from(charIds),
        cloud_tag_id: ct ? ct.id : null,
        status: ct ? ct.status : null
      })
    }

    // Sort by count desc, cap at 500
    results.sort((a, b) => b.count - a.count)
    return results.slice(0, 500)
  })

  // Get all cloud_tags (for manage views)
  ipcMain.handle(IPC.CLOUD_GET_ALL, () => {
    const db = getDb()
    return db
      .prepare('SELECT * FROM cloud_tags ORDER BY status, match_count DESC')
      .all()
  })

  // Accept a word: create tag, auto-apply to matching characters
  ipcMain.handle(IPC.CLOUD_ACCEPT_WORD, (_, word: string) => {
    const db = getDb()
    const trimmed = word.trim().toLowerCase()
    if (!trimmed) return { error: 'Word cannot be empty' }

    // Find all characters whose seed text contains this word
    const isPhrase = trimmed.includes(' ')
    let matchingIds: number[]

    if (isPhrase) {
      // Phrase: substring match
      matchingIds = (
        db
          .prepare(
            "SELECT id FROM characters WHERE seed_text LIKE '%' || ? || '%' COLLATE NOCASE"
          )
          .all(trimmed) as { id: number }[]
      ).map((r) => r.id)
    } else {
      // Single word: use word-boundary-aware matching
      const allRows = db
        .prepare('SELECT id, seed_text FROM characters')
        .all() as { id: number; seed_text: string }[]
      const regex = new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'i')
      matchingIds = allRows
        .filter((r) => regex.test(r.seed_text))
        .map((r) => r.id)
    }

    const result = db.transaction(() => {
      // Upsert into cloud_tags
      db.prepare(
        `INSERT INTO cloud_tags (word, status, match_count)
         VALUES (?, 'accepted', ?)
         ON CONFLICT(word) DO UPDATE SET status = 'accepted', match_count = ?`
      ).run(trimmed, matchingIds.length, matchingIds.length)

      // Create the real tag
      db.prepare(
        'INSERT OR IGNORE INTO tags (name, category) VALUES (?, NULL)'
      ).run(trimmed)
      const tag = db
        .prepare('SELECT id FROM tags WHERE name = ?')
        .get(trimmed) as { id: number }

      // Apply tag to all matching characters
      const insertCT = db.prepare(
        'INSERT OR IGNORE INTO character_tags (character_id, tag_id) VALUES (?, ?)'
      )
      for (const cid of matchingIds) {
        insertCT.run(cid, tag.id)
      }

      // Store tag_id in cloud_tags
      db.prepare('UPDATE cloud_tags SET tag_id = ? WHERE word = ?').run(
        tag.id,
        trimmed
      )

      return { tagId: tag.id, matchCount: matchingIds.length, characterIds: matchingIds }
    })()

    return result
  })

  // Hide a word from the cloud
  ipcMain.handle(IPC.CLOUD_HIDE_WORD, (_, word: string) => {
    const db = getDb()
    const trimmed = word.trim().toLowerCase()
    if (!trimmed) return false

    db.prepare(
      `INSERT INTO cloud_tags (word, status, match_count)
       VALUES (?, 'hidden', 0)
       ON CONFLICT(word) DO UPDATE SET status = 'hidden'`
    ).run(trimmed)

    return true
  })

  // Unhide a word (restore to pending)
  ipcMain.handle(IPC.CLOUD_UNHIDE_WORD, (_, id: number) => {
    const db = getDb()
    db.prepare(
      "UPDATE cloud_tags SET status = 'pending', merged_into = NULL WHERE id = ?"
    ).run(id)
    return true
  })

  // Combine two words: source merges into target
  ipcMain.handle(
    IPC.CLOUD_COMBINE_WORDS,
    (_, sourceWord: string, targetWord: string) => {
      const db = getDb()
      const src = sourceWord.trim().toLowerCase()
      const tgt = targetWord.trim().toLowerCase()
      if (!src || !tgt || src === tgt) return { error: 'Invalid combine' }

      const result = db.transaction(() => {
        // Ensure both exist in cloud_tags
        db.prepare(
          `INSERT INTO cloud_tags (word, status, match_count)
           VALUES (?, 'pending', 0)
           ON CONFLICT(word) DO NOTHING`
        ).run(src)
        db.prepare(
          `INSERT INTO cloud_tags (word, status, match_count)
           VALUES (?, 'pending', 0)
           ON CONFLICT(word) DO NOTHING`
        ).run(tgt)

        const sourceRow = db
          .prepare('SELECT * FROM cloud_tags WHERE word = ?')
          .get(src) as CloudTagRow
        const targetRow = db
          .prepare('SELECT * FROM cloud_tags WHERE word = ?')
          .get(tgt) as CloudTagRow

        // Mark source as hidden + merged
        db.prepare(
          "UPDATE cloud_tags SET status = 'hidden', merged_into = ? WHERE id = ?"
        ).run(targetRow.id, sourceRow.id)

        // If both were accepted as real tags, merge them
        if (sourceRow.tag_id && targetRow.tag_id) {
          // Reuse the merge pattern from tag-handlers
          db.prepare(
            'INSERT OR IGNORE INTO character_tags (character_id, tag_id) SELECT character_id, ? FROM character_tags WHERE tag_id = ?'
          ).run(targetRow.tag_id, sourceRow.tag_id)
          db.prepare('DELETE FROM character_tags WHERE tag_id = ?').run(
            sourceRow.tag_id
          )
          db.prepare('DELETE FROM tags WHERE id = ?').run(sourceRow.tag_id)
          db.prepare(
            'UPDATE cloud_tags SET tag_id = NULL WHERE id = ?'
          ).run(sourceRow.id)
        }

        return targetRow
      })()

      return result
    }
  )

  // Add a custom phrase and count matches
  ipcMain.handle(IPC.CLOUD_ADD_PHRASE, (_, phrase: string) => {
    const db = getDb()
    const trimmed = phrase.trim().toLowerCase()
    if (!trimmed) return { error: 'Phrase cannot be empty' }

    // Count matches
    const count = (
      db
        .prepare(
          "SELECT COUNT(*) as cnt FROM characters WHERE seed_text LIKE '%' || ? || '%' COLLATE NOCASE"
        )
        .get(trimmed) as { cnt: number }
    ).cnt

    // Upsert into cloud_tags
    db.prepare(
      `INSERT INTO cloud_tags (word, status, match_count)
       VALUES (?, 'pending', ?)
       ON CONFLICT(word) DO UPDATE SET match_count = ?`
    ).run(trimmed, count, count)

    const row = db
      .prepare('SELECT * FROM cloud_tags WHERE word = ?')
      .get(trimmed) as CloudTagRow

    return row
  })

  // Reset a word back to pending
  ipcMain.handle(IPC.CLOUD_RESET_WORD, (_, id: number) => {
    const db = getDb()
    db.prepare(
      "UPDATE cloud_tags SET status = 'pending', merged_into = NULL WHERE id = ?"
    ).run(id)
    return true
  })
}
