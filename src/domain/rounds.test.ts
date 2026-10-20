import { describe, expect, it } from 'vitest'
import { createRound, nextRoundMode } from './rounds'

const curriculum = Array.from({ length: 20 }, (_, index) => ({
  id: String(index + 1),
  level: index < 10 ? 1 : 2,
}))

describe('createRound', () => {
  it('introduces the first ten unseen items in the opening multiple-choice round', () => {
    const round = createRound('multiple-choice', curriculum, {}, {}, [])
    expect(round).toHaveLength(10)
    expect(round.every((question) => question.mode === 'multiple-choice')).toBe(true)
    expect(new Set(round.map((question) => question.item.id)).size).toBe(10)
    expect(round.every((question) => Number(question.item.id) <= 10)).toBe(true)
  })

  it('schedules typed recall only for items completed twice in multiple choice', () => {
    const completions = Object.fromEntries(curriculum.slice(0, 12).map((item) => [item.id, 2]))
    const round = createRound('typed', curriculum, completions, {}, [])
    expect(round).toHaveLength(10)
    expect(round.every((question) => question.mode === 'typed')).toBe(true)
    expect(round.every((question) => (completions[question.item.id] ?? 0) >= 2)).toBe(true)
  })
})

describe('nextRoundMode', () => {
  it('stays on multiple choice until ten items are ready to type', () => {
    expect(nextRoundMode('multiple-choice', curriculum, { 1: 2, 2: 2 })).toBe('multiple-choice')
    const ready = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, 2]))
    expect(nextRoundMode('multiple-choice', curriculum, ready)).toBe('typed')
    expect(nextRoundMode('typed', curriculum, ready)).toBe('multiple-choice')
  })
})
