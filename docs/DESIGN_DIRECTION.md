# GeoBam Visual Design Direction

Status: Working draft for collaborative definition  
Last updated: 2026-07-31  
Owner: Product and design

## Purpose

This document is the single source of truth for GeoBam's visual language,
interface personality, composition, motion, and presentation. Technical and
learning architecture remain in `ARCHITECTURE.md`.

The current interface feels generic and overly polished in a way commonly
associated with generated landing pages: large aspirational headings, floating
rounded cards, soft gradients, decorative blobs, excessive empty space, and
interchangeable “premium” styling. The redesign should give GeoBam a specific
world, a recognizable hand, and a practical reason for every visual choice.

## Starting direction: bureaucratic cartography

The initial reference is the UI language of *Papers, Please*: procedural,
tactile, information-dense, slightly severe, and rooted in documents, stamps,
maps, desks, and state bureaucracy.

This is a directional reference, not a request to copy the game's protected
artwork, fictional setting, typography, layouts, sound, or exact pixel-art
style. GeoBam should develop its own identity from the broader ideas of:

- official geography examinations;
- border-control documents and customs forms;
- school atlases and field notebooks;
- rubber stamps, punched cards, tabs, seals, and registry marks;
- a work surface on which the player identifies and files places.

The tone should support learning rather than parody bureaucracy or reproduce
the oppressive political themes of the reference.

## Provisional design thesis

GeoBam is a personal geographic registry. The player is not browsing a glossy
course catalogue; they are working through an evolving atlas, identifying
places, stamping knowledge as verified, and building a record of the world.

The interface should feel:

- authored rather than assembled from a component template;
- compact and purposeful rather than spacious for its own sake;
- tactile without becoming ornamental;
- game-like without resembling a mobile casino;
- slightly imperfect but never difficult to read;
- serious enough to make mastery satisfying, with dry moments of charm.

## Early visual vocabulary

These are hypotheses to test, not final tokens.

### Surfaces

- A desk or document-workspace foundation rather than floating SaaS cards.
- Layered paper sheets, folders, map plates, index cards, and clipped panels.
- Squared or lightly chamfered corners; reserve rounded shapes for physical
  objects such as seals, globe markers, and counters.
- Thin rules, registration marks, serial numbers, and restrained paper wear.
- Avoid blurred glass, glowing card borders, generic gradients, and arbitrary
  shadow-heavy elevation.

### Colour

- Paper, ink, faded administrative green, desaturated ocean blue, stamp red,
  brass or ochre, and graphite.
- Colour should communicate state: verified, rejected, pending, selected, or
  newly learned.
- Avoid neon accents and large decorative colour washes.
- Final light/dark behavior remains an open design decision; it should arise
  from the physical metaphor rather than mechanically inverting every colour.

### Typography

- A compact administrative sans or grotesk for controls and data.
- A typewriter, slab, or document face may be used selectively for prompts,
  labels, serials, or stamps.
- Typography should establish hierarchy through size, weight, case, rules, and
  alignment—not through oversized display copy.
- Avoid the default “editorial serif headline plus neutral sans” pairing unless
  later exploration gives it a specific in-world rationale.

### Iconography and illustration

- Simple stamped, engraved, or diagrammatic marks.
- The globe-bomb logo can become a printed seal or office insignia.
- Minigame artwork should resemble atlas plates, dossier covers, or examination
  diagrams rather than colorful generic feature-card illustrations.
- Icons must remain readable at small sizes and should not depend on texture.

### Motion and feedback

- Motion should feel physical and procedural: stamp, slide, file, punch, tally,
  reveal, and transfer.
- Correct-answer celebration can remain satisfying, but its final visual form
  should belong to this world. XP may be represented as counters, seals,
  punches, tokens, or another device instead of generic glowing particles.
- Incorrect feedback should be immediate and unmistakable without feeling
  punitive.
- Reduced-motion behavior remains mandatory.

## Provisional screen direction

### Main menu

Treat the minigame collection as a registry, assignment board, or atlas index.
Replace the generic marketing hero and equal promotional tiles with a stronger
working interface: current assignment, player record, available files, and
locked or forthcoming departments.

### Country quiz

Treat the globe as the primary map plate and the answer area as an examination
or verification form. The screen should remain fast and spatially clear.
Document styling must not reduce the globe's usable size or make answers harder
to scan.

The space behind the globe is a dark desaturated cartographic terminal bay, not
a bright modern product-display gradient. Use a hard equipment bezel, restrained
measurement grid, and very subtle scan lines while keeping the globe itself
clean, bright enough, and geographically precise.

### Round completion

Present completion as a verified record, stamped report, filed document, or
cleared batch. The next-round action should be obvious and retain its keyboard
flow.

## Anti-patterns

The redesign should actively avoid:

- giant centered slogans above a card grid;
- pill-shaped controls everywhere;
- identical cards with icon, eyebrow, heading, paragraph, and arrow;
- excessive `border-radius`;
- glassmorphism and backdrop blur as default decoration;
- gradients without semantic or material purpose;
- vague copy such as “Where will you explore?” when a direct label is clearer;
- ornamental micro-labels added only to simulate sophistication;
- excessive whitespace that lowers information density;
- mixing antique-map visuals with unrelated luxury-editorial styling;
- texture strong enough to reduce contrast or geographic precision.

## Non-negotiable usability constraints

- Keyboard focus must always be visible.
- Text and functional graphics must meet accessible contrast targets.
- Layout must remain usable from small mobile screens through wide desktops.
- Touch targets must remain appropriately sized even if controls look compact.
- Geography, answers, progress, and state feedback take precedence over theme.
- Texture and motion must degrade gracefully for performance and reduced-motion
  preferences.
- No styling decision may make offline status, downloads, errors, or updates
  ambiguous.

## Decisions to make together

The remaining unresolved areas are typography sources and licensing, final
light/night behavior, the long-term XP metaphor, and the degree to which later
minigames receive their own departmental visual identities.

## Explored visual routes

### Route A — Border desk

The most literal *Papers, Please* route: dark counter surface, rigid document
panes, bitmap typography, stamps, compact controls, muted institutional colour,
and a strong sense of processing one item at a time.

Strengths: distinctive, immediately game-like, highly compatible with the quiz
loop. Risks: can imply political border enforcement too strongly and can become
claustrophobic on mobile.

### Route B — School atlas office

A warmer interpretation built from clean school records, library cards,
educational wall maps, atlas plates, teacher stamps, and administrative forms.
It retains the procedural nostalgia but makes learning, not border enforcement,
the dominant association.

Strengths: welcoming, geography-specific, extensible to many minigames. Risks:
can drift into generic vintage stationery if the interface loses the strict
procedural composition.

### Route C — Cartographic terminal

A fictional late-1980s geography bureau combining paper dossiers with a
low-resolution digital map terminal. The shell uses crisp pixel-art influence,
while the globe remains a modern interactive instrument inside the workstation.

Strengths: best bridge between the reference, the 3D globe, and offline PWA
behavior. Risks: requires disciplined separation between deliberately coarse UI
graphics and geographically precise map rendering.

## Selected route

Use **Route C — Cartographic terminal**, warmed with the educational character
of Route B. The player works as a **Junior Atlas Clerk** in the fictional
GeoBam World Registry: a non-political office that verifies geographic
knowledge and builds a personal atlas record.

The role provides useful language and structure without requiring narrative
role-play. The interface may say `REGISTRY`, `ASSIGNMENT`, `VERIFY`, `FILED`,
`REVIEW DUE`, and `NEXT BATCH`, but should use plain supporting text whenever an
in-world term could confuse a first-time player.

## Accepted direction decisions

- The *Papers, Please* influence should be clearly recognizable in composition,
  density, typography, feedback, and document handling.
- Use crisp pixel-art rendering for shell ornament, icons, stamps, and interface
  diagrams. Preserve smooth, accurate rendering for the interactive globe and
  text where pixelation would damage usability.
- Aim for clean late-1980s/early-1990s administrative nostalgia: printed forms
  and maintained equipment, not dirty or distressed paper.
- Use moderate-to-high information density on desktop.
- Stack the same document hierarchy on mobile rather than replacing it with
  unrelated generic mobile cards.
- Default to direct controls with light fictional framing rather than extended
  character or story text.
- Correct answers should initially feel like decisive professional
  verification—a stamp, tally, transfer, and progress increment—with stronger
  celebration reserved for completing a batch or gaining a level.
- The globe is a precise digital cartographic terminal embedded in the paper
  workstation. Do not pixelate country borders or interaction.
- Use one canonical paper/workstation theme first. A night-shift treatment may
  be designed later as a separate authored theme rather than a mechanical color
  inversion.

## Design decision record

Record accepted visual decisions here instead of in the architectural ADR log.

| ID | Decision | Status | Rationale |
| --- | --- | --- | --- |
| VDR-001 | Use bureaucratic cartography as the initial exploration direction | Accepted | Provides a specific, geography-relevant alternative to generic generated UI |
| VDR-002 | Treat *Papers, Please* as inspiration rather than an asset-level template | Accepted | Preserves an original GeoBam identity |
| VDR-003 | Select the Cartographic Terminal route with School Atlas warmth | Accepted | Connects procedural nostalgia to a precise interactive globe |
| VDR-004 | Frame the player as a Junior Atlas Clerk | Accepted | Supports useful registry language without political role-play |
| VDR-005 | Use clean pixel-art influence around smooth geographic rendering | Accepted | Gives the shell character without sacrificing map accuracy |
| VDR-006 | Prefer verification feedback over generic particle celebration | Accepted | Makes rewards belong to the registry metaphor |

## Next steps

1. Establish the provisional token set and typography using local/system fonts.
2. Redesign the shared shell and main registry.
3. Apply the system to the quiz workstation and completion report.
4. Review the first implementation at desktop and mobile widths.
5. Refine the XP metaphor and design a dedicated night-shift route later.
