import { describe, expect, it } from 'vitest'
import { firstTryStreak, rollCloseUp } from './LocationQuiz'

const result = (firstTryCorrect: boolean) => ({ firstTryCorrect, quick: false })

describe('firstTryStreak', () => {
  it('counts consecutive first-try answers from the most recent', () => {
    expect(firstTryStreak([result(true), result(false), result(true), result(true)])).toBe(2)
    expect(firstTryStreak([result(true), result(false)])).toBe(0)
    expect(firstTryStreak([])).toBe(0)
  })
})

describe('rollCloseUp', () => {
  it('never zooms before a five-answer streak', () => {
    expect(rollCloseUp(4, () => 0)).toBe(0)
  })

  it('zooms occasionally, not always, once on a streak', () => {
    expect(rollCloseUp(5, () => 0.1)).toBe(1)
    expect(rollCloseUp(5, () => 0.3)).toBe(0)
    expect(rollCloseUp(30, () => 0.7)).toBe(0)
  })

  it('only uses the tightest zoom from a ten-answer streak', () => {
    expect(rollCloseUp(9, () => 0)).toBe(1)
    expect(rollCloseUp(10, () => 0)).toBe(2)
  })
})
