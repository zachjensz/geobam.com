import { describe, expect, it } from 'vitest'
import { isAcceptedAnswer, namePattern, normalizeAnswer } from './answers'

const paris = { id: '250', name: 'Paris', aliases: [] }
const rome = { id: '380', name: 'Rome', aliases: ['Roma'] }
const lome = { id: '768', name: 'Lomé', aliases: ['Lome'] }
const prague = { id: '203', name: 'Prague', aliases: ['Praha'] }
const washington = {
  id: '840',
  name: 'Washington D.C.',
  aliases: ['Washington', 'Washington DC', 'DC'],
}
const kyiv = { id: '804', name: 'Kyiv', aliases: ['Kiev'] }
const catalogue = [paris, rome, lome, prague, washington, kyiv]

describe('normalizeAnswer', () => {
  it('ignores case, punctuation, and diacritics', () => {
    expect(normalizeAnswer('  Lomé! ')).toBe('lome')
    expect(normalizeAnswer('Washington D.C.')).toBe('washington dc')
  })
})

describe('isAcceptedAnswer', () => {
  it('accepts canonical names and aliases', () => {
    expect(isAcceptedAnswer(paris, 'Paris', catalogue)).toBe(true)
    expect(isAcceptedAnswer(washington, 'washington', catalogue)).toBe(true)
    expect(isAcceptedAnswer(kyiv, 'Kiev', catalogue)).toBe(true)
  })

  it('accepts small typos on longer names', () => {
    expect(isAcceptedAnswer(prague, 'Prauge', catalogue)).toBe(true)
    expect(isAcceptedAnswer(paris, 'Parris', catalogue)).toBe(true)
  })

  it('rejects short near-misses that would collide with another city', () => {
    expect(isAcceptedAnswer(rome, 'Lome', catalogue)).toBe(false)
    expect(isAcceptedAnswer(lome, 'Rome', catalogue)).toBe(false)
    expect(isAcceptedAnswer(rome, 'Roma', catalogue)).toBe(true)
  })

  it('does not accept a different catalogue city as a fuzzy match', () => {
    expect(isAcceptedAnswer(paris, 'Prague', catalogue)).toBe(false)
  })
})

describe('namePattern', () => {
  it('reveals word lengths first, then letters', () => {
    expect(namePattern('Paris', 1)).toBe('_ _ _ _ _')
    expect(namePattern('Paris', 2).startsWith('P')).toBe(true)
  })
})
