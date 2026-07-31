import { useEffect, useState } from 'preact/hooks'
import { lazy, Suspense } from 'preact/compat'
import './app.css'
import { setServiceWorkerUpdateSafe } from './pwa'

const CountriesQuiz = lazy(() =>
  import('./games/countries/CountriesQuiz').then((module) => ({
    default: module.CountriesQuiz,
  })),
)

type Game = {
  title: string
  description: string
  path: string
  eyebrow: string
  artwork: 'globe' | 'capitals' | 'flags' | 'regions' | 'landmarks' | 'mountains'
  status: 'ready' | 'soon'
}

const games: Game[] = [
  {
    title: 'Countries',
    description: 'Find every nation on an interactive globe.',
    path: '/countries-quiz',
    eyebrow: 'Start here',
    artwork: 'globe',
    status: 'ready',
  },
  {
    title: 'Capital cities',
    description: 'Match the city to its place on the map.',
    path: '/capitals-quiz',
    eyebrow: 'Coming soon',
    artwork: 'capitals',
    status: 'soon',
  },
  {
    title: 'Flags',
    description: 'Learn the colours and symbols of the world.',
    path: '/flags-quiz',
    eyebrow: 'Coming soon',
    artwork: 'flags',
    status: 'soon',
  },
  {
    title: 'Regions',
    description: 'Explore continents one region at a time.',
    path: '/regions-quiz',
    eyebrow: 'Coming soon',
    artwork: 'regions',
    status: 'soon',
  },
  {
    title: 'Landmarks',
    description: 'Place iconic wonders around the globe.',
    path: '/landmarks-quiz',
    eyebrow: 'Coming soon',
    artwork: 'landmarks',
    status: 'soon',
  },
  {
    title: 'Mountains & rivers',
    description: 'Trace the features that shape our planet.',
    path: '/features-quiz',
    eyebrow: 'Coming soon',
    artwork: 'mountains',
    status: 'soon',
  },
]

const Icon = ({ name }: { name: Game['artwork'] }) => {
  if (name === 'globe') {
    return (
      <svg viewBox="0 0 240 160" aria-hidden="true">
        <circle class="art-water" cx="120" cy="81" r="59" />
        <path class="art-land" d="M68 59l17-17 22-7 13 8-7 13-18 3-5 12-18 1zm54 12 16-13 27 4 13 17-8 12-20-3-7 15-13 15-13-12 6-18-8-7z" />
        <path class="art-line" d="M61 81h118M120 22c-22 17-30 40-27 59 3 24 14 43 27 59M120 22c21 17 29 40 27 59-2 24-14 43-27 59" />
        <circle class="art-focus" cx="159" cy="70" r="8" />
      </svg>
    )
  }

  if (name === 'capitals') {
    return (
      <svg viewBox="0 0 240 160" aria-hidden="true">
        <path class="art-paper" d="M39 29l51 11 60-15 50 13v96l-50-12-60 15-51-11z" />
        <path class="art-fold" d="M90 40v97m60-112v97" />
        <path class="art-route" d="M58 105c24-35 45 6 65-22s36-15 58-34" />
        <path class="art-pin" d="M181 37c-11 0-19 8-19 19 0 15 19 35 19 35s19-20 19-35c0-11-8-19-19-19zm0 25a7 7 0 110-14 7 7 0 010 14z" />
      </svg>
    )
  }

  if (name === 'flags') {
    return (
      <svg viewBox="0 0 240 160" aria-hidden="true">
        <path class="art-pole" d="M69 26v110" />
        <path class="art-flag-one" d="M73 32c31-14 52 13 88-3v56c-36 16-57-11-88 3z" />
        <path class="art-flag-two" d="M73 50c31-14 52 13 88-3v19c-36 16-57-11-88 3z" />
        <circle class="art-seal" cx="119" cy="58" r="10" />
      </svg>
    )
  }

  if (name === 'regions') {
    return (
      <svg viewBox="0 0 240 160" aria-hidden="true">
        <path class="art-region-one" d="M58 40l38-15 22 25-9 31-39 2-21-18z" />
        <path class="art-region-two" d="M123 30l51 9 19 28-23 27-43-9-12-34z" />
        <path class="art-region-three" d="M71 89l38-2 23 28-21 25-49-8-13-23z" />
        <path class="art-region-four" d="M137 94l33 6 13 30-29 11-34-20z" />
      </svg>
    )
  }

  if (name === 'landmarks') {
    return (
      <svg viewBox="0 0 240 160" aria-hidden="true">
        <circle class="art-sun" cx="181" cy="40" r="17" />
        <path class="art-ground" d="M29 128h182" />
        <path class="art-monument" d="M84 127l14-83h44l14 83zm12-57h48m-54 34h60M107 44l-5-15h36l-6 15" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 240 160" aria-hidden="true">
      <circle class="art-sun" cx="175" cy="42" r="16" />
      <path class="art-mountain-back" d="M29 130l59-76 34 43 25-31 64 64z" />
      <path class="art-snow" d="M70 76l18-22 18 23-12-4-6 10-7-11zM132 85l15-19 18 22-12-5-6 9-7-9z" />
      <path class="art-river" d="M121 98c-17 9-12 19 4 24 13 4 16 11 4 19" />
    </svg>
  )
}

function navigate(event: MouseEvent, path: string, setPath: (path: string) => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.history.pushState({}, '', path)
  setPath(path)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function BrandMark() {
  return (
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 42 42">
        <circle class="brand-globe-water" cx="19" cy="23" r="14" />
        <path class="brand-globe-land" d="M8.2 18.3l4.2-5.8 5.1-2.7 4.2 1.5-.8 3.6-4.3 1.1-1.6 4.2-4.5 1.2zm14.2 1.1 4.1-3.4 4.6 2 1.7 5.1-3.1 2.2-.6 4.7-4.5 5-2.7-4.4 1.7-4.1-3.1-2.8z" />
        <path class="brand-globe-line" d="M5.5 23h27M19 9c-4.5 4-6.5 9-6.2 14 .3 5.3 2.7 10 6.2 14M19 9c4.5 4 6.5 9 6.2 14-.3 5.3-2.7 10-6.2 14" />
        <path class="brand-fuse" d="M28.4 12.7c.7-3.5 4.4-3.2 4.2-6.2-.1-1.8-1.3-2.8-2.6-3.5" />
        <path class="brand-spark" d="M29.6 1.5 28.4 0m3.5 2.6 2-.8M31 4.1l1.2 1.5" />
      </svg>
    </span>
  )
}

function Brand() {
  return (
    <a class="brand" href="/" aria-label="GeoBam home">
      <BrandMark />
      <span>GeoBam</span>
    </a>
  )
}

function LevelBadge({ xp }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1
  const progress = xp % 100
  const levelLabel = level >= 1_000_000
    ? `${Math.floor(level / 1_000_000)}m`
    : level >= 10_000
      ? `${Math.floor(level / 1_000)}k`
      : String(level)
  const levelDigits = levelLabel.length

  return (
    <div class="level-badge" aria-label={`Overall level ${level}, ${progress} of 100 experience points`}>
      <div class="level-orbit" data-digits={Math.min(levelDigits, 5)} aria-hidden="true">
        <span>{levelLabel}</span>
      </div>
      <div class="level-copy">
        <span>Overall level</span>
        <strong>{xp} XP</strong>
      </div>
      <div class="level-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function Home({ setPath }: { setPath: (path: string) => void }) {
  return (
    <main>
      <section class="intro" aria-labelledby="page-title">
        <p class="kicker">Learn the world, one place at a time</p>
        <h1 id="page-title">Where will you explore?</h1>
        <p class="intro-copy">
          Short, focused geography games that remember what you know and bring
          back what you don't.
        </p>
      </section>

      <section class="game-section" aria-labelledby="game-heading">
        <div class="section-heading">
          <div>
            <p class="section-label">Your atlas</p>
            <h2 id="game-heading">Choose a minigame</h2>
          </div>
          <p>More ways to explore are on the way.</p>
        </div>

        <div class="game-grid">
          {games.map((game, index) => (
            <a
              class={`game-card game-card--${game.artwork} ${game.status === 'ready' ? 'game-card--ready' : ''}`}
              href={game.path}
              onClick={(event) => navigate(event, game.path, setPath)}
              aria-label={`${game.title}. ${game.eyebrow}.`}
              key={game.path}
            >
              <div class="card-art">
                <Icon name={game.artwork} />
                <span class="card-number">0{index + 1}</span>
              </div>
              <div class="card-body">
                <div class="card-meta">
                  <span>{game.eyebrow}</span>
                  {game.status === 'ready' ? <span class="ready-dot">Ready</span> : null}
                </div>
                <h3>{game.title}</h3>
                <p>{game.description}</p>
                <span class="card-action">
                  {game.status === 'ready' ? 'Play now' : 'Preview'}
                  <span aria-hidden="true">↗</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

function GamePage({ game, setPath }: { game: Game; setPath: (path: string) => void }) {
  return (
    <main class="game-page">
      <a class="back-link" href="/" onClick={(event) => navigate(event, '/', setPath)}>
        <span aria-hidden="true">←</span> All minigames
      </a>
      <section class={`game-hero game-hero--${game.artwork}`}>
        <div class="game-hero-art">
          <Icon name={game.artwork} />
        </div>
        <div class="game-hero-copy">
          <p class="kicker">{game.eyebrow}</p>
          <h1>{game.title}</h1>
          <p>{game.description}</p>
          {game.status === 'ready' ? (
            <button type="button" class="primary-button">Begin round</button>
          ) : (
            <span class="coming-soon-pill">In development</span>
          )}
        </div>
      </section>
    </main>
  )
}

export function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [xp, setXp] = useState(() => {
    const savedXp = window.localStorage.getItem('geobam-overall-xp')
    return savedXp ? Number.parseInt(savedXp, 10) || 0 : 0
  })

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  useEffect(() => {
    setServiceWorkerUpdateSafe(path === '/')
  }, [path])

  const game = games.find((item) => item.path === path)

  useEffect(() => {
    const currentGame = games.find((item) => item.path === path)
    document.title = path === '/'
      ? 'GeoBam — Learn the world'
      : path === '/countries-quiz'
        ? 'Countries Quiz — GeoBam'
        : currentGame
          ? `${currentGame.title} — GeoBam`
          : 'Page not found — GeoBam'

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) {
      description.content = path === '/countries-quiz'
        ? 'Identify countries on an interactive 3D globe with adaptive practice that works offline.'
        : currentGame
          ? currentGame.description
          : 'Learn countries and geography through focused, adaptive minigames that work offline.'
    }
  }, [path])

  const earnXp = (amount: number) => {
    setXp((currentXp) => {
      const nextXp = currentXp + amount
      window.localStorage.setItem('geobam-overall-xp', String(nextXp))
      return nextXp
    })
  }

  return (
    <div class="site-shell">
      <header class="site-header">
        <Brand />
        <LevelBadge xp={xp} />
      </header>
      {path === '/' ? <Home setPath={setPath} /> : path === '/countries-quiz' ? (
        <main class="countries-page">
          <a class="back-link" href="/" onClick={(event) => navigate(event, '/', setPath)}>
            <span aria-hidden="true">←</span> All minigames
          </a>
          <Suspense fallback={
            <div class="game-loading" role="status">
              <BrandMark />
              <p>Preparing the globe…</p>
            </div>
          }>
            <CountriesQuiz
              xp={xp}
              onEarnXp={earnXp}
              onUpdateSafePoint={setServiceWorkerUpdateSafe}
            />
          </Suspense>
        </main>
      ) : game ? (
        <GamePage game={game} setPath={setPath} />
      ) : (
        <main class="not-found">
          <p class="kicker">Lost at sea</p>
          <h1>That place isn't on our map.</h1>
          <a href="/" onClick={(event) => navigate(event, '/', setPath)}>Return home</a>
        </main>
      )}
      <footer>
        <Brand />
        <p>Learn the shape of your world.</p>
      </footer>
    </div>
  )
}
