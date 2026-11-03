export type RoundMode = 'multiple-choice' | 'typed' | 'locate'

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
  locateCompleted?: number
  lastLocateAt?: number
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

/** Practice clock values roughly equal to one ten-question round. */
const ROUND_TICKS = 10
/** A first-try correct item stays away for at least this many answers. */
export const MIN_SNOOZE_TURNS = 50
const BASE_SNOOZE_ROUNDS = MIN_SNOOZE_TURNS / ROUND_TICKS
const MAX_SNOOZE_ROUNDS = 80

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
 * After a round, every item the player answered correctly first time is
 * snoozed for at least MIN_SNOOZE_TURNS answers, doubling with each further
 * clean answer. A miss resets the streak so the item returns to normal
 * rotation.
 */
export function applyRoundMastery(
  performance: Record<string, ItemPerformance>,
  roundResults: Record<string, boolean>,
): Record<string, ItemPerformance> {
  const ids = Object.keys(roundResults)
  if (!ids.length) return performance
  const clock = practiceClock(performance)
  const next = { ...performance }
  for (const id of ids) {
    const existing = next[id]
    if (!existing) continue
    if (!roundResults[id]) {
      next[id] = { ...existing, masteryStreak: 0, snoozedUntil: undefined }
    } else {
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

/** True once the player has answered the item cleanly at least once. */
function isKnown(stats: ItemPerformance | undefined) {
  return (stats?.masteryStreak ?? 0) > 0
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

  if (mode === 'typed' || mode === 'locate') {
    const typed = mode === 'typed'
    const minCompletions = typed ? 2 : 1
    const done = (stats: ItemPerformance | undefined) =>
      typed ? stats?.typedCompleted ?? 0 : stats?.locateCompleted ?? 0
    const last = (stats: ItemPerformance | undefined) =>
      typed ? stats?.lastTypedAt ?? 0 : stats?.lastLocateAt ?? 0
    const ready = curriculum.filter((item) => (completions[item.id] ?? 0) >= minCompletions)
    const active = ready
      .filter((item) => !snoozed(item))
      .sort((first, second) => {
        const firstStats = performance[first.id]
        const secondStats = performance[second.id]
        return (Number(isKnown(firstStats)) - Number(isKnown(secondStats)))
          || (done(firstStats) - done(secondStats))
          || (last(firstStats) - last(secondStats))
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
    // Items the player last answered cleanly are far less useful than a new
    // item, so they only return once every unseen item has been introduced.
    const needsSecondExposure = curriculum
      .filter((item) => (completions[item.id] ?? 0) === 1 && !snoozed(item) && !isKnown(performance[item.id]))
      .sort(byLastSeen)
    const maintenance = curriculum
      .filter((item) => (completions[item.id] ?? 0) >= 2 && !snoozed(item) && !isKnown(performance[item.id]))
      .sort(byLastSeen)
    const known = curriculum
      .filter((item) => (completions[item.id] ?? 0) > 0 && !snoozed(item) && isKnown(performance[item.id]))
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
      ...known,
      ...resting,
    ].slice(0, 10)
  }

  return shuffle(pool).map((item, index) => ({
    instanceId: `${Date.now()}-${index}`,
    item,
    mode,
  }))
}

/** Round types in rotation order; each joins once ten items are ready for it. */
const ROUND_ROTATION: RoundMode[] = ['multiple-choice', 'typed', 'multiple-choice', 'locate']

export function nextRoundMode(
  previousMode: RoundMode,
  curriculum: Schedulable[],
  completions: Record<string, number>,
  { locate = false, roundNumber = 0 }: { locate?: boolean; roundNumber?: number } = {},
): RoundMode {
  const readyCount = (min: number) =>
    curriculum.filter((item) => (completions[item.id] ?? 0) >= min).length
  const available = (mode: RoundMode) =>
    mode === 'multiple-choice'
    || (mode === 'typed' && readyCount(2) >= 10)
    || (mode === 'locate' && locate && readyCount(1) >= 10)
  if (!locate) {
    if (!available('typed')) return 'multiple-choice'
    return previousMode === 'multiple-choice' ? 'typed' : 'multiple-choice'
  }
  // Alternate multiple choice with the recall rounds that are unlocked.
  if (previousMode !== 'multiple-choice') return 'multiple-choice'
  const recall = ROUND_ROTATION.filter((mode) => mode !== 'multiple-choice' && available(mode))
  if (!recall.length) return 'multiple-choice'
  return recall[roundNumber % recall.length]
}

export function speedReward(
  item: { averageTypingMs: number; rarity: number },
  responseMs: number,
  mode: RoundMode,
  incorrectAttempts: number,
) {
  if (incorrectAttempts > 0 || responseMs < 550) {
    return { bonus: 0, praise: '', shakeScreen: false, orbCount: 0 }
  }
  // Finding a country means spinning the globe, so it gets a longer allowance.
  const expectedMs = mode === 'typed'
    ? item.averageTypingMs
    : mode === 'locate'
      ? Math.max(5_500, item.averageTypingMs + item.rarity * 600)
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
