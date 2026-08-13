import { describe, expect, it } from 'vitest'
import { capitalCurriculum, capitalMarkers, capitalOptions } from './curriculum'

describe('capitalCurriculum', () => {
  it('starts with familiar western capitals including Paris', () => {
    const opening = capitalCurriculum.slice(0, 10).map((capital) => capital.name)
    expect(opening[0]).toBe('Washington D.C.')
    expect(opening[1]).toBe('London')
    expect(opening[2]).toBe('Paris')
    expect(opening).toContain('Ottawa')
    expect(opening).toContain('Dublin')
  })

  it('places less familiar African and Pacific capitals later', () => {
    const names = capitalCurriculum.map((capital) => capital.name)
    expect(names.indexOf('Paris')).toBeLessThan(names.indexOf('Gaborone'))
    expect(names.indexOf('Paris')).toBeLessThan(names.indexOf('Funafuti'))
  })

  it('has a map coordinate and unique id for every capital', () => {
    const ids = new Set(capitalCurriculum.map((capital) => capital.id))
    expect(ids.size).toBe(capitalCurriculum.length)
    expect(capitalCurriculum.every((capital) => capital.focus.length === 2)).toBe(true)
  })
})

describe('capitalMarkers', () => {
  it('marks every capital and emphasizes the target', () => {
    const paris = capitalCurriculum.find((capital) => capital.name === 'Paris')
    expect(paris).toBeTruthy()
    const markers = capitalMarkers(paris!.id)
    expect(markers).toHaveLength(capitalCurriculum.length)
    expect(markers.filter((marker) => marker.role === 'target')).toEqual([
      expect.objectContaining({ id: paris!.id, role: 'target' }),
    ])
  })
})

describe('capitalOptions', () => {
  it('returns four distinct capital names', () => {
    const paris = capitalCurriculum.find((capital) => capital.name === 'Paris')!
    const options = capitalOptions(paris, paris.level)
    expect(options).toHaveLength(4)
    expect(options.some((option) => option.id === paris.id)).toBe(true)
    expect(new Set(options.map((option) => option.id)).size).toBe(4)
  })
})
