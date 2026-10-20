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

export function editDistance(first: string, second: string) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex]
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + substitutionCost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[second.length]
}

function allowedDistance(length: number) {
  if (length >= 12) return 2
  if (length >= 5) return 1
  return 0
}

export function matchDistance(item: NamedItem, answer: string) {
  const normalized = normalizeAnswer(answer)
  if (!normalized) return null

  let best: number | null = null
  for (const candidate of [item.name, ...item.aliases]) {
    const expected = normalizeAnswer(candidate)
    if (!expected) continue
    const distance = expected === normalized ? 0 : editDistance(expected, normalized)
    if (distance > allowedDistance(Math.max(expected.length, normalized.length))) continue
    if (best === null || distance < best) best = distance
  }
  return best
}

export function isAcceptedAnswer(
  item: NamedItem,
  answer: string,
  catalogue: NamedItem[] = [],
) {
  const score = matchDistance(item, answer)
  if (score === null) return false

  const normalized = normalizeAnswer(answer)
  if (normalizeAnswer(item.name) === normalized) return true

  const conflicting = catalogue.some((other) => {
    if (other.id === item.id) return false
    const otherScore = matchDistance(other, answer)
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
