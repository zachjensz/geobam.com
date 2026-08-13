import worldCountries from 'world-countries'
import { familiarOrder } from '../../domain/familiarity'
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
  highlightHostCountry: boolean
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
  .filter((country) => country.unMember && country.capital[0] && capitalCoordinates[country.ccn3])
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

export const capitalCurriculum: Capital[] = orderedCountries.map((country, index) => {
  const name = country.capital[0]
  const aliases = [
    ...(aliasOverrides[name] ?? []),
  ].filter((alias, aliasIndex, allAliases) => alias !== name && allAliases.indexOf(alias) === aliasIndex)
  const letters = name.replace(/[^A-Za-zÀ-ž]/g, '').length

  return {
    id: country.ccn3,
    name,
    aliases,
    countryName: country.name.common,
    countryId: country.ccn3,
    region: country.region,
    subregion: country.subregion,
    level: index < 10 ? 1 : Math.ceil((index - 9) / 4) + 1,
    rarity: rarityFor(country),
    averageTypingMs: Math.min(6_500, 850 + letters * 165 + (name.split(' ').length - 1) * 180),
    clue: clueOverrides[name] ?? `It is the capital of ${country.name.common}.`,
    focus: capitalCoordinates[country.ccn3],
    highlightHostCountry: rarityFor(country) === 1,
  }
})

export function capitalsForLevel(level: number) {
  return capitalCurriculum.filter((capital) => capital.level <= Math.max(1, level))
}

export function capitalOptions(question: Capital, level: number) {
  const pool = capitalsForLevel(Math.max(level, 2)).filter((capital) => capital.id !== question.id)
  const sameSubregion = pool.filter((capital) => capital.subregion === question.subregion)
  const sameRegion = pool.filter((capital) => (
    capital.region === question.region && capital.subregion !== question.subregion
  ))
  const rest = pool.filter((capital) => capital.region !== question.region)
  const ranked = [...shuffle(sameSubregion), ...shuffle(sameRegion), ...shuffle(rest)]
  return shuffle([question, ...ranked.slice(0, 3)])
}

export function capitalMarkers(targetId: string) {
  return capitalCurriculum.map((capital) => ({
    id: capital.id,
    position: capital.focus,
    role: capital.id === targetId ? 'target' as const : 'context' as const,
  }))
}
