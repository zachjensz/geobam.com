import type { ComponentChildren, Ref } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { isAcceptedAnswer, namePattern } from '../../domain/answers'
import {
  createRound,
  loadJsonRecord,
  nextRoundMode,
  speedReward,
  type ItemPerformance,
  type QuizQuestion,
  type RecentResult,
  type RoundMode,
} from '../../domain/rounds'

export type QuizItem = {
  id: string
  name: string
  aliases: string[]
  level: number
  rarity: 1 | 2 | 3 | 4 | 5
  averageTypingMs: number
  clue: string
}

export type LocationQuizCopy = {
  fileLabel: string
  prompt: string
  typedLabel: string
  returnLabel: string
  roundCompleteBody: string
  typedInputId: string
}

type LocationQuizProps<T extends QuizItem> = {
  xp: number
  onEarnXp: (amount: number) => void
  onUpdateSafePoint: (safe: boolean) => void
  curriculum: T[]
  storageKeys: {
    completions: string
    performance: string
  }
  copy: LocationQuizCopy
  optionsFor: (item: T) => T[]
  renderGlobe: (
    item: T,
    resetSignal: number,
    onTargetPosition: (position: { x: number; y: number }) => void,
  ) => ComponentChildren
  preloadNext?: (item: T) => void
}

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

type TypedAnswerFormProps = {
  inputId: string
  label: string
  disabled: boolean
  feedback: { answer: string; status: 'correct' | 'incorrect' } | null
  inputRef: Ref<HTMLInputElement>
  onSubmit: (value: string) => void
}

function TypedAnswerForm({
  inputId,
  label,
  disabled,
  feedback,
  inputRef,
  onSubmit,
}: TypedAnswerFormProps) {
  const [value, setValue] = useState('')

  return (
    <form
      class="typed-answer"
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim()) onSubmit(value)
      }}
    >
      <label for={inputId}>{label}</label>
      <div>
        <input
          ref={inputRef}
          id={inputId}
          value={value}
          onInput={(event) => setValue(event.currentTarget.value)}
          autocomplete="off"
          disabled={disabled}
          class={feedback ? `answer-field--${feedback.status}` : ''}
        />
        <button type="submit" disabled={disabled}>Verify</button>
      </div>
    </form>
  )
}

export function LocationQuiz<T extends QuizItem>({
  xp,
  onEarnXp,
  onUpdateSafePoint,
  curriculum,
  storageKeys,
  copy,
  optionsFor,
  renderGlobe,
  preloadNext,
}: LocationQuizProps<T>) {
  const level = Math.floor(xp / 100) + 1
  const initialRecords = useMemo(() => {
    const completions = loadJsonRecord<number>(storageKeys.completions)
    const performance = loadJsonRecord<ItemPerformance>(storageKeys.performance)
    return { completions, performance }
  }, [])
  const [multipleChoiceCompletions, setMultipleChoiceCompletions] = useState<Record<string, number>>(
    initialRecords.completions,
  )
  const [itemPerformance, setItemPerformance] = useState<Record<string, ItemPerformance>>(
    initialRecords.performance,
  )
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [activeRoundMode, setActiveRoundMode] = useState<RoundMode>('multiple-choice')
  const [queue, setQueue] = useState<QuizQuestion<T>[]>(
    () => createRound(
      'multiple-choice',
      curriculum,
      initialRecords.completions,
      initialRecords.performance,
      [],
    ),
  )
  const [completed, setCompleted] = useState(0)
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  const [message, setMessage] = useState(copy.prompt)
  const [resetSignal, setResetSignal] = useState(0)
  const [roundComplete, setRoundComplete] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [keyboardSelection, setKeyboardSelection] = useState<string | null>(null)
  const keyboardSelectionRef = useRef<string | null>(null)
  const submitAnswerRef = useRef<(answer: string) => void>(() => {})
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
    () => question ? optionsFor(question.item) : [],
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

  useEffect(() => () => {
    document.documentElement.classList.remove('very-quick-correct')
  }, [])

  useEffect(() => {
    const nextItem = queue[1]?.item
    if (!nextItem || !preloadNext || document.hidden) return
    const idleCallback = () => preloadNext(nextItem)
    if (typeof window.requestIdleCallback === 'function') {
      const idleHandle = window.requestIdleCallback(idleCallback, { timeout: 2000 })
      return () => window.cancelIdleCallback(idleHandle)
    }
    const preloadTimer = window.setTimeout(idleCallback, 80)
    return () => window.clearTimeout(preloadTimer)
  }, [question?.instanceId, queue[1]?.item.id])

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
      if (remaining.length === 0 && nextCompleted >= 10) {
        setRoundComplete(true)
        setMessage('Round complete')
      } else {
        setMessage(copy.prompt)
      }
      return
    }

    if (queue.length > 1) {
      setQueue([...queue.slice(1), question])
      setMessage("We'll come back to that one.")
    }
  }

  const submitAnswer = (answer: string) => {
    if (!question || isTransitioning) return
    setKeyboardSelection(null)
    keyboardSelectionRef.current = null
    if (isAcceptedAnswer(question.item, answer, curriculum)) {
      const responseMs = Math.max(1, performance.now() - answerStartedAtRef.current)
      const speed = speedReward(question.item, responseMs, typedMode, questionAttempts)
      const baseXp = Math.max(5, (typedMode ? 25 : 20) - questionAttempts * 5)
      const earned = baseXp + speed.bonus
      const fastAnswer = speed.bonus >= 5
      setIsTransitioning(true)
      setFeedback({ answer, status: 'correct' })
      if (speed.shakeScreen) {
        document.documentElement.classList.remove('very-quick-correct')
        void document.documentElement.offsetWidth
        document.documentElement.classList.add('very-quick-correct')
        window.setTimeout(() => {
          document.documentElement.classList.remove('very-quick-correct')
        }, 700)
      }
      if (!typedMode) {
        setMultipleChoiceCompletions((current) => {
          const next = {
            ...current,
            [question.item.id]: (current[question.item.id] ?? 0) + 1,
          }
          window.localStorage.setItem(storageKeys.completions, JSON.stringify(next))
          return next
        })
      }
      setItemPerformance((current) => {
        const existing = current[question.item.id] ?? {
          completed: 0,
          firstTryCorrect: 0,
          totalAnswerMs: 0,
          totalAttempts: 0,
        }
        const next = {
          ...current,
          [question.item.id]: {
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
        window.localStorage.setItem(storageKeys.performance, JSON.stringify(next))
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
        count: speed.orbCount || Math.max(4, Math.round((earned / 3) * 2)),
        start: targetPositionRef.current,
        end: targetBounds
          ? { x: targetBounds.left + targetBounds.width / 2, y: targetBounds.top + targetBounds.height / 2 }
          : { x: window.innerWidth - 42, y: 42 },
        praise: speed.praise,
      })
      setMessage(`Correct — ${question.item.name}. +${earned} XP`)
      window.setTimeout(() => {
        onEarnXp(earned)
      }, 760)
      window.setTimeout(() => {
        transitionQuestion(() => {
          nextQuestion(true)
          setIsTransitioning(false)
          setFeedback(null)
        })
      }, fastAnswer ? 450 : 850)
      window.setTimeout(() => setXpBurst(null), 1800)
      return
    }

    const nextAttempts = questionAttempts + 1
    setFeedback({ answer, status: 'incorrect' })
    window.setTimeout(() => {
      setFeedback((current) => current?.status === 'incorrect' ? null : current)
    }, 680)
    setAttempts({ ...attempts, [question.instanceId]: nextAttempts })
    if (nextAttempts === 1) {
      setMessage(`Not quite. Hint: ${question.item.clue}`)
    } else if (typedMode && nextAttempts >= 3) {
      setMessage(`Try again: ${namePattern(question.item.name, nextAttempts - 2)}`)
    } else {
      setMessage('Not yet — this file will return shortly.')
    }

    if (nextAttempts >= 2 && queue.length > 1) {
      setIsTransitioning(true)
      window.setTimeout(() => {
        transitionQuestion(() => {
          nextQuestion(false)
          setIsTransitioning(false)
        })
      }, 680)
    }
  }

  useEffect(() => {
    submitAnswerRef.current = submitAnswer
  })

  useEffect(() => {
    if (typedMode || isTransitioning || roundComplete) return

    const handleKeyboardAnswer = (event: KeyboardEvent) => {
      const keyIndex = ['a', 's', 'd', 'f'].indexOf(event.key.toLowerCase())
      if (keyIndex !== -1 && options[keyIndex]) {
        event.preventDefault()
        const selection = options[keyIndex].name
        setKeyboardSelection(selection)
        keyboardSelectionRef.current = selection
        return
      }
      if (event.key === 'Enter' && keyboardSelectionRef.current) {
        event.preventDefault()
        submitAnswerRef.current(keyboardSelectionRef.current)
      }
    }

    window.addEventListener('keydown', handleKeyboardAnswer)
    return () => window.removeEventListener('keydown', handleKeyboardAnswer)
  }, [typedMode, isTransitioning, roundComplete, options])

  const beginNextRound = () => {
    const mode = nextRoundMode(activeRoundMode, curriculum, multipleChoiceCompletions)
    setActiveRoundMode(mode)
    setQueue(createRound(mode, curriculum, multipleChoiceCompletions, itemPerformance, recentResults))
    setCompleted(0)
    setAttempts({})
    setRoundComplete(false)
    setMessage(copy.prompt)
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
        <p>{copy.roundCompleteBody.replace('{nextLevel}', String(level + 1))}</p>
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
            {copy.fileLabel} · Level {level} · {activeRoundMode === 'typed' ? 'Typed verification' : 'Visual verification'}
          </span>
          <strong>{completed} / 10 resolved</strong>
        </div>
        <div class="quiz-progress" aria-label={`${completed} of 10 items resolved`}>
          <span style={{ width: `${completed * 10}%` }} />
        </div>
      </div>

      <div class="globe-stage">
        {renderGlobe(question.item, resetSignal, (position) => {
          targetPositionRef.current = position
        })}
        <button class="reset-globe" type="button" onClick={() => setResetSignal((value) => value + 1)}>
          <span aria-hidden="true">◎</span> {copy.returnLabel}
        </button>
      </div>

      <div class="answer-panel">
        <div class="answer-heading">
          <p class="kicker">Question {Math.min(completed + 1, 10)} / 10</p>
          <h1>{message}</h1>
        </div>

        {typedMode ? (
          <TypedAnswerForm
            key={question.instanceId}
            inputId={copy.typedInputId}
            label={copy.typedLabel}
            disabled={isTransitioning}
            feedback={feedback}
            inputRef={typedInputRef}
            onSubmit={submitAnswer}
          />
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
        <div
          class={`xp-burst-layer${xpBurst.count >= 48 ? ' xp-burst-layer--fast' : ''}`}
          style={`--burst-x:${xpBurst.start.x}px;--burst-y:${xpBurst.start.y}px;`}
          aria-hidden="true"
          key={xpBurst.id}
        >
          {xpBurst.praise ? (
            <strong
              class="speed-praise"
              style={`--praise-x:${xpBurst.start.x}px;--praise-y:${xpBurst.start.y}px;`}
            >
              {xpBurst.praise}
            </strong>
          ) : null}
          {Array.from({ length: Math.min(xpBurst.count, 60) }, (_, index) => (
            <span
              class="xp-orb"
              style={`--delay:${Math.min(index * 18, 720)}ms;--coin-size:${8 + ((index * 7) % 9)}px;--spread-x:${(((index * 47) % 21) - 10) * (xpBurst.count >= 48 ? 14 : 5)}px;--spread-y:${-12 - ((index * 31) % (xpBurst.count >= 48 ? 110 : 55))}px;--spin:${((index % 2 ? 1 : -1) * (180 + ((index * 83) % 720)))}deg;--start-x:${xpBurst.start.x}px;--start-y:${xpBurst.start.y}px;--end-x:${xpBurst.end.x}px;--end-y:${xpBurst.end.y}px;`}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
