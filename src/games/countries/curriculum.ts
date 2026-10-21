import { worldCountries } from '../../data/countriesSlim'
import { familiarOrder } from '../../domain/familiarity'
import { precomputeNormalizedNames } from '../../domain/answers'
import { shuffle } from '../../domain/rounds'

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

// Familiar countries are probed on every sort comparison, so a Map replaces
// repeated O(66) indexOf scans with a single O(1) lookup.
const familiarIndex = new Map<string, number>()
familiarOrder.forEach((name, index) => familiarIndex.set(name, index))

function rarityFor(country: (typeof worldCountries)[number]): 1 | 2 | 3 | 4 | 5 {
  const familiarRank = familiarIndex.get(country.name.common)
  if (familiarRank !== undefined) return familiarRank < 22 ? 1 : 2
  if (country.region === 'Europe') return 3
  if (country.subregion.includes('Caribbean') || country.subregion.includes('Polynesia') || country.subregion.includes('Micronesia') || country.subregion.includes('Melanesia')) return 5
  if (country.area < 5_000) return 5
  if (country.region === 'Africa') return 4
  if (country.area > 1_000_000) return 3
  return 4
}

const orderedCountries = worldCountries
  .filter((country) => country.unMember)
  // Memoize rarity once per country instead of re-scanning the familiarity
  // and region lists on every sort comparison.
  .map((country) => ({ country, rarity: rarityFor(country) }))
  .sort((first, second) => {
    const firstKnown = familiarIndex.get(first.country.name.common)
    const secondKnown = familiarIndex.get(second.country.name.common)
    if (firstKnown !== undefined || secondKnown !== undefined) {
      if (firstKnown === undefined) return 1
      if (secondKnown === undefined) return -1
      return firstKnown - secondKnown
    }
    return first.rarity - second.rarity || second.country.area - first.country.area
  })

export const countryCurriculum: Country[] = orderedCountries.map(({ country, rarity }, index) => {
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

  const item: Country = {
    id: country.ccn3,
    name,
    aliases,
    level: index < 10 ? 1 : Math.ceil((index - 9) / 4) + 1,
    rarity,
    averageTypingMs: Math.min(6_500, 850 + letters * 165 + (name.split(' ').length - 1) * 180),
    clue: clueOverrides[name] ?? `It is in ${country.subregion || country.region}.`,
    focus,
    showSmallCountryMarker: country.area < 15_000,
    isIslandNation,
    // Dotted envelopes locate small or dispersed island states. Large,
    // immediately legible islands such as Australia do not need one.
    showIslandEnvelope: isIslandNation && country.area < 150_000,
  }
  // Normalize the name and aliases once at module load so typed submissions
  // never re-normalize the whole catalogue per keystroke.
  precomputeNormalizedNames(item)
  return item
})

// Cumulative per-level buckets computed once at module load: levels only ever
// increase along the curriculum, so concatenating level buckets in order
// reproduces the old per-question filter.
const countriesByLevel: Country[][] = []
for (const country of countryCurriculum) {
  const bucket = countriesByLevel[country.level] ?? (countriesByLevel[country.level] = [])
  bucket.push(country)
}

const countriesUpToLevel: Country[][] = []
{
  let running: Country[] = []
  for (let level = 1; level < countriesByLevel.length; level += 1) {
    running = [...running, ...(countriesByLevel[level] ?? [])]
    countriesUpToLevel[level] = running
  }
}

export function countriesForLevel(level: number) {
  const clamped = Math.min(Math.max(1, Math.floor(level)), countriesUpToLevel.length - 1)
  return countriesUpToLevel[clamped] ?? []
}

export function countryOptions(question: Country, level: number) {
  const pool = countriesForLevel(Math.max(level, 2)).filter((country) => country.id !== question.id)
  return shuffle([question, ...shuffle(pool).slice(0, 3)])
}
