export type RoundMode = 'multiple-choice' | 'typed'

export type Schedulable = {
  id: string
  level: number
}

export type ItemPerformance = {
  completed: number
  firstTryCorrect: number
  totalAnswerMs: number
  totalAttempts: number
  lastCompletedAt?: number
  multipleChoiceCompleted?: number
  typedCompleted?: number
  lastMultipleChoiceAt?: number
  lastTypedAt?: number
  /** Consecutive mastered rounds; drives how long the item is snoozed. */
  masteryStreak?: number
  /** Item is withheld from rounds until the practice clock reaches this value. */
  snoozedUntil?: number
}

export type RecentResult = {
  firstTryCorrect: boolean
  quick: boolean
}

export type QuizQuestion<T extends Schedulable> = {
  instanceId: string
  item: T
  mode: RoundMode
}

export function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function recentAccuracy(results: RecentResult[]) {
  if (!results.length) return 0
  return results.filter((result) => result.firstTryCorrect).length / results.length
}

/** A round at or above this first-try accuracy counts as mastered. */
export const MASTERY_ROUND_ACCURACY = 0.7

/** Practice clock values roughly equal to one ten-question round. */
const ROUND_TICKS = 10
const BASE_SNOOZE_ROUNDS = 4
const MAX_SNOOZE_ROUNDS = 48

/**
 * The practice clock is the total number of completed answers across every
 * item. It only advances while the player is actually practising, so snoozes
 * are measured in rounds played rather than wall-clock time.
 */
export function practiceClock(performance: Record<string, ItemPerformance>) {
  let total = 0
  for (const stats of Object.values(performance)) total += stats?.completed ?? 0
  return total
}

export function isSnoozed(stats: ItemPerformance | undefined, clock: number) {
  return (stats?.snoozedUntil ?? 0) > clock
}

export function snoozeRoundsFor(streak: number) {
  return Math.min(MAX_SNOOZE_ROUNDS, BASE_SNOOZE_ROUNDS * 2 ** Math.max(0, streak - 1))
}

/**
 * After a round, items the player answered correctly first time are snoozed
 * when the round as a whole was at least 70% correct. Each further mastered
 * round doubles the snooze. A miss resets the streak so the item returns to
 * normal rotation.
 */
export function applyRoundMastery(
  performance: Record<string, ItemPerformance>,
  roundResults: Record<string, boolean>,
): Record<string, ItemPerformance> {
  const ids = Object.keys(roundResults)
  if (!ids.length) return performance
  const correct = ids.filter((id) => roundResults[id]).length
  const mastered = correct / ids.length >= MASTERY_ROUND_ACCURACY
  const clock = practiceClock(performance)
  const next = { ...performance }
  for (const id of ids) {
    const existing = next[id]
    if (!existing) continue
    if (!roundResults[id]) {
      next[id] = { ...existing, masteryStreak: 0, snoozedUntil: undefined }
    } else if (mastered) {
      const streak = (existing.masteryStreak ?? 0) + 1
      next[id] = {
        ...existing,
        masteryStreak: streak,
        snoozedUntil: clock + snoozeRoundsFor(streak) * ROUND_TICKS,
      }
    }
  }
  return next
}

function bySnoozeExpiry<T extends Schedulable>(performance: Record<string, ItemPerformance>) {
  return (first: T, second: T) =>
    (performance[first.id]?.snoozedUntil ?? 0) - (performance[second.id]?.snoozedUntil ?? 0)
}

export function createRound<T extends Schedulable>(
  mode: RoundMode,
  curriculum: T[],
  completions: Record<string, number>,
  performance: Record<string, ItemPerformance>,
  recentResults: RecentResult[],
): QuizQuestion<T>[] {
  let pool: T[]
  const clock = practiceClock(performance)
  const snoozed = (item: T) => isSnoozed(performance[item.id], clock)

  if (mode === 'typed') {
    const ready = curriculum.filter((item) => (completions[item.id] ?? 0) >= 2)
    const active = ready
      .filter((item) => !snoozed(item))
      .sort((first, second) => {
        const firstStats = performance[first.id]
        const secondStats = performance[second.id]
        const firstTyped = firstStats?.typedCompleted ?? 0
        const secondTyped = secondStats?.typedCompleted ?? 0
        return (firstTyped - secondTyped)
          || ((firstStats?.lastTypedAt ?? 0) - (secondStats?.lastTypedAt ?? 0))
          || (first.level - second.level)
      })
    const resting = ready.filter(snoozed).sort(bySnoozeExpiry(performance))
    pool = [...active, ...resting].slice(0, 10)
  } else {
    const accuracy = recentAccuracy(recentResults)
    const seenCount = curriculum.filter((item) => (completions[item.id] ?? 0) > 0).length
    const newItemTarget = seenCount < 10
      ? 10
      : accuracy >= 0.9 ? 8
        : accuracy >= 0.75 ? 6
          : accuracy < 0.6 ? 3
            : 5
    const unseen = curriculum.filter((item) => (completions[item.id] ?? 0) === 0)
    const byLastSeen = (first: T, second: T) =>
      (performance[first.id]?.lastMultipleChoiceAt ?? 0)
      - (performance[second.id]?.lastMultipleChoiceAt ?? 0)
    const needsSecondExposure = curriculum
      .filter((item) => (completions[item.id] ?? 0) === 1 && !snoozed(item))
      .sort(byLastSeen)
    const maintenance = curriculum
      .filter((item) => (completions[item.id] ?? 0) >= 2 && !snoozed(item))
      .sort(byLastSeen)
    const resting = curriculum
      .filter((item) => (completions[item.id] ?? 0) > 0 && snoozed(item))
      .sort(bySnoozeExpiry(performance))
    const selectedUnseen = unseen.slice(0, Math.min(newItemTarget, 10))
    // Snoozed items free up slots, which are filled with further new items
    // before anything mastered is brought back early.
    pool = [
      ...selectedUnseen,
      ...needsSecondExposure.slice(0, 10 - selectedUnseen.length),
      ...maintenance,
      ...unseen.slice(selectedUnseen.length),
      ...needsSecondExposure.slice(10 - selectedUnseen.length),
      ...resting,
    ].slice(0, 10)
  }

  return shuffle(pool).map((item, index) => ({
    instanceId: `${Date.now()}-${index}`,
    item,
    mode,
  }))
}

export function nextRoundMode(
  previousMode: RoundMode,
  curriculum: Schedulable[],
  completions: Record<string, number>,
): RoundMode {
  const typedReadyCount = curriculum.filter(
    (item) => (completions[item.id] ?? 0) >= 2,
  ).length
  if (typedReadyCount < 10) return 'multiple-choice'
  return previousMode === 'multiple-choice' ? 'typed' : 'multiple-choice'
}

export function speedReward(
  item: { averageTypingMs: number; rarity: number },
  responseMs: number,
  typedMode: boolean,
  incorrectAttempts: number,
) {
  if (incorrectAttempts > 0 || responseMs < 550) {
    return { bonus: 0, praise: '', shakeScreen: false, orbCount: 0 }
  }
  const expectedMs = typedMode
    ? item.averageTypingMs
    : Math.max(3_200, item.averageTypingMs * 0.65 + item.rarity * 180)
  const ratio = responseMs / expectedMs

  if (ratio <= 0.3) return { bonus: 12, praise: 'Blazingly fast!', shakeScreen: true, orbCount: 240 }
  if (ratio <= 0.42) return { bonus: 9, praise: 'Insanely fast!', shakeScreen: true, orbCount: 180 }
  if (ratio <= 0.56) return { bonus: 7, praise: 'Amazing!', shakeScreen: true, orbCount: 120 }
  if (ratio <= 0.7) return { bonus: 5, praise: 'Very quick!', shakeScreen: true, orbCount: 80 }
  if (ratio <= 0.82) return { bonus: 3, praise: 'Good job!', shakeScreen: false, orbCount: 48 }
  return { bonus: 0, praise: '', shakeScreen: false, orbCount: 0 }
}

export function loadJsonRecord<T>(key: string): Record<string, T> {
  const saved = window.localStorage.getItem(key)
  if (!saved) return {}
  try {
    return JSON.parse(saved) as Record<string, T>
  } catch {
    return {}
  }
}
