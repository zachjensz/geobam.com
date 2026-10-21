export type NamedItem = {
  id: string
  name: string
  aliases: string[]
}

export function normalizeAnswer(answer: string) {
  return answer
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Two row buffers reused across every editDistance call. The DP recurrence
// only needs the previous row, so allocating one row pair at module level
// (grown on demand) avoids allocating fresh arrays for every candidate on
// every typed submit.
let previousRow: number[] = []
let currentRow: number[] = []

export function editDistance(first: string, second: string) {
  const secondLength = second.length
  if (previousRow.length <= secondLength) {
    previousRow = new Array(secondLength + 1)
    currentRow = new Array(secondLength + 1)
  }
  for (let index = 0; index <= secondLength; index += 1) {
    previousRow[index] = index
  }

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    currentRow[0] = firstIndex
    const firstCharacter = first[firstIndex - 1]
    for (let secondIndex = 1; secondIndex <= secondLength; secondIndex += 1) {
      const substitutionCost = firstCharacter === second[secondIndex - 1] ? 0 : 1
      currentRow[secondIndex] = Math.min(
        currentRow[secondIndex - 1] + 1,
        previousRow[secondIndex] + 1,
        previousRow[secondIndex - 1] + substitutionCost,
      )
    }
    const swap = previousRow
    previousRow = currentRow
    currentRow = swap
  }

  return previousRow[secondLength]
}

function allowedDistance(length: number) {
  if (length >= 12) return 2
  if (length >= 5) return 1
  return 0
}

// Curriculum items register their normalized answer forms once at module load
// (see precomputeNormalizedNames) so typed submissions stop re-running NFD
// normalization plus regexes over ~195 items × ~15 aliases per keystroke.
const normalizedCandidates = new WeakMap<NamedItem, {
  name: string
  aliases: string[]
}>()

export function precomputeNormalizedNames(item: NamedItem) {
  if (normalizedCandidates.has(item)) return
  normalizedCandidates.set(item, {
    name: normalizeAnswer(item.name),
    aliases: item.aliases.map(normalizeAnswer),
  })
}

function normalizedNameOf(item: NamedItem) {
  return normalizedCandidates.get(item)?.name ?? normalizeAnswer(item.name)
}

function matchDistanceNormalized(item: NamedItem, normalized: string) {
  if (!normalized) return null

  const cached = normalizedCandidates.get(item)
  let best: number | null = null

  const consider = (expected: string) => {
    if (!expected) return
    const allowed = allowedDistance(Math.max(expected.length, normalized.length))
    // The edit distance is at least the length difference, so candidates
    // that differ in length by more than the allowed distance can never be
    // accepted. Skipping them avoids running the DP recurrence entirely.
    if (Math.abs(expected.length - normalized.length) > allowed) return
    const distance = expected === normalized ? 0 : editDistance(expected, normalized)
    if (distance > allowed) return
    if (best === null || distance < best) best = distance
  }

  if (cached) {
    consider(cached.name)
    if (best === 0) return 0
    for (const alias of cached.aliases) {
      consider(alias)
      if (best === 0) return 0
    }
  } else {
    consider(normalizeAnswer(item.name))
    if (best === 0) return 0
    for (const alias of item.aliases) {
      consider(normalizeAnswer(alias))
      if (best === 0) return 0
    }
  }
  return best
}

export function matchDistance(item: NamedItem, answer: string) {
  return matchDistanceNormalized(item, normalizeAnswer(answer))
}

export function isAcceptedAnswer(
  item: NamedItem,
  answer: string,
  catalogue: NamedItem[] = [],
) {
  const normalized = normalizeAnswer(answer)
  const score = matchDistanceNormalized(item, normalized)
  if (score === null) return false

  if (normalizedNameOf(item) === normalized) return true

  const conflicting = catalogue.some((other) => {
    if (other.id === item.id) return false
    const otherScore = matchDistanceNormalized(other, normalized)
    return otherScore !== null && otherScore <= score
  })
  return !conflicting
}

export function namePattern(name: string, hintLevel: number) {
  return name
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return '   '

      const letterIndexes = [...part]
        .map((character, index) => (/[A-Za-zÀ-ž]/.test(character) ? index : -1))
        .filter((index) => index >= 0)
      const first = letterIndexes[0]
      const last = letterIndexes[letterIndexes.length - 1]
      const interior = letterIndexes.slice(1, -1)
      const extraLetters = Math.max(0, hintLevel - 3)
      const revealEvery = extraLetters > 0
        ? Math.max(1, Math.ceil(interior.length / (extraLetters + 1)))
        : Number.POSITIVE_INFINITY
      const keepHidden = interior[Math.floor(interior.length / 2)]

      return [...part]
        .map((character, index) => {
          if (!/[A-Za-zÀ-ž]/.test(character)) return character
          if (hintLevel >= 2 && index === first) return character
          if (hintLevel >= 3 && index === last) return character
          if (
            hintLevel >= 4
            && interior.includes(index)
            && (index - first - 1) % revealEvery === 0
            && index !== keepHidden
          ) return character
          return '_'
        })
        .join(' ')
    })
    .join('')
}
