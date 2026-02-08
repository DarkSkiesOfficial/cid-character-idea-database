import { getDb } from './database'

// Tokenize text into normalized words for comparison
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2) // skip tiny words like "a", "is", "of"
  )
}

// Jaccard similarity: size of intersection / size of union
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const word of a) {
    if (b.has(word)) intersection++
  }

  const union = a.size + b.size - intersection
  return intersection / union
}

export interface DuplicateMatch {
  id: number
  name: string | null
  similarity: number
  preview: string
}

// Check incoming text against all existing characters
// Returns matches above the threshold, sorted by similarity descending
export function checkForDuplicates(seedText: string, threshold: number = 0.6): DuplicateMatch[] {
  const db = getDb()
  const incoming = tokenize(seedText)

  if (incoming.size < 3) return [] // too short to meaningfully compare

  const existing = db.prepare('SELECT id, name, seed_text FROM characters').all() as {
    id: number
    name: string | null
    seed_text: string
  }[]

  const matches: DuplicateMatch[] = []

  for (const char of existing) {
    const charTokens = tokenize(char.seed_text)
    const similarity = jaccardSimilarity(incoming, charTokens)

    if (similarity >= threshold) {
      matches.push({
        id: char.id,
        name: char.name,
        similarity: Math.round(similarity * 100),
        preview: char.seed_text.substring(0, 150).replace(/\s+/g, ' ')
      })
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity)
}
