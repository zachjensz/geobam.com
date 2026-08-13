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

export function createRound<T extends Schedulable>(
  mode: RoundMode,
  curriculum: T[],
  completions: Record<string, number>,
  performance: Record<string, ItemPerformance>,
  recentResults: RecentResult[],
): QuizQuestion<T>[] {
  let pool: T[]

  if (mode === 'typed') {
    pool = [...curriculum]
      .filter((item) => (completions[item.id] ?? 0) >= 2)
      .sort((first, second) => {
        const firstStats = performance[first.id]
        const secondStats = performance[second.id]
        const firstTyped = firstStats?.typedCompleted ?? 0
        const secondTyped = secondStats?.typedCompleted ?? 0
        return (firstTyped - secondTyped)
          || ((firstStats?.lastTypedAt ?? 0) - (secondStats?.lastTypedAt ?? 0))
          || (first.level - second.level)
      })
      .slice(0, 10)
  } else {
    const accuracy = recentAccuracy(recentResults)
    const seenCount = curriculum.filter((item) => (completions[item.id] ?? 0) > 0).length
    const newItemTarget = seenCount < 10
      ? 10
      : accuracy >= 0.9 ? 6
        : accuracy >= 0.75 ? 5
          : accuracy < 0.6 ? 2
            : 4
    const frontierSize = Math.min(
      curriculum.length,
      Math.max(10, seenCount + newItemTarget),
    )
    const eligible = curriculum.slice(0, frontierSize)
    const unseen = eligible.filter((item) => (completions[item.id] ?? 0) === 0)
    const needsSecondExposure = eligible
      .filter((item) => (completions[item.id] ?? 0) === 1)
      .sort((first, second) =>
        (performance[first.id]?.lastMultipleChoiceAt ?? 0)
        - (performance[second.id]?.lastMultipleChoiceAt ?? 0),
      )
    const maintenance = eligible
      .filter((item) => (completions[item.id] ?? 0) >= 2)
      .sort((first, second) =>
        (performance[first.id]?.lastMultipleChoiceAt ?? 0)
        - (performance[second.id]?.lastMultipleChoiceAt ?? 0),
      )
    const selectedUnseen = unseen.slice(0, Math.min(newItemTarget, 10))
    pool = [
      ...selectedUnseen,
      ...needsSecondExposure.slice(0, 10 - selectedUnseen.length),
      ...maintenance,
      ...unseen.slice(selectedUnseen.length),
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
  if (incorrectAttempts > 0 || responseMs < 550) return { bonus: 0, praise: '' }
  const expectedMs = typedMode
    ? item.averageTypingMs
    : Math.max(3_200, item.averageTypingMs * 0.65 + item.rarity * 180)
  const ratio = responseMs / expectedMs

  if (ratio <= 0.3) return { bonus: 12, praise: 'Blazingly fast!' }
  if (ratio <= 0.42) return { bonus: 9, praise: 'Insanely fast!' }
  if (ratio <= 0.56) return { bonus: 7, praise: 'Amazing!' }
  if (ratio <= 0.7) return { bonus: 5, praise: 'Very quick!' }
  if (ratio <= 0.82) return { bonus: 3, praise: 'Good job!' }
  return { bonus: 0, praise: '' }
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
