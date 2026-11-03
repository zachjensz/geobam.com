import { describe, expect, it } from 'vitest'
import { countryAt } from './CountryGlobe'
import { locateAnswer } from './CountriesQuiz'
import { countryCurriculum } from './curriculum'

const byName = (name: string) => countryCurriculum.find((country) => country.name === name)!

describe('countryAt', () => {
  it('finds countries under a clicked point', () => {
    expect(countryAt(2, 46)).toBe(byName('France').id)
    expect(countryAt(-47, -10)).toBe(byName('Brazil').id)
    expect(countryAt(6.13, 49.7)).toBe(byName('Luxembourg').id)
    expect(countryAt(-30, 0)).toBeNull()
  })

  it('handles polygons crossing the antimeridian', () => {
    expect(countryAt(178, 66)).toBe(byName('Russia').id)
    expect(countryAt(-178, 66)).toBe(byName('Russia').id)
  })
})

describe('locateAnswer', () => {
  it('accepts a direct hit and names a miss', () => {
    const france = byName('France')
    expect(locateAnswer(france, { countryId: france.id, pixelsFromTarget: 200, screen: { x: 0, y: 0 } })).toBe('France')
    expect(locateAnswer(france, { countryId: byName('Spain').id, pixelsFromTarget: 80, screen: { x: 0, y: 0 } })).toBe('Spain')
    expect(locateAnswer(france, { countryId: null, pixelsFromTarget: 400, screen: { x: 0, y: 0 } })).toBe('open ocean')
  })

  it('gives tiny countries a click tolerance', () => {
    const malta = byName('Malta')
    expect(locateAnswer(malta, { countryId: null, pixelsFromTarget: 10, screen: { x: 0, y: 0 } })).toBe('Malta')
    const luxembourg = byName('Luxembourg')
    expect(locateAnswer(luxembourg, { countryId: byName('France').id, pixelsFromTarget: 12, screen: { x: 0, y: 0 } })).toBe('Luxembourg')
  })
})
