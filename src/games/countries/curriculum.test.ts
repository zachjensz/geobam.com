import { describe, expect, it } from 'vitest'
import { countryCurriculum, countryOptions, nearbyCountries } from './curriculum'

const byName = (name: string) => countryCurriculum.find((country) => country.name === name)!

describe('countryCurriculum', () => {
  it('mixes well-known countries from every continent into the opening rounds', () => {
    const opening = countryCurriculum.slice(0, 20).map((country) => country.name)
    for (const name of ['Japan', 'China', 'India', 'Brazil', 'South Africa', 'Argentina', 'Panama']) {
      expect(opening).toContain(name)
    }
    const european = countryCurriculum.slice(0, 20).filter((country) =>
      ['United Kingdom', 'France', 'Ireland', 'Germany', 'Italy', 'Spain', 'Russia'].includes(country.name))
    expect(european.length).toBeLessThanOrEqual(7)
  })
})

describe('nearbyCountries', () => {
  it('offers Balkan neighbours rather than distant countries for Serbia', () => {
    const nearby = nearbyCountries(byName('Serbia')).map((country) => country.name)
    expect(nearby).toEqual(expect.arrayContaining(['Croatia', 'Montenegro']))
    for (const far of ['Poland', 'Norway', 'United Kingdom']) expect(nearby).not.toContain(far)
  })

  it('uses land borders for large countries', () => {
    const brazil = byName('Brazil')
    const nearby = nearbyCountries(brazil)
    expect(nearby.every((country) => brazil.neighbors.includes(country.id))).toBe(true)
  })
})

describe('countryOptions', () => {
  it('returns four distinct options including the answer in both modes', () => {
    const serbia = byName('Serbia')
    for (const hard of [false, true]) {
      const options = countryOptions(serbia, serbia.level, hard)
      expect(options).toHaveLength(4)
      expect(options.some((option) => option.id === serbia.id)).toBe(true)
      expect(new Set(options.map((option) => option.id)).size).toBe(4)
    }
  })
})
