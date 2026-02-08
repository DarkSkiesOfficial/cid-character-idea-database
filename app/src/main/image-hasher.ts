import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { nativeImage } from 'electron'

/**
 * Computes a SHA-256 hash of the file's raw bytes.
 * Catches exact duplicates (identical files, even if renamed).
 */
export function computeByteHash(filePath: string): string {
  const buffer = readFileSync(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Computes a perceptual hash using a blockhash-style algorithm.
 * Catches visually similar images (resized, recompressed, slightly cropped).
 *
 * Resizes to 16x16 grayscale, then compares each pixel to the mean
 * to produce a 256-bit hash stored as 64 hex chars.
 */
export function computePerceptualHash(filePath: string): string | null {
  try {
    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) return null

    // Resize to 16x16 for consistent hashing
    const resized = img.resize({ width: 16, height: 16, quality: 'good' })
    const bitmap = resized.toBitmap()
    const size = resized.getSize()

    // Convert to grayscale values
    const pixels: number[] = []
    for (let i = 0; i < size.width * size.height; i++) {
      const offset = i * 4 // BGRA format
      const b = bitmap[offset]
      const g = bitmap[offset + 1]
      const r = bitmap[offset + 2]
      // Standard luminance formula
      pixels.push(0.299 * r + 0.587 * g + 0.114 * b)
    }

    // Compute mean brightness
    const mean = pixels.reduce((sum, val) => sum + val, 0) / pixels.length

    // Build hash: each bit is 1 if pixel >= mean, 0 otherwise
    let hashBits = ''
    for (const px of pixels) {
      hashBits += px >= mean ? '1' : '0'
    }

    // Convert binary string to hex
    let hex = ''
    for (let i = 0; i < hashBits.length; i += 4) {
      hex += parseInt(hashBits.substring(i, i + 4), 2).toString(16)
    }

    return hex
  } catch {
    return null
  }
}

/**
 * Gets image dimensions via nativeImage.
 */
export function getImageDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) return null
    return img.getSize()
  } catch {
    return null
  }
}

/**
 * Computes hamming distance between two hex hash strings.
 * Returns a similarity ratio from 0.0 (completely different) to 1.0 (identical).
 */
export function hashSimilarity(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return 0

  // Convert hex to binary and count differing bits
  let diffBits = 0
  const totalBits = hashA.length * 4

  for (let i = 0; i < hashA.length; i++) {
    const a = parseInt(hashA[i], 16)
    const b = parseInt(hashB[i], 16)
    let xor = a ^ b
    while (xor > 0) {
      diffBits += xor & 1
      xor >>= 1
    }
  }

  return 1 - diffBits / totalBits
}
