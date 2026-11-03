import { describe, expect, it } from 'vitest'
import { applyRoundMastery, createRound, isSnoozed, nextRoundMode, practiceClock, snoozeRoundsFor } from './rounds'

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

describe('round mastery', () => {
  const stats = (completed: number) => ({ completed, firstTryCorrect: completed, totalAnswerMs: 0, totalAttempts: completed })

  it('snoozes first-try correct items after a round of at least 70%', () => {
    const performance = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, stats(1)]))
    const results = Object.fromEntries(curriculum.slice(0, 10).map((item, index) => [item.id, index < 7]))
    const next = applyRoundMastery(performance, results)
    const clock = practiceClock(next)
    expect(curriculum.slice(0, 7).every((item) => isSnoozed(next[item.id], clock))).toBe(true)
    expect(curriculum.slice(7, 10).some((item) => isSnoozed(next[item.id], clock))).toBe(false)
  })

  it('does not snooze anything after a round below 70%', () => {
    const performance = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, stats(1)]))
    const results = Object.fromEntries(curriculum.slice(0, 10).map((item, index) => [item.id, index < 6]))
    const next = applyRoundMastery(performance, results)
    const clock = practiceClock(next)
    expect(curriculum.some((item) => isSnoozed(next[item.id], clock))).toBe(false)
  })

  it('doubles the snooze for repeated mastery', () => {
    expect(snoozeRoundsFor(2)).toBe(snoozeRoundsFor(1) * 2)
  })

  it('replaces snoozed items with new ones in the next round', () => {
    const completions = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, 1]))
    const performance = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, stats(1)]))
    const results = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, true]))
    const next = applyRoundMastery(performance, results)
    const round = createRound('multiple-choice', curriculum, completions, next, [])
    expect(round).toHaveLength(10)
    expect(round.every((question) => Number(question.item.id) > 10)).toBe(true)
  })
})
