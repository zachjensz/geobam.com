import { describe, expect, it } from 'vitest'
import { applyRoundMastery, createRound, isSnoozed, MIN_SNOOZE_TURNS, nextRoundMode, practiceClock, snoozeRoundsFor } from './rounds'

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

  it('adds locate rounds between multiple-choice rounds when enabled', () => {
    const seenOnce = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, 1]))
    expect(nextRoundMode('multiple-choice', curriculum, seenOnce, { locate: true })).toBe('locate')
    expect(nextRoundMode('locate', curriculum, seenOnce, { locate: true })).toBe('multiple-choice')
    const ready = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, 2]))
    expect(nextRoundMode('multiple-choice', curriculum, ready, { locate: true, roundNumber: 0 })).toBe('typed')
    expect(nextRoundMode('multiple-choice', curriculum, ready, { locate: true, roundNumber: 1 })).toBe('locate')
  })
})

describe('round mastery', () => {
  const stats = (completed: number) => ({ completed, firstTryCorrect: completed, totalAnswerMs: 0, totalAttempts: completed })

  it('snoozes every first-try correct item for at least 50 turns, even in a weak round', () => {
    const performance = Object.fromEntries(curriculum.slice(0, 10).map((item) => [item.id, stats(1)]))
    const results = Object.fromEntries(curriculum.slice(0, 10).map((item, index) => [item.id, index < 3]))
    const next = applyRoundMastery(performance, results)
    const clock = practiceClock(next)
    expect(curriculum.slice(0, 3).every((item) => isSnoozed(next[item.id], clock + MIN_SNOOZE_TURNS - 1))).toBe(true)
    expect(curriculum.slice(3, 10).some((item) => isSnoozed(next[item.id], clock))).toBe(false)
  })

  it('ranks cleanly answered items behind every unseen item once their snooze ends', () => {
    const big = Array.from({ length: 40 }, (_, index) => ({ id: String(index + 1), level: 1 }))
    const completions = Object.fromEntries(big.slice(0, 10).map((item) => [item.id, 1]))
    const performance = Object.fromEntries(big.slice(0, 10).map((item) => [
      item.id,
      { ...stats(1), masteryStreak: 1, snoozedUntil: 0 },
    ]))
    const round = createRound('multiple-choice', big, completions, performance, [
      ...Array(10).fill({ firstTryCorrect: false, quick: false }),
    ])
    expect(round.every((question) => Number(question.item.id) > 10)).toBe(true)
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
