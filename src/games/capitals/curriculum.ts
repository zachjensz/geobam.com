import { worldCountries } from '../../data/countriesSlim'
import { familiarOrder } from '../../domain/familiarity'
import { precomputeNormalizedNames } from '../../domain/answers'
import { shuffle } from '../../domain/rounds'
import { capitalCoordinates } from './coordinates'

export type Capital = {
  id: string
  name: string
  aliases: string[]
  countryName: string
  countryId: string
  region: string
  subregion: string
  level: number
  rarity: 1 | 2 | 3 | 4 | 5
  averageTypingMs: number
  clue: string
  focus: [longitude: number, latitude: number]
}

const aliasOverrides: Record<string, string[]> = {
  'Washington D.C.': ['Washington', 'Washington DC', 'Washington D.C.', 'DC', 'D.C.'],
  'Kyiv': ['Kiev'],
  'Prague': ['Praha'],
  'Vienna': ['Wien'],
  'Brussels': ['Bruxelles', 'Brussel'],
  'Rome': ['Roma'],
  'Athens': ['Athinai'],
  'Lisbon': ['Lisboa'],
  'Moscow': ['Moskva'],
  'Beijing': ['Peking'],
  'Bangkok': ['Krung Thep'],
  'Ulan Bator': ['Ulaanbaatar', 'Ulanbaatar'],
  'Chișinău': ['Chisinau', 'Kishinev'],
  'Yaoundé': ['Yaounde'],
  "N'Djamena": ['Ndjamena', 'N Djamena'],
  'Malé': ['Male'],
  'São Tomé': ['Sao Tome'],
  'Asunción': ['Asuncion'],
  'Bogotá': ['Bogota'],
  'Brasília': ['Brasilia'],
  'Mexico City': ['Ciudad de Mexico', 'Ciudad de México'],
  'Panama City': ['Panama'],
  'Guatemala City': ['Guatemala'],
  'Kuwait City': ['Kuwait'],
  'Luxembourg': ['Luxembourg City', 'Luxemburg'],
  'City of San Marino': ['San Marino'],
  "St. George's": ["Saint George's", 'St Georges', 'Saint Georges'],
  "Saint John's": ["St. John's", 'Saint Johns', 'St Johns'],
  'Reykjavik': ['Reykjavík'],
  'Naypyidaw': ['Nay Pyi Taw', 'Naypyitaw'],
  "Nuku'alofa": ['Nukualofa', 'Nuku alofa'],
  "Sana'a": ['Sanaa', 'Sana a'],
  'Andorra la Vella': ['Andorra'],
  'Porto-Novo': ['Porto Novo'],
  'Colombo': ['Sri Jayawardenepura Kotte', 'Sri Jayawardenepura', 'Kotte'],
  'Lobamba': ['Mbabane'],
  'Ngerulmud': ['Melekeok'],
  'Yaren': ['Yaren District'],
}

const clueOverrides: Record<string, string> = {
  'Paris': 'It is the capital of France.',
  'London': 'It is the capital of the United Kingdom.',
  'Washington D.C.': 'It is the capital of the United States.',
  'Ottawa': 'It is the capital of Canada.',
  'Dublin': 'It is the capital of Ireland.',
  'Amsterdam': 'It is the official capital of the Netherlands.',
  'Brussels': 'It is the capital of Belgium.',
  'Bern': 'It is the de facto capital of Switzerland.',
  'Oslo': 'It is the capital of Norway.',
  'Stockholm': 'It is the capital of Sweden.',
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
  .filter((country) => country.unMember && country.capital[0] && capitalCoordinates[country.ccn3])
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

export const capitalCurriculum: Capital[] = orderedCountries.map(({ country, rarity }, index) => {
  const name = country.capital[0]
  const aliases = [
    ...(aliasOverrides[name] ?? []),
  ].filter((alias, aliasIndex, allAliases) => alias !== name && allAliases.indexOf(alias) === aliasIndex)
  const letters = name.replace(/[^A-Za-zÀ-ž]/g, '').length

  const item: Capital = {
    id: country.ccn3,
    name,
    aliases,
    countryName: country.name.common,
    countryId: country.ccn3,
    region: country.region,
    subregion: country.subregion,
    level: index < 10 ? 1 : Math.ceil((index - 9) / 4) + 1,
    rarity,
    averageTypingMs: Math.min(6_500, 850 + letters * 165 + (name.split(' ').length - 1) * 180),
    clue: clueOverrides[name] ?? `It is the capital of ${country.name.common}.`,
    focus: capitalCoordinates[country.ccn3],
  }
  // Normalize the name and aliases once at module load so typed submissions
  // never re-normalize the whole catalogue per keystroke.
  precomputeNormalizedNames(item)
  return item
})

// Cumulative per-level buckets computed once at module load: levels only ever
// increase along the curriculum, so concatenating level buckets in order
// reproduces the old per-question filter.
const capitalsByLevel: Capital[][] = []
for (const capital of capitalCurriculum) {
  const bucket = capitalsByLevel[capital.level] ?? (capitalsByLevel[capital.level] = [])
  bucket.push(capital)
}

const capitalsUpToLevel: Capital[][] = []
{
  let running: Capital[] = []
  for (let level = 1; level < capitalsByLevel.length; level += 1) {
    running = [...running, ...(capitalsByLevel[level] ?? [])]
    capitalsUpToLevel[level] = running
  }
}

export function capitalsForLevel(level: number) {
  const clamped = Math.min(Math.max(1, Math.floor(level)), capitalsUpToLevel.length - 1)
  return capitalsUpToLevel[clamped] ?? []
}

export function capitalOptions(question: Capital, level: number) {
  // Partition the pool into subregion / region / rest buckets in a single
  // pass instead of filtering the pool three more times.
  const sameSubregion: Capital[] = []
  const sameRegion: Capital[] = []
  const rest: Capital[] = []
  for (const capital of capitalsForLevel(Math.max(level, 2))) {
    if (capital.id === question.id) continue
    if (capital.subregion === question.subregion) sameSubregion.push(capital)
    else if (capital.region === question.region) sameRegion.push(capital)
    else rest.push(capital)
  }
  const ranked = [...shuffle(sameSubregion), ...shuffle(sameRegion), ...shuffle(rest)]
  return shuffle([question, ...ranked.slice(0, 3)])
}

type CapitalMarker = {
  id: string
  position: [number, number]
  role: 'target' | 'context'
}

// One marker list per target, memoized across renders. Rebuilding ~200 marker
// objects on every quiz render (including per keystroke) was pure garbage
// churn; the map is keyed by the stable target id.
const capitalMarkersByTarget = new Map<string, CapitalMarker[]>()

export function capitalMarkers(targetId: string) {
  let markers = capitalMarkersByTarget.get(targetId)
  if (!markers) {
    markers = capitalCurriculum.map((capital) => ({
      id: capital.id,
      position: capital.focus,
      role: capital.id === targetId ? 'target' as const : 'context' as const,
    }))
    capitalMarkersByTarget.set(targetId, markers)
  }
  return markers
}
