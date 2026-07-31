import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Country } from './curriculum'
import { countriesForLevel, countryCurriculum, isAcceptedAnswer, namePattern } from './curriculum'
import { CountryGlobe, preloadCountryMap } from './CountryGlobe'

type QuizQuestion = {
  instanceId: string
  country: Country
  mode: 'multiple-choice' | 'typed'
}

type CountriesQuizProps = {
  xp: number
  onEarnXp: (amount: number) => void
  onUpdateSafePoint: (safe: boolean) => void
}

type CountryPerformance = {
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

type RecentResult = {
  firstTryCorrect: boolean
  quick: boolean
}

type RoundMode = 'multiple-choice' | 'typed'

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

function transitionQuestion(update: () => void) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as TransitionDocument
  if (reducedMotion || !transitionDocument.startViewTransition) {
    update()
    return
  }
  transitionDocument.startViewTransition(update)
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function loadMultipleChoiceCompletions() {
  const saved = window.localStorage.getItem('geobam-country-multiple-choice-completions')
  if (!saved) return {}
  try {
    return JSON.parse(saved) as Record<string, number>
  } catch {
    return {}
  }
}

function recentAccuracy(results: RecentResult[]) {
  if (!results.length) return 0
  return results.filter((result) => result.firstTryCorrect).length / results.length
}

function createRound(
  mode: RoundMode,
  completions: Record<string, number>,
  performance: Record<string, CountryPerformance>,
  recentResults: RecentResult[],
) {
  let pool: Country[]

  if (mode === 'typed') {
    pool = [...countryCurriculum]
      .filter((country) => (completions[country.id] ?? 0) >= 2)
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
    const seenCount = countryCurriculum.filter((country) => (completions[country.id] ?? 0) > 0).length
    const newCountryTarget = seenCount < 10
      ? 10
      : accuracy >= 0.9 ? 6
        : accuracy >= 0.75 ? 5
          : accuracy < 0.6 ? 2
            : 4
    const frontierSize = Math.min(
      countryCurriculum.length,
      Math.max(10, seenCount + newCountryTarget),
    )
    const eligible = countryCurriculum.slice(0, frontierSize)
    const unseen = eligible.filter((country) => (completions[country.id] ?? 0) === 0)
    const needsSecondExposure = eligible
      .filter((country) => (completions[country.id] ?? 0) === 1)
      .sort((first, second) =>
        (performance[first.id]?.lastMultipleChoiceAt ?? 0)
        - (performance[second.id]?.lastMultipleChoiceAt ?? 0),
      )
    const maintenance = eligible
      .filter((country) => (completions[country.id] ?? 0) >= 2)
      .sort((first, second) =>
        (performance[first.id]?.lastMultipleChoiceAt ?? 0)
        - (performance[second.id]?.lastMultipleChoiceAt ?? 0),
      )
    const selectedUnseen = unseen.slice(0, Math.min(newCountryTarget, 10))
    pool = [
      ...selectedUnseen,
      ...needsSecondExposure.slice(0, 10 - selectedUnseen.length),
      ...maintenance,
      ...unseen.slice(selectedUnseen.length),
    ].slice(0, 10)
  }

  return shuffle(pool).map((country, index) => ({
    instanceId: `${Date.now()}-${index}`,
    country,
    mode,
  }))
}

function loadPerformance() {
  const saved = window.localStorage.getItem('geobam-country-performance')
  if (!saved) return {}
  try {
    return JSON.parse(saved) as Record<string, CountryPerformance>
  } catch {
    return {}
  }
}

function nextRoundMode(
  previousMode: RoundMode,
  completions: Record<string, number>,
): RoundMode {
  const typedReadyCount = countryCurriculum.filter(
    (country) => (completions[country.id] ?? 0) >= 2,
  ).length
  if (typedReadyCount < 10) return 'multiple-choice'
  return previousMode === 'multiple-choice' ? 'typed' : 'multiple-choice'
}

function speedReward(
  country: Country,
  responseMs: number,
  typedMode: boolean,
  incorrectAttempts: number,
) {
  if (incorrectAttempts > 0 || responseMs < 550) return { bonus: 0, praise: '' }
  const expectedMs = typedMode
    ? country.averageTypingMs
    : Math.max(3_200, country.averageTypingMs * 0.65 + country.rarity * 180)
  const ratio = responseMs / expectedMs

  if (ratio <= 0.3) return { bonus: 12, praise: 'Blazingly fast!' }
  if (ratio <= 0.42) return { bonus: 9, praise: 'Insanely fast!' }
  if (ratio <= 0.56) return { bonus: 7, praise: 'Amazing!' }
  if (ratio <= 0.7) return { bonus: 5, praise: 'Very quick!' }
  if (ratio <= 0.82) return { bonus: 3, praise: 'Good job!' }
  return { bonus: 0, praise: '' }
}

function answerOptions(question: Country, level: number) {
  const pool = countriesForLevel(Math.max(level, 2)).filter((country) => country.id !== question.id)
  return shuffle([question, ...shuffle(pool).slice(0, 3)])
}

export function CountriesQuiz({ xp, onEarnXp, onUpdateSafePoint }: CountriesQuizProps) {
  const level = Math.floor(xp / 100) + 1
  const [multipleChoiceCompletions, setMultipleChoiceCompletions] = useState<Record<string, number>>(
    loadMultipleChoiceCompletions,
  )
  const [countryPerformance, setCountryPerformance] = useState<Record<string, CountryPerformance>>(
    loadPerformance,
  )
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [activeRoundMode, setActiveRoundMode] = useState<RoundMode>('multiple-choice')
  const [queue, setQueue] = useState<QuizQuestion[]>(
    () => createRound('multiple-choice', loadMultipleChoiceCompletions(), loadPerformance(), []),
  )
  const [completed, setCompleted] = useState(0)
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [typedAnswer, setTypedAnswer] = useState('')
  const [message, setMessage] = useState('Which country is highlighted?')
  const [resetSignal, setResetSignal] = useState(0)
  const [roundComplete, setRoundComplete] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [keyboardSelection, setKeyboardSelection] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    answer: string
    status: 'correct' | 'incorrect'
  } | null>(null)
  const [xpBurst, setXpBurst] = useState<{
    id: number
    count: number
    start: { x: number; y: number }
    end: { x: number; y: number }
    praise: string
  } | null>(null)
  const typedInputRef = useRef<HTMLInputElement>(null)
  const nextRoundButtonRef = useRef<HTMLButtonElement>(null)
  const targetPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const answerStartedAtRef = useRef(performance.now())

  const question = queue[0]
  const questionAttempts = question ? attempts[question.instanceId] ?? 0 : 0
  const typedMode = question?.mode === 'typed'
  const options = useMemo(
    () => question ? answerOptions(question.country, Math.max(2, question.country.level)) : [],
    [question?.instanceId],
  )

  useEffect(() => {
    if (!typedMode || isTransitioning) return
    const focusInput = () => {
      const input = typedInputRef.current
      if (!input || input.disabled || document.activeElement === input) return
      input.focus({ preventScroll: true })
      input.select()
    }
    const frame = requestAnimationFrame(focusInput)
    const fallback = window.setTimeout(focusInput, 240)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
    }
  }, [question?.instanceId, typedMode, isTransitioning])

  useEffect(() => {
    answerStartedAtRef.current = performance.now()
  }, [question?.instanceId])

  useEffect(() => {
    const nextCountryId = queue[1]?.country.id
    if (!nextCountryId) return
    const preloadTimer = window.setTimeout(
      () => preloadCountryMap(nextCountryId, queue[1].country.showIslandEnvelope),
      80,
    )
    return () => window.clearTimeout(preloadTimer)
  }, [question?.instanceId, queue[1]?.country.id, queue[1]?.country.showIslandEnvelope])

  useEffect(() => {
    onUpdateSafePoint(roundComplete)
    if (!roundComplete) return
    const focusNextRound = () => {
      const button = nextRoundButtonRef.current
      if (!button || document.activeElement === button) return
      button.focus({ preventScroll: true })
    }
    const frame = requestAnimationFrame(focusNextRound)
    const fallback = window.setTimeout(focusNextRound, 240)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
    }
  }, [roundComplete, onUpdateSafePoint])

  const nextQuestion = (wasCorrect: boolean) => {
    if (!question) return
    if (wasCorrect) {
      const remaining = queue.slice(1)
      const nextCompleted = completed + 1
      setCompleted(nextCompleted)
      setQueue(remaining)
      setTypedAnswer('')
      if (remaining.length === 0 && nextCompleted >= 10) {
        setRoundComplete(true)
        setMessage('Round complete')
      } else {
        setMessage('Which country is highlighted?')
      }
      return
    }

    if (queue.length > 1) {
      setQueue([...queue.slice(1), question])
      setTypedAnswer('')
      setMessage("We'll come back to that one.")
    }
  }

  const submitAnswer = (answer: string) => {
    if (!question || isTransitioning) return
    setKeyboardSelection(null)
    if (isAcceptedAnswer(question.country, answer)) {
      const responseMs = Math.max(1, performance.now() - answerStartedAtRef.current)
      const speed = speedReward(question.country, responseMs, typedMode, questionAttempts)
      const baseXp = Math.max(5, (typedMode ? 25 : 20) - questionAttempts * 5)
      const earned = baseXp + speed.bonus
      setIsTransitioning(true)
      setFeedback({ answer, status: 'correct' })
      if (!typedMode) {
        setMultipleChoiceCompletions((current) => {
          const next = {
            ...current,
            [question.country.id]: (current[question.country.id] ?? 0) + 1,
          }
          window.localStorage.setItem(
            'geobam-country-multiple-choice-completions',
            JSON.stringify(next),
          )
          return next
        })
      }
      setCountryPerformance((current) => {
        const existing = current[question.country.id] ?? {
          completed: 0,
          firstTryCorrect: 0,
          totalAnswerMs: 0,
          totalAttempts: 0,
        }
        const next = {
          ...current,
          [question.country.id]: {
            completed: existing.completed + 1,
            firstTryCorrect: existing.firstTryCorrect + (questionAttempts === 0 ? 1 : 0),
            totalAnswerMs: existing.totalAnswerMs + responseMs,
            totalAttempts: existing.totalAttempts + questionAttempts + 1,
            lastCompletedAt: Date.now(),
            multipleChoiceCompleted:
              (existing.multipleChoiceCompleted ?? 0) + (typedMode ? 0 : 1),
            typedCompleted: (existing.typedCompleted ?? 0) + (typedMode ? 1 : 0),
            lastMultipleChoiceAt: typedMode
              ? existing.lastMultipleChoiceAt
              : Date.now(),
            lastTypedAt: typedMode ? Date.now() : existing.lastTypedAt,
          },
        }
        window.localStorage.setItem('geobam-country-performance', JSON.stringify(next))
        return next
      })
      setRecentResults((current) => [
        ...current,
        {
          firstTryCorrect: questionAttempts === 0,
          quick: speed.bonus >= 5,
        },
      ].slice(-20))
      const progressTarget = document.querySelector<HTMLElement>('.level-track')
      const fallbackTarget = document.querySelector<HTMLElement>('.level-orbit')
      const target = progressTarget?.offsetParent ? progressTarget : fallbackTarget
      const targetBounds = target?.getBoundingClientRect()
      setXpBurst({
        id: Date.now(),
        count: Math.max(2, Math.round(earned / 3)),
        start: targetPositionRef.current,
        end: targetBounds
          ? { x: targetBounds.left + targetBounds.width / 2, y: targetBounds.top + targetBounds.height / 2 }
          : { x: window.innerWidth - 42, y: 42 },
        praise: speed.praise,
      })
      setMessage(`Correct — ${question.country.name}. +${earned} XP`)
      window.setTimeout(() => {
        onEarnXp(earned)
      }, 760)
      window.setTimeout(() => {
        transitionQuestion(() => {
          nextQuestion(true)
          setIsTransitioning(false)
          setFeedback(null)
        })
      }, 850)
      window.setTimeout(() => setXpBurst(null), 1250)
      return
    }

    const nextAttempts = questionAttempts + 1
    setFeedback({ answer, status: 'incorrect' })
    window.setTimeout(() => {
      setFeedback((current) => current?.status === 'incorrect' ? null : current)
    }, 520)
    setAttempts({ ...attempts, [question.instanceId]: nextAttempts })
    if (nextAttempts === 1) {
      setMessage(`Not quite. Hint: ${question.country.clue}`)
    } else if (typedMode && nextAttempts >= 3) {
      setMessage(`Try again: ${namePattern(question.country.name, nextAttempts - 2)}`)
    } else {
      setMessage('Not yet — this country will return shortly.')
    }

    if (nextAttempts >= 2 && queue.length > 1) {
      setIsTransitioning(true)
      window.setTimeout(() => {
        transitionQuestion(() => {
          nextQuestion(false)
          setIsTransitioning(false)
        })
      }, 520)
    }
  }

  useEffect(() => {
    if (typedMode || isTransitioning || roundComplete) return

    const handleKeyboardAnswer = (event: KeyboardEvent) => {
      const keyIndex = ['a', 's', 'd', 'f'].indexOf(event.key.toLowerCase())
      if (keyIndex !== -1 && options[keyIndex]) {
        event.preventDefault()
        setKeyboardSelection(options[keyIndex].name)
        return
      }
      if (event.key === 'Enter' && keyboardSelection) {
        event.preventDefault()
        submitAnswer(keyboardSelection)
      }
    }

    window.addEventListener('keydown', handleKeyboardAnswer)
    return () => window.removeEventListener('keydown', handleKeyboardAnswer)
  }, [typedMode, isTransitioning, roundComplete, keyboardSelection, options])

  const beginNextRound = () => {
    const mode = nextRoundMode(activeRoundMode, multipleChoiceCompletions)
    setActiveRoundMode(mode)
    setQueue(createRound(mode, multipleChoiceCompletions, countryPerformance, recentResults))
    setCompleted(0)
    setAttempts({})
    setRoundComplete(false)
    setMessage('Which country is highlighted?')
  }

  if (roundComplete) {
    const confettiColors = ['#78966f', '#b1976c', '#d0a34e', '#527785', '#e4ddd0']

    return (
      <section class="round-complete">
        <div class="confetti-burst" aria-hidden="true">
          {Array.from({ length: 34 }, (_, index) => {
            const horizontal = ((index * 37) % 96) - 48
            const vertical = 28 + ((index * 29) % 65)
            const rotation = ((index * 83) % 540) - 270
            return (
              <span
                style={`--confetti-x:${horizontal}vw;--confetti-y:${vertical}vh;--confetti-rotation:${rotation}deg;--confetti-delay:${(index % 8) * 22}ms;background:${confettiColors[index % confettiColors.length]};`}
              />
            )
          })}
        </div>
        <span class="round-medallion">10</span>
        <p class="kicker">Batch verified · 10 / 10 filed</p>
        <h1>Record cleared.</h1>
        <p>Every country in this batch has been resolved. Your registry record now advances toward level {level + 1}.</p>
        <div class="round-actions">
          <button
            ref={nextRoundButtonRef}
            type="button"
            class="primary-button next-round-button"
            onClick={beginNextRound}
          >
            Next batch
            <kbd>Enter</kbd>
          </button>
          <a class="secondary-button" href="/">Return to registry</a>
        </div>
      </section>
    )
  }

  if (!question) return null

  return (
    <section class="quiz-shell">
      <div class="quiz-topline">
        <div>
          <span>
            File 001 · Countries · Level {level} · {activeRoundMode === 'typed' ? 'Typed verification' : 'Visual verification'}
          </span>
          <strong>{completed} / 10 resolved</strong>
        </div>
        <div class="quiz-progress" aria-label={`${completed} of 10 countries resolved`}>
          <span style={{ width: `${completed * 10}%` }} />
        </div>
      </div>

      <div class="globe-stage">
        <CountryGlobe
          countryId={question.country.id}
          countryName="the mystery country"
          focus={question.country.focus}
          showSmallCountryMarker={question.country.showSmallCountryMarker}
          isIslandNation={question.country.isIslandNation}
          showIslandEnvelope={question.country.showIslandEnvelope}
          resetSignal={resetSignal}
          onTargetPosition={(position) => {
            targetPositionRef.current = position
          }}
        />
        <button class="reset-globe" type="button" onClick={() => setResetSignal((value) => value + 1)}>
          <span aria-hidden="true">◎</span> Return to country
        </button>
      </div>

      <div class="answer-panel">
        <div class="answer-heading">
          <p class="kicker">Question {Math.min(completed + 1, 10)} / 10</p>
          <h1>{message}</h1>
        </div>

        {typedMode ? (
          <form
            class="typed-answer"
            onSubmit={(event) => {
              event.preventDefault()
              if (typedAnswer.trim()) submitAnswer(typedAnswer)
            }}
          >
            <label for="country-answer">Enter registered country name</label>
            <div>
              <input
                ref={typedInputRef}
                id="country-answer"
                value={typedAnswer}
                onInput={(event) => setTypedAnswer(event.currentTarget.value)}
                autocomplete="off"
                disabled={isTransitioning}
                class={feedback ? `answer-field--${feedback.status}` : ''}
              />
              <button type="submit" disabled={isTransitioning}>Verify</button>
            </div>
          </form>
        ) : (
          <div class="answer-options-wrap">
            <div class="answer-options">
            {options.map((option, index) => (
              <button
                type="button"
                onClick={() => submitAnswer(option.name)}
                disabled={isTransitioning}
                class={
                  feedback?.answer === option.name
                    ? `answer-option--${feedback.status}`
                    : keyboardSelection === option.name
                      ? 'answer-option--selected'
                      : ''
                }
                key={option.id}
              >
                <span>{option.name}</span>
                <kbd class="option-key">{['A', 'S', 'D', 'F'][index]}</kbd>
              </button>
            ))}
            </div>
            {keyboardSelection ? (
              <div class="keyboard-confirm-hint" aria-live="polite">
                <kbd>Enter</kbd>
                <span>Confirm answer</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {xpBurst ? (
        <div class="xp-burst-layer" aria-hidden="true" key={xpBurst.id}>
          {xpBurst.praise ? (
            <strong
              class="speed-praise"
              style={`--praise-x:${xpBurst.start.x}px;--praise-y:${xpBurst.start.y}px;`}
            >
              {xpBurst.praise}
            </strong>
          ) : null}
          {Array.from({ length: xpBurst.count }, (_, index) => (
            <span
              class="xp-orb"
              style={`--delay:${index * 45}ms;--spread-x:${((index % 4) - 1.5) * 9}px;--spread-y:${(index % 3) * -7}px;--start-x:${xpBurst.start.x}px;--start-y:${xpBurst.start.y}px;--end-x:${xpBurst.end.x}px;--end-y:${xpBurst.end.y}px;`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
