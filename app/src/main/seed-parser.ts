import { readFileSync } from 'fs'
import type { ParsedSeed } from '../shared/types'

const SEPARATOR = /^-{3,}\s*$/m

// Only match explicit "Name:" fields — don't guess from headers or numbered lines
const NAME_PATTERNS = [
  /\*\*Name:\*\*\s*(.+)/i,
  /Name:\s*(.+)/i
]

function extractName(text: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      let name = match[1].trim()
      // Clean up markdown formatting and surrounding quotes/parens
      name = name.replace(/\*+/g, '').replace(/\\+/g, '').trim()
      // Remove emoji and parenthetical descriptions from name
      name = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
      // If the name has a parenthetical like 'Evie Park ("The Teacher's Pet...")', keep just the core name
      const parenMatch = name.match(/^([^(]+)\s*\(/)
      if (parenMatch) {
        name = parenMatch[1].trim()
      }
      if (name.length > 0 && name.length < 100) {
        return name
      }
    }
  }
  return null
}

function shouldFlag(text: string, allLengths: number[]): { flagged: boolean; reason: string | null } {
  const trimmed = text.trim()
  const lineCount = trimmed.split('\n').length

  if (lineCount <= 1 && trimmed.length < 30) {
    return { flagged: true, reason: 'Very short entry — might be a fragment or leftover separator text' }
  }

  if (allLengths.length > 2) {
    const avg = allLengths.reduce((a, b) => a + b, 0) / allLengths.length
    if (trimmed.length > avg * 3) {
      return { flagged: true, reason: 'Unusually long — might contain multiple character ideas' }
    }
  }

  const separatorLike = trimmed.match(/={3,}/g)
  if (separatorLike && separatorLike.length >= 2) {
    return { flagged: true, reason: 'Contains internal separators — might be multiple entries' }
  }

  return { flagged: false, reason: null }
}

export function parseSeedFile(filePath: string): ParsedSeed[] {
  const content = readFileSync(filePath, 'utf-8')
  const chunks = content.split(SEPARATOR)

  const entries: string[] = []
  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (trimmed.length > 0) {
      entries.push(trimmed)
    }
  }

  const lengths = entries.map((e) => e.length)

  return entries.map((text, index) => {
    const { flagged, reason } = shouldFlag(text, lengths)
    return {
      index,
      raw_text: text,
      detected_name: extractName(text),
      flagged,
      flag_reason: reason
    }
  })
}
