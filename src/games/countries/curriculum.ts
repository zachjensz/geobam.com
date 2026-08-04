import worldCountries from 'world-countries'

export type Country = {
  id: string
  name: string
  aliases: string[]
  level: number
  rarity: 1 | 2 | 3 | 4 | 5
  averageTypingMs: number
  clue: string
  focus: [longitude: number, latitude: number]
  showSmallCountryMarker?: boolean
  isIslandNation: boolean
  showIslandEnvelope: boolean
}

const familiarOrder = [
  'United States', 'United Kingdom', 'France', 'Canada', 'Ireland',
  'Netherlands', 'Belgium', 'Switzerland', 'Norway', 'Sweden',
  'Germany', 'Italy', 'Spain', 'Australia', 'Portugal', 'New Zealand',
  'Austria', 'Denmark', 'Finland', 'Greece', 'Poland', 'Iceland',
  'Malta', 'Cyprus', 'Luxembourg', 'Czechia', 'Hungary', 'Romania',
  'Bulgaria', 'Croatia', 'Serbia', 'Slovakia', 'Slovenia', 'Estonia',
  'Latvia', 'Lithuania', 'Albania', 'North Macedonia',
  'Bosnia and Herzegovina', 'Montenegro', 'Moldova',
  'Japan', 'Mexico', 'Brazil', 'China', 'India', 'Russia', 'South Korea',
  'Argentina', 'South Africa', 'Egypt', 'Türkiye', 'Indonesia',
  'Saudi Arabia', 'United Arab Emirates', 'Thailand', 'Vietnam',
  'Singapore', 'Israel', 'Ukraine', 'Chile', 'Colombia', 'Peru',
  'Morocco', 'Nigeria',
]

const aliasOverrides: Record<string, string[]> = {
  'United States': ['USA', 'US', 'United States of America'],
  'United Kingdom': ['UK', 'Great Britain', 'Britain'],
  'Ireland': ['Republic of Ireland'],
  'Netherlands': ['The Netherlands', 'Holland'],
  'Türkiye': ['Turkey'],
  'South Korea': ['Republic of Korea', 'Korea'],
  'North Korea': ['DPRK', "Democratic People's Republic of Korea"],
  'Russia': ['Russian Federation'],
  'Czechia': ['Czech Republic'],
  'Ivory Coast': ["Côte d'Ivoire", 'Cote d Ivoire'],
}

const clueOverrides: Record<string, string> = {
  'United States': 'It lies between Canada and Mexico.',
  'United Kingdom': 'It is an island nation off the north-west coast of Europe.',
  'France': 'It shares a western European border with Spain.',
  'Canada': 'It stretches from the Atlantic to the Pacific above the United States.',
  'Ireland': 'It occupies most of the island west of Great Britain.',
  'Netherlands': 'This low-lying country borders Belgium and Germany.',
  'Belgium': 'It lies between France, Germany and the Netherlands.',
  'Switzerland': 'This landlocked Alpine country borders France, Germany and Italy.',
  'Norway': 'Its long Atlantic coastline forms the western side of Scandinavia.',
  'Sweden': 'This Scandinavian country lies between Norway and the Baltic Sea.',
}

function rarityFor(country: (typeof worldCountries)[number]): 1 | 2 | 3 | 4 | 5 {
  if (familiarOrder.includes(country.name.common)) return familiarOrder.indexOf(country.name.common) < 22 ? 1 : 2
  if (country.region === 'Europe') return 3
  if (country.subregion.includes('Caribbean') || country.subregion.includes('Polynesia') || country.subregion.includes('Micronesia') || country.subregion.includes('Melanesia')) return 5
  if (country.area < 5_000) return 5
  if (country.region === 'Africa') return 4
  if (country.area > 1_000_000) return 3
  return 4
}

const orderedCountries = worldCountries
  .filter((country) => country.unMember)
  .sort((first, second) => {
    const firstKnown = familiarOrder.indexOf(first.name.common)
    const secondKnown = familiarOrder.indexOf(second.name.common)
    if (firstKnown !== -1 || secondKnown !== -1) {
      if (firstKnown === -1) return 1
      if (secondKnown === -1) return -1
      return firstKnown - secondKnown
    }
    return rarityFor(first) - rarityFor(second) || second.area - first.area
  })

export const countryCurriculum: Country[] = orderedCountries.map((country, index) => {
  const name = country.name.common
  const aliases = [
    country.name.official,
    ...country.altSpellings.filter((alias) => alias.length > 2 && /^[A-Za-zÀ-ž .'-]+$/.test(alias)),
    ...(aliasOverrides[name] ?? []),
  ].filter((alias, aliasIndex, allAliases) => alias !== name && allAliases.indexOf(alias) === aliasIndex)
  const letters = name.replace(/[^A-Za-zÀ-ž]/g, '').length
  const focus = country.cca3 === 'FRA'
    ? [2, 46] as [number, number]
    : [country.latlng[1], country.latlng[0]] as [number, number]
  const isIslandNation =
    country.borders.length === 0
    || country.region === 'Oceania'
    || [
      'United Kingdom',
      'Ireland',
      'Indonesia',
      'Philippines',
      'Papua New Guinea',
      'Timor-Leste',
      'Haiti',
      'Dominican Republic',
    ].includes(name)

  return {
    id: country.ccn3,
    name,
    aliases,
    level: index < 10 ? 1 : Math.ceil((index - 9) / 4) + 1,
    rarity: rarityFor(country),
    averageTypingMs: Math.min(6_500, 850 + letters * 165 + (name.split(' ').length - 1) * 180),
    clue: clueOverrides[name] ?? `It is in ${country.subregion || country.region}.`,
    focus,
    showSmallCountryMarker: country.area < 15_000,
    isIslandNation,
    // Dotted envelopes locate small or dispersed island states. Large,
    // immediately legible islands such as Australia do not need one.
    showIslandEnvelope: isIslandNation && country.area < 150_000,
  }
})

export function countriesForLevel(level: number) {
  return countryCurriculum.filter((country) => country.level <= Math.max(1, level))
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

export function isAcceptedAnswer(country: Country, answer: string) {
  const normalized = normalizeAnswer(answer)
  if (!normalized) return false

  return [country.name, ...country.aliases].some((candidate) => {
    const expected = normalizeAnswer(candidate)
    if (expected === normalized) return true

    const longestLength = Math.max(expected.length, normalized.length)
    const allowedDistance = longestLength >= 12 ? 2 : longestLength >= 5 ? 1 : 0
    return editDistance(expected, normalized) <= allowedDistance
  })
}

function editDistance(first: string, second: string) {
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
