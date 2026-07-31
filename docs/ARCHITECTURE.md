# GeoBam Architectural Design

Status: Initial planning draft
Last updated: 2026-07-29

## 1. Product overview

GeoBam is a browser-based collection of short geography learning games. Players build knowledge through repeated practice, earn XP, and level up independently in each minigame.

The first minigame teaches the locations and names of countries and territories using an interactive 3D globe. The second will teach capital cities. Later games can reuse the same content, scheduling, progression, and session systems.

### Product goals

- Make geography practice quick, visual, and enjoyable.
- Move players from recognition to unaided recall.
- Spend more practice time on weak knowledge than mastered knowledge.
- Make progress visible globally and within each minigame.
- Work well without requiring an account.
- Be installable and fully usable offline after the player downloads their chosen games.
- Make it straightforward to add new geography minigames.

### Initial non-goals

- User accounts, authentication, and cloud synchronization.
- Multiplayer or competitive matchmaking.
- User-generated questions.
- Native mobile applications.
- A general-purpose learning management system.
- Perfect support for every territory or disputed region at first launch.

## 2. Confirmed product decisions

- The frontend will use Preact, TypeScript, and Vite.
- An account is not required and accounts are out of scope for the initial release.
- Progress will be stored locally in the browser.
- Country questions will support multiple-choice and typed answers.
- Multiple choice is the easier recognition stage; typed answers are the harder recall stage unlocked as the player improves.
- The geography catalogue will contain all UN member states and a curated set of territories.
- The initial playable catalogue contains all 193 UN member states, Vatican City/Holy See, and Bermuda. Palestine is excluded from the current playable catalogue. Other territories and disputed states remain separately curated.
- Ambiguous or politically sensitive entries, such as Kosovo and Western Sahara, will be reviewed individually before finalizing the launch catalogue.
- The initial curriculum assumes a Western audience: widely known Western countries appear early, while less familiar African, Pacific Island, and Caribbean microstates are introduced substantially later.
- Country practice will use a Three.js 3D globe with the target geography highlighted.
- GeoBam will be an installable Progressive Web App (PWA).
- The app shell and each downloaded minigame must work fully offline.
- Players can choose which minigames and their associated content packs are stored on their device.
- On the first website visit, the core PWA shell and country minigame pack will begin downloading automatically.
- Every minigame, including countries, remains a separate package that can be updated or uninstalled independently.
- The first country levels must become playable before the complete country pack finishes downloading.
- When the player installs the PWA, GeoBam will offer additional minigame downloads and request persistent browser storage.
- App-shell and service-worker updates download silently, then activate only on the main menu or after a round completes. Future optional content-pack updates may retain a separate player-approval policy when their download size warrants it.
- The first minigame uses a single global curriculum. Region-selectable practice will be introduced through future minigames.
- Contextual map clues are controlled by level difficulty: plentiful early and increasingly uncommon later.
- Levels continue indefinitely.
- Daily return streaks are deferred until a later release.
- Uninstalling a minigame never removes its progress; progress deletion is a separate explicit main-menu action.
- Progress export and import are deferred in favor of a future account system.
- Rounds contain 10 scheduled questions, with required retries allowed to extend the round.
- Multiple-choice questions present four options.
- Players can rotate and zoom the globe freely and can return the camera to the target.
- Typed questions have no autocomplete.
- XP determines the player's visible, indefinitely increasing minigame level.
- Detailed per-country performance is collected for scheduling but not exposed until a future statistics explorer.
- Correct answers trigger a prominent visual XP-orb reward animation; the initial release has no sound or haptic feedback.
- Analytics and telemetry are out of scope for the initial release.
- The UI supports light, dark, and system theme settings; system follows the CSS color-scheme media query.

## 3. Experience architecture

### Main routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard showing total XP, minigames, per-game level, and suggested next activity |
| `/games/countries` | Country game introduction, progress, settings, and start action |
| `/games/countries/play` | Active country practice session |
| `/games/capitals` | Capital cities placeholder and, later, game introduction |
| `/downloads` | Install, update, or remove offline minigame packs and show their storage usage |
| `/settings` | Theme, accessibility, reduced motion, and local-data controls |

Routing should remain client-side for the initial static application.

### Dashboard

The dashboard is the home of the overall progression system. It should show:

- Total XP across all games.
- A card for every minigame.
- Per-game level, XP progress, and play action.
- A clear distinction between available and upcoming games.
- A suggested activity based on due review items, without punishing players for missing a day.
- The offline availability and download state of each minigame.

### Visual direction

The interface should be minimalist, modern, and restrained. Controls, typography, progress, and navigation should feel sleek and uncluttered. The globe and geographic artwork should provide the richness: polished, artful, and subtly inspired by expensive antique maps without looking old-fashioned.

The two layers should share a deliberate palette and typography so the map does not feel embedded from a different product. Prefer refined cartographic texture, elegant borders, restrained depth, and high-quality lighting over ornamental clutter. Readability, geographic accuracy, accessibility, and rendering performance take priority over decorative detail.

Both light and dark themes should preserve this direction. The player can choose `light`, `dark`, or `system`; `system` follows `prefers-color-scheme` and responds when the operating-system preference changes.

### Typical learning loop

1. The player chooses a minigame.
2. The game creates a short session from due reviews, weak items, and limited new material.
3. The player answers a question.
4. The game gives immediate feedback and an explanation or contextual cue.
5. The scheduler updates that item's mastery and decides when it should return.
6. The player receives XP and sees session progress.
7. At the end, the game summarizes gains, difficult items, and the next milestone.

Play is organized into rounds of 10 scheduled questions. After finishing a round, the player can immediately continue into another, creating an effectively endless play loop. Required retries may extend a round beyond 10 prompts, and every missed item must ultimately be answered correctly before completion.

## 4. Technical architecture

GeoBam should begin as a local-first single-page application. Game logic should not depend directly on browser storage or rendering technology.

```text
Preact UI
├── App shell and routing
├── Dashboard and progression UI
├── Game framework
│   ├── Session controller
│   ├── Question and answer UI
│   └── Feedback and summary UI
├── Country game
│   ├── Country question generator
│   └── Three.js globe
└── Capital cities game
    └── Placeholder, then capital question generator

Domain layer
├── Geography catalogue
├── Spaced-repetition scheduler
├── Mastery and level calculation
├── XP rules
└── Answer normalization

Persistence
├── Progress repository
│   └── Browser implementation using IndexedDB
└── Content pack manager
    ├── Service worker and Cache Storage
    └── Pack manifest and installation state
```

### Recommended source layout

```text
src/
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers/
├── components/
│   ├── layout/
│   ├── feedback/
│   └── progress/
├── domain/
│   ├── catalogue/
│   ├── progression/
│   ├── scheduling/
│   └── sessions/
├── games/
│   ├── countries/
│   │   ├── components/
│   │   ├── globe/
│   │   ├── questions/
│   │   └── countryGame.ts
│   └── capitals/
│       └── capitalGame.ts
├── persistence/
│   ├── ProgressRepository.ts
│   └── indexedDb/
├── pwa/
│   ├── serviceWorker/
│   ├── contentPacks/
│   └── manifests/
├── pages/
├── styles/
└── test/
```

Folders should be added only when needed; this layout defines boundaries rather than requiring empty scaffolding.

### Shared game contract

Each minigame should provide a small definition consumed by the dashboard and session framework:

```ts
interface GameDefinition<Question, Answer> {
  id: string;
  title: string;
  description: string;
  availability: "available" | "coming-soon";
  createQuestion(context: QuestionContext): Question;
  evaluate(question: Question, answer: Answer): AnswerResult;
  getMasteryItemId(question: Question): string;
}
```

The shared framework owns session flow, feedback timing, XP events, and persistence. A game owns its content, question generation, answer rules, and specialized visuals.

### State management

Start with Preact context and reducer-style state for app-wide session and progress state. Keep transient globe animation and input state inside their feature components. Introduce a third-party state library only if observed complexity justifies it.

### Persistence

Use IndexedDB for durable local progress because mastery records grow over time and require structured queries and migrations. A small repository interface should isolate IndexedDB from domain code.

Local storage may be used for tiny preferences, but not as the main progress database.

The stored data needs:

- A schema version.
- Forward migrations.
- A clearly labelled reset option with confirmation.
- Graceful handling of unavailable or corrupted browser storage.

No account means progress initially belongs to one browser profile and may be lost when site data is cleared. The UI should communicate this clearly. Export and import are not part of the initial release; a future account system will provide cross-device persistence.

### PWA and offline content architecture

The PWA must begin caching a minimal application shell on the first website visit so the dashboard, settings, progress, and download manager can subsequently open offline. Minigame code and large assets should be distributed as independently versioned content packs rather than forcing every player to download every game.

On the first visit, GeoBam should also begin installing the country minigame pack. The complete pack includes the full 3D globe, country catalogue, question-generation logic, and required visual assets. Its download budget should remain reasonable through simplified geometry, compression, code splitting, and asset reuse.

The country pack should have staged readiness:

1. **Shell ready:** dashboard and download status work.
2. **Starter ready:** the player can immediately begin the earliest country levels using a small initial content and geometry slice.
3. **Offline ready:** the complete globe, catalogue, logic, and assets are verified and the entire country game works offline.

Downloads continue in the background while the player uses starter content. If background installation is interrupted, the last verified stage remains usable and the UI offers a clear retry action. The country pack is not part of the immutable core: it uses the same package lifecycle as every later minigame and remains independently updateable and removable.

When the browser PWA is installed, GeoBam should show an in-app setup step that offers available additional minigame packs and requests persistent storage through the browser API. A denial must not block play; the app should explain that cached games and local progress may be evicted under storage pressure.

Each pack manifest should declare:

```ts
interface ContentPackManifest {
  gameId: string;
  version: string;
  minimumAppVersion: string;
  estimatedBytes: number;
  assets: Array<{
    url: string;
    revision: string;
    bytes: number;
  }>;
}
```

The content pack manager is responsible for:

- Downloading all required files atomically into Cache Storage.
- Showing download size, progress, completion, failure, and update state.
- Verifying that every required asset is cached before marking a game available offline.
- Resuming or safely restarting interrupted downloads.
- Retaining the last working pack until an update is completely installed.
- Detecting available updates without applying them automatically.
- Offering updates between rounds or elsewhere outside active gameplay.
- Removing a selected game's cached code and assets without deleting player progress.
- Detecting insufficient storage and explaining recovery options.
- Reconciling cached pack versions after an application update.

The core application should remain useful when a game is not installed: its card can show progress and offer a download action. Starting an uninstalled game while offline should show a clear explanation rather than a broken route.

After a player removes the automatically installed country pack, it should behave exactly like any other uninstalled game and may be downloaded again from its dashboard card or the download manager.

The country pack will include its question content, catalogue subset, map geometry, required fonts or icons, and Three.js-related game bundle. Shared runtime assets should belong to the app shell or a versioned shared pack to avoid unnecessary duplication.

The service worker should use:

- Cache-first behavior for immutable, revisioned app and pack assets.
- Network-first with a cached fallback for update manifests when online.
- Explicit versioning and cleanup that never removes the currently active working version prematurely.
- Background installation of new app-shell workers, with deferred activation at the main menu or round-complete screen so active gameplay is never interrupted.
- Seamless reload into the newly activated worker without an update prompt.
- Check explicitly for application updates once per hour while GeoBam is open, with the last-check time persisted across reloads. After a longer closure, check when the site is next opened. Browser-managed service-worker checks may also occur.
- Player-approved pack updates, downloaded atomically in the background.
- No dependency on a network response during an installed game's active session.

Browser storage is not guaranteed to be permanent. The app should request persistent storage when the PWA is installed, display storage usage, and explain that the browser or operating system may still remove site data. Offline installation and future account-based progress sync are separate concerns.

## 5. Core domain model

```ts
type GameId = "countries" | "capitals" | string;

interface PlayerProgress {
  schemaVersion: number;
  totalXp: number;
  games: Record<GameId, GameProgress>;
  updatedAt: string;
}

interface GameProgress {
  xp: number;
  level: number;
  sessionsCompleted: number;
  items: Record<string, MasteryRecord>;
}

interface MasteryRecord {
  itemId: string;
  stage: "new" | "learning" | "review" | "mastered";
  mode: "multiple-choice" | "typed";
  ease: number;
  intervalDays: number;
  dueAt: string;
  successfulReviews: number;
  consecutiveCorrect: number;
  lapses: number;
  lastReviewedAt?: string;
}
```

XP and mastery are related but distinct:

- **Mastery** determines what the learner should practice and which difficulty mode is appropriate.
- **Game XP** provides visible progression within a minigame.
- **Total XP** is the sum of earned XP and provides an overall GeoBam progression measure.
- Levels are derived from XP thresholds rather than stored as independent mutable truth where practical.
- The current level determines which curriculum content and difficulty range can be introduced.
- Detailed mastery remains stored per geography for scheduling and a future statistics explorer, but is not shown in the initial UI.

## 6. Spaced repetition and session scheduling

The initial scheduler should be inspired by Anki but optimized for a short game session rather than copying Anki exactly.

### Session queue

Build each session from:

1. Items answered incorrectly during the current session and ready to repeat.
2. Overdue review items.
3. Items with low mastery or recent lapses.
4. A controlled number of new items from the player's current curriculum band.
5. Optional well-known items for occasional maintenance.

The first incorrect attempt reveals at least one context-appropriate hint and allows an immediate second guess on the same question. If that guess is also incorrect and another question is available, rotate the missed item into the retry queue and return to it after intervening questions. If it is the last unresolved item, keep it active and continue revealing appropriate hints until answered correctly.

### Answer outcomes

Internally, answers can map to four ratings:

| Rating | Meaning | Scheduling effect |
| --- | --- | --- |
| `again` | Incorrect | Repeat in-session and reduce interval/ease |
| `hard` | Correct with a hint, correction, or excessive time | Small interval increase |
| `good` | Correct under normal conditions | Normal interval increase |
| `easy` | Fast, confident, repeated success | Large interval increase |

The player does not need to select these ratings manually. The game derives them from correctness, answer mode, hints, response time, and recent history.

### Recognition-to-recall progression

A new geography begins with multiple-choice questions. After repeated successful reviews, it moves to typed recall.

Suggested initial transition:

- Start in multiple-choice mode.
- Require each individual country to be completed in multiple-choice mode at least twice before it becomes eligible for typed mode.
- Keep every round homogeneous: all 10 scheduled questions are either multiple choice or all 10 are typed recall.
- Once at least 10 countries qualify for typing, alternate multiple-choice and typed rounds.
- Typed rounds prioritize countries with zero typed completions, then the least-recently typed countries, ensuring every catalogue country eventually receives typed-recall coverage without repeatedly selecting one familiar country.
- A typed failure remains typed and receives escalating hints without changing the round's answer mode.
- Repeated typed success moves the item toward mastered status and increasingly long intervals.

These values are configuration, not hardcoded UI behavior, and should be tuned from playtesting.

### Curriculum ordering

New content should be introduced through configurable familiarity bands designed initially for a Western audience. This affects only when unseen items are introduced; once an item is learned, its reviews are controlled by the spaced-repetition scheduler.

A proposed starting structure is:

1. Highly familiar Western countries and major global powers.
2. Other commonly encountered European countries and large or prominent countries worldwide.
3. Less familiar countries within major regions.
4. Smaller and less commonly known African, Caribbean, and Pacific Island states.
5. Microstates, territories, and individually reviewed edge cases.

The exact membership and order of these bands is a content-design task and must live in versioned catalogue data, not application code. Familiarity should not be inferred from country size alone. Players should eventually encounter all included items, and the ordering must not imply that later countries are less important.

The first minigame always uses this global curriculum. Future minigames may specialize in a selected continent or region rather than adding a region selector to minigame 1.

### Within-session repeats

Use a small delayed queue separate from long-term scheduling:

```ts
interface SessionQueueItem {
  itemId: string;
  earliestQuestionIndex: number;
  reason: "new" | "due" | "retry";
}
```

On the first incorrect answer, reveal at least one hint selected for that question and let the player guess again immediately. On the second and later incorrect attempts, reveal further hints and insert the item into the delayed queue when another question is available. If no other question remains, keep the current item onscreen until it is answered correctly. A round cannot finish with an unresolved item.

For typed questions with many incorrect attempts, escalate from geographic clues to the structure of the canonical name:

1. Show the number of characters in each word and preserve the positions of spaces, for example `_ _ _   _ _ _ _ _ _ _`.
2. Reveal the first letter of each word.
3. Reveal the last letter of each word.
4. Reveal additional interior letters progressively on every further miss. Longer and multi-word names receive proportionally more revealed letters, while each word retains at least one hidden interior letter for an active guess.

Punctuation and spaces should be displayed accurately but should not count as hidden characters. The ladder may adapt for very short names so it does not reveal the entire answer prematurely. The complete name is shown only after the player submits an accepted answer.

### XP rules

XP should reward learning without encouraging answer farming.

- Award base XP for a correct answer.
- Award more XP for typed recall than multiple choice.
- Award a small bonus for a due review, first-time mastery, or within-session correct-answer streak.
- Reduce the XP available for an item after each incorrect attempt or revealed hint.
- Award a conservative speed bonus only for genuinely quick, first-attempt answers, calibrated against the country's expected typing time and rarity.
- Award little or no repeated XP for the same item repeatedly answered in one session.
- Never remove earned XP after a wrong answer.

Exact values and level curves remain a balancing task. Levels have no maximum: thresholds should follow a sustainable curve that can continue indefinitely without overflowing or becoming meaningless.

Each country stores an expected typing-time rating and a rarity rating. Persist actual response time, attempts, first-try accuracy, completions, per-mode completions, and per-mode last-seen times. Multiple-choice introduction uses a strict contiguous curriculum frontier: adaptation may change how many immediately adjacent new countries enter the next round, but it can never skip ahead into a later rarity band. Strong accuracy introduces up to six new countries in the next multiple-choice round; slower or inaccurate play introduces fewer and uses more slots for required second exposures. Typed rounds use their own coverage ordering. Adaptation occurs between rounds and never creates duplicate scheduled countries within one round.

Speed praise such as “Very quick!”, “Amazing!”, “Insanely fast!”, or “Blazingly fast!” should appear only when the calibrated threshold is meaningfully exceeded. Ordinary answers receive no speed label.

### Correct-answer reward animation

A correct answer should emit animated XP orbs from the highlighted country. The orbs travel toward a persistent level badge containing the current level number and an adjacent XP progress bar. As the orbs arrive, the bar fills with responsive motion and the level-up state receives a stronger celebratory treatment.

The animation must:

- Begin promptly without delaying the next interaction.
- Reflect the actual XP awarded after mistake and hint reductions.
- Remain legible over both light and dark globe treatments.
- Collapse to a short, low-motion state when reduced motion is enabled.
- Have an equivalent numeric and text update so meaning never depends on animation.
- Use no sound or haptic feedback in the initial release.

## 7. Minigame 1: Countries and territories

### Learning objective

Given a highlighted place on a globe, identify its name. Over time the player should progress from recognizing it among plausible choices to recalling and typing its name unaided.

### Question flow

1. Select an item using the shared scheduler.
2. Choose an appropriate question mode from its mastery.
3. Orient the globe so the target is visible at a useful scale.
4. Highlight the target without displaying its name.
5. Show contextual labels according to difficulty.
6. Accept a multiple-choice selection or typed response.
7. Reveal the correct name and useful geographic context.
8. Update mastery, XP, and the session queue.
9. Animate earned XP from the country to the level badge and progress bar.

### Difficulty dimensions

Difficulty should be composed from independent settings rather than a single hardcoded sequence:

- Answer mode: multiple choice or typed.
- Neighbor labels: shown or hidden.
- Ocean and sea labels: shown or hidden.
- Continent label: shown or hidden.
- Country borders: prominent or subtle.
- Camera distance: regional close-up or wider global view.
- Globe orientation: consistent/north-up or varied.
- Choice similarity: globally distinct or geographically confusable.
- Time pressure: initially none; optional in later modes.

Early levels should show plentiful continent, ocean, and neighboring-country labels. The difficulty configuration dials down their frequency as the player advances, so a clue may appear only occasionally at higher levels. Incorrect attempts temporarily dial contextual help back up until the player reaches the correct answer.

The globe remains freely rotatable and zoomable before, during, and after every question. A persistent “Return to country” control restores the intended target framing after the player explores elsewhere.

### Multiple-choice generation

Incorrect options should be plausible without being unfair. Prefer distractors from:

1. The same subregion.
2. Similar size, shape, or geographic context.
3. Items the player has already encountered.

Avoid obviously irrelevant option sets and avoid presenting alternate accepted names for the correct item as distractors.

Every multiple-choice question shows exactly four options: one accepted answer and three distinct distractors.

### Typed-answer normalization

Typed answers should be forgiving about:

- Letter case.
- Leading and trailing whitespace.
- Repeated internal whitespace.
- Common punctuation and diacritics.
- Approved aliases and short names.

Use bounded fuzzy matching to accept small spelling errors and close matches. After a correct or accepted answer, always show the proper canonical name, including when the player's spelling was close enough to pass. An incorrect attempt must not reveal the answer because the player must continue guessing with hints. Matching must use length-aware thresholds and approved aliases; politically or geographically distinct names must never be collapsed merely because they are similar. Ambiguous fuzzy results should ask for correction rather than silently accepting the wrong place.

Typed mode does not provide autocomplete or answer suggestions before submission.

When a typed question becomes active, returns from the retry queue, or finishes a transition, automatically focus and select the answer field so keyboard players can type immediately.

Each catalogue entry should own its accepted aliases:

```ts
interface GeographyItem {
  id: string;
  kind: "country" | "territory";
  name: string;
  aliases: string[];
  isoCode?: string;
  region: string;
  subregion?: string;
  capitalIds: string[];
  geometryId: string;
  status: "included" | "excluded" | "review";
  attribution?: string;
}
```

### Geography catalogue policy

The launch catalogue will include:

- All 193 UN member states.
- Vatican City/Holy See.
- Bermuda as an explicitly curated territory.
- A later curated list of additional territories. Palestine is currently excluded.
- Individually reviewed disputed or partially recognized states.

Catalogue membership must be data-driven, not embedded in globe code. Entries marked `review` should be excluded from production sessions until decided. The catalogue should record the naming convention and source/version used.

Each included item should also have a curriculum band and an ordering weight. These fields control the introduction of new items but do not override due reviews.

A dedicated content decision will be held before the catalogue is finalized to determine treatment of entries such as Kosovo and Western Sahara.

### Three.js globe architecture

The globe should be isolated behind a Preact component boundary:

```ts
interface CountryGlobeProps {
  targetGeometryId: string;
  labelMode: {
    neighbors: boolean;
    oceans: boolean;
    continent: boolean;
  };
  reducedMotion: boolean;
  onReady?: () => void;
}
```

Recommended implementation principles:

- Load simplified GeoJSON or TopoJSON and convert it to reusable Three.js geometry.
- Keep geometry and metadata separate so catalogue edits do not require rendering changes.
- Reuse meshes and materials instead of rebuilding the scene for every question.
- Use a distinct, accessible highlight style that does not rely only on color.
- Animate camera movement between questions, with an immediate transition for reduced-motion users.
- Lazy-load the Three.js game bundle so the dashboard remains lightweight.
- Render on demand when the camera, viewport, or selected country changes; do not run a permanent animation loop while the globe is idle.
- Bound the WebGL drawing-buffer pixel count on high-density displays and prefer a low-power GPU context for this mostly static scene.
- Avoid per-question texture mipmaps when the full-resolution atlas and linear filtering provide sufficient visual quality.
- Dispose of WebGL resources on unmount.
- Provide a recoverable fallback when WebGL is unavailable.

The map dataset must be reviewed for license, attribution, boundary resolution, file size, stable identifiers, antimeridian behavior, and tiny-island visibility.

Use tiered geometry detail rather than one uniformly expensive world dataset:

- Render the global globe from a lightweight coarse atlas suitable for large and medium countries.
- Bundle a separate high-resolution geometry layer for marker-eligible small states and island countries.
- Use the high-resolution geometry for their globe silhouette, dotted envelope, and inset map.
- Cache one neutral base-map canvas per session, then compose only the selected-country overlay for each question.
- Pre-render only the next selected-country overlay, retaining a bounded one-item preload cache.

### Small and dispersed geographies

Very small islands and territories cannot always be communicated by polygon fill alone. The globe should support:

- A minimum-size marker or halo.
- A visible circle or outline around tiny targets such as Vatican City or Singapore.
- Automatic regional zoom.
- Insets or focus rings where necessary.
- Multi-part geometries for archipelagos.

Supplemental circles must be enabled only for genuinely tiny countries and territories; large countries must rely on their highlighted geometry and must never receive a location circle.

Location indicators are mutually exclusive: small or dispersed island nations may use a dotted geographic envelope, while small non-island states use a solid green circle. Large, immediately legible islands such as Australia use neither. A country must never display both indicators at once.

For countries with non-contiguous or overseas territories, highlight every included geometry part. Camera framing should use a separately configured primary/home landmass focus point rather than an average of all geometry. For example, France highlights its included overseas territories while initially centering the globe on metropolitan France.

The visual cue must identify the location without revealing the answer text.

### Accessibility

- The answer controls must be keyboard accessible.
- Focus must move predictably after feedback and between questions.
- The highlighted region needs a non-color-only treatment.
- Color contrast should meet WCAG AA.
- Camera motion must respect reduced-motion preferences.
- XP reward motion must respect reduced-motion preferences and retain a textual equivalent.
- A non-WebGL fallback should allow the game to remain playable, potentially with a static map view.
- Feedback should be available as text and not depend only on animation or sound.
- All initial gameplay must be understandable without sound or haptics because neither is included.

### Performance targets

Targets should be validated on a representative mid-range mobile device:

- Dashboard interactive without downloading the globe bundle.
- Globe assets cached after first load.
- Smooth interaction at a reduced quality level on mobile.
- No scene or event-listener leaks across repeated sessions.
- Geometry resolution selected to balance recognizable borders and download size.
- The country pack exposes its download size before installation and runs without network requests once installed.

## 8. Minigame 2: Capital cities placeholder

### Proposed learning objective

Given a country or territory, identify its capital city. A reverse mode—given a capital, identify the geography—can be introduced later.

### Expected reuse

The capitals game should reuse:

- The shared session controller.
- The same mastery and spaced-repetition records.
- Multiple-choice-to-typed progression.
- XP and per-game levels.
- Geography catalogue IDs and naming rules.
- Shared question, feedback, and summary components.

### Content considerations for later design

- Geographies with multiple capitals or different official and administrative capitals.
- Territories without a conventional capital.
- Accepted spelling variants and diacritics.
- Whether the globe is used as context or the game begins as text/cards.
- Whether country-to-capital and capital-to-country are separate mastery items.

For the first project milestone, the route and dashboard card may be marked `coming-soon` without implementing question generation.

## 9. Testing strategy

### Unit tests

- Scheduler prioritization and interval changes.
- Retry spacing within a session.
- Immediate second guesses, delayed later retries, and mandatory resolution before round completion.
- Recognition-to-recall promotion and regression.
- XP calculation and anti-farming rules.
- Level threshold derivation.
- Answer normalization and alias handling.
- Bounded fuzzy-match acceptance, rejection, and ambiguity cases.
- Catalogue validation and stable identifiers.
- Persistence migrations.
- Curriculum-band ordering and the guarantee that all included items remain reachable.
- Content pack manifest validation, compatibility checks, and atomic installation.

Use deterministic clocks and seeded randomness so scheduling and question generation tests are repeatable.

### Component and integration tests

- Complete multiple-choice and typed-answer flows.
- Four-option multiple choice and typed input without autocomplete.
- Incorrect answer returns after intervening questions.
- Free globe rotation, zoom, and return-to-country behavior.
- Progress survives a reload.
- Dashboard totals match per-game progress.
- Keyboard and reduced-motion behavior.
- WebGL fallback behavior.
- Download, update, remove, interrupted-download, and insufficient-storage states.
- Installed games complete sessions while the browser is forced offline.
- Starter country levels become playable before the complete background download finishes.
- Theme selection follows light, dark, and changing system preferences.
- XP-orb feedback updates the badge and bar and respects reduced motion.

### End-to-end tests

- A first-time player completes a country session and gains XP.
- An existing player receives due reviews.
- Explicit progress deletion is separate from pack removal and requires confirmation.
- A catalogue or persistence schema update does not destroy existing mastery.
- The installed PWA launches offline and an installed country pack completes a full session offline.
- Removing a minigame pack frees its cached assets without removing its earned progress.

Visual and interaction testing of the globe should include tiny countries, islands, polar regions, and geometries crossing the antimeridian.

## 10. Delivery plan

### Phase 0: Resolve foundations

- Confirm the launch geography catalogue and boundary dataset.
- Define visual direction and accessibility baseline.
- Choose routing and testing libraries compatible with Preact.
- Finalize the indefinitely scaling XP curve and scheduler parameters.
- Define the initial Western-familiarity curriculum bands.
- Define the staged PWA shell/country download, content pack format, deferred automatic service-worker activation, optional content-pack update policy, and offline acceptance criteria.

### Phase 1: App shell and local progression

- Build dashboard and routes.
- Implement game registry and coming-soon states.
- Implement IndexedDB progress repository and migrations.
- Add total and per-game XP/level display.
- Add explicit progress reset; defer export and import.
- Add the web app manifest, service worker, first-visit offline shell, staged country download, and install experience.
- Build the download manager and per-game pack states.

### Phase 2: Learning engine

- Implement mastery records and scheduler.
- Implement session controller and delayed retry queue.
- Build shared multiple-choice, typed input, feedback, and summary UI.
- Implement the level badge, XP bar, and accessible orb reward animation.
- Add light, dark, and system theming.
- Add deterministic tests.

### Phase 3: Country game

- Prepare and validate catalogue and map assets.
- Assign versioned curriculum bands and introduction weights.
- Implement lazy-loaded Three.js globe.
- Implement country question and distractor generation.
- Add contextual label variations and difficulty progression.
- Add free globe controls, return-to-country framing, and small-country outlines.
- Handle small geographies and WebGL fallback.
- Playtest and tune scheduling, cues, XP, and session length.

### Phase 4: Capital cities placeholder

- Add the dashboard card and route.
- Document intended shared content relationships.
- Show an honest coming-soon state.

### Phase 5: Hardening and launch

- Accessibility audit.
- Visual-quality review across the minimalist interface and antique-map-inspired globe.
- Mobile performance and memory testing.
- PWA install, update, storage-pressure, and offline testing.
- Persistence migration and recovery testing.
- Content, naming, licensing, and attribution review.
- Manual launch verification without analytics or telemetry.

## 11. Architecture decision log

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| ADR-001 | Use Preact, TypeScript, and Vite | Accepted | Matches the existing starter and provides a small typed frontend |
| ADR-002 | Make the initial product anonymous and local-first | Accepted | Removes account friction and backend scope from the first release |
| ADR-003 | Hide storage behind a progress repository | Accepted | Keeps future sync possible without coupling games to IndexedDB |
| ADR-004 | Use multiple choice before typed recall | Accepted | Provides a gradual transition from recognition to stronger retrieval |
| ADR-005 | Use a shared game/session contract | Proposed | Prevents each minigame from rebuilding progression and scheduling |
| ADR-006 | Use IndexedDB for progress | Proposed | Better suited than local storage to structured, versioned mastery data |
| ADR-007 | Use data-driven catalogue membership | Accepted | Allows territory and disputed-state decisions to change without code changes |
| ADR-008 | Render the country game with Three.js | Accepted | Enables the planned interactive highlighted 3D globe |
| ADR-009 | Introduce new geographies using Western-familiarity curriculum bands | Accepted | Gives the assumed initial audience an approachable ramp before less familiar states and territories |
| ADR-010 | Ship GeoBam as an installable offline-first PWA | Accepted | Allows selected games to be played without a connection |
| ADR-011 | Package minigames as independently downloadable offline content | Accepted | Gives players control over device storage and avoids downloading unused games |
| ADR-012 | Automatically download countries as the first minigame pack | Accepted | Makes the initial experience immediately useful while retaining an independently removable package |
| ADR-013 | Stage the country pack so early levels are playable first | Accepted | Lets players start immediately while the full offline globe downloads in the background |
| ADR-014 | Use fixed rounds with continuous replay | Accepted | Provides regular completion moments without limiting session length |
| ADR-015 | Keep progress when a minigame is uninstalled | Accepted | Separates replaceable content assets from valuable learning history |
| ADR-016 | Require approval for content-pack updates | Accepted | Avoids unexpected data use and interruption |
| ADR-017 | Use 10-question rounds that require every miss to be resolved | Accepted | Creates short milestones while ensuring correction rather than skipping |
| ADR-018 | Derive unlimited minigame levels from XP | Accepted | Provides a simple visible progression system without a terminal cap |
| ADR-019 | Keep detailed country mastery internal initially | Accepted | Supports scheduling now and a future statistics explorer without cluttering the first UI |
| ADR-020 | Use visual-only XP-orb rewards | Accepted | Makes correct answers satisfying without adding sound or haptic scope |
| ADR-021 | Support light, dark, and system themes | Accepted | Respects player and operating-system preferences |
| ADR-022 | Exclude initial analytics and telemetry | Accepted | Keeps the first release local and privacy-conscious |
| ADR-023 | Activate app updates automatically only at safe boundaries | Accepted | Keeps the app current without reloading during an active round |

## 12. Open decisions

These decisions should be resolved near the phase that needs them:

- Exact list of included territories and treatment of disputed or partially recognized states.
- Map/boundary dataset, resolution, license, and attribution.
- Exact membership and order of the Western-familiarity curriculum bands.
- Number of new items introduced within each 10-question round.
- Initial scheduler coefficients and promotion thresholds.
- XP values and level curve.
- Exact hint-selection rules and escalating hint strength after incorrect answers.
- Attempt thresholds for revealing name length, word boundaries, and individual letters.
- Design of a future daily return streak.
- Whether a static 2D fallback is sufficient when WebGL is unavailable.
- Capital game directionality and handling of multiple-capital cases.
- Whether minigame packs are monolithic or optionally split into quality tiers for large visual assets.

## 13. Success criteria for the first playable release

- A player can start without an account.
- GeoBam can be installed as a PWA.
- The dashboard shows the country game, capital cities placeholder, total XP, and country-game level.
- A player can download, update, and remove individual minigame packs.
- A first website visit caches the PWA shell and automatically begins the country pack download.
- A player can begin the earliest country levels before the full pack finishes downloading.
- Installing the PWA offers additional minigames and requests persistent storage.
- App updates download silently and activate automatically only on the menu or round-complete screen.
- A player can complete country sessions using both multiple-choice and typed answers.
- Multiple-choice questions have four options, and typed questions have no autocomplete.
- Incorrect items reappear after several other questions.
- Incorrect answers reveal progressively stronger hints and reduce the XP available for that item until it is answered correctly.
- Repeated typed-answer mistakes eventually reveal word lengths, spaces, first and last letters, and then selected interior letters.
- Frequently correct items appear progressively less often.
- Country cues become harder as mastery improves.
- Fixed-size rounds can be continued indefinitely, and minigame levels have no maximum.
- Every round begins with 10 scheduled questions and cannot finish until all missed items are answered correctly.
- The globe remains freely rotatable and zoomable and provides a return-to-country control.
- Tiny countries receive an additional visible outline or circle.
- Correct answers animate XP orbs into the current-level badge and progress bar, with a reduced-motion alternative.
- Light, dark, and system theme modes work across the application and globe.
- Progress survives browser reloads.
- The app shell and downloaded country game work fully offline, including reloads and complete sessions.
- Removing a downloaded game does not remove its XP or mastery records.
- The automatically installed country pack can be removed and downloaded again independently of the core app.
- The 3D globe works on supported desktop and mobile browsers and has a usable fallback.
- Geography data, naming choices, licenses, and attribution have been reviewed.
