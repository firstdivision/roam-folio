# Architecture

## Status and approved decisions

The technical proposal was approved on 2026-10-24, with these product corrections: guesses are typed, the map is display-only, there is no give-up option, and proximity moves from white to red rather than green to red. The exact 125-country pool and territory policy were subsequently approved on the same date. The first playable version is implemented locally; deployment has not been performed.

- **Client:** React, TypeScript, and Vite; plain CSS and React's built-in state tools initially.
- **Map:** SVG country shapes projected with D3 geographic utilities. The map displays countries and guesses, with pan/zoom navigation; it does not select or submit guesses.
- **Guess input:** accessible typed country search with suggestions and explicit submission, placed above the map and visible without scrolling on initial desktop/mobile load. Keyboard and screen-reader users can complete the game through the form and history.
- **Hosting:** static GitHub Pages deployed with GitHub Actions; no required backend, production database, or authentication system.
- **Content:** versioned JSON files, with attributed country discovery content.
- **Persistence:** browser local storage for date-keyed progress; no account required.
- **Geography:** Natural Earth Admin 0 at 1:10 million as the MVP starting dataset, with an offline Python pipeline and a precomputed, versioned distance matrix. See [GEOGRAPHY.md](GEOGRAPHY.md).
- **Tests:** Vitest for TypeScript game logic, geographic pipeline tests, and Playwright for browser acceptance tests.

## Required components

1. **Country registry:** approved country IDs, names, aliases, eligibility, and an explicit mapping to source geometry.
2. **Geographic assets:** licensed boundaries for the display map, geographic source manifests, pairwise distances, and separate adjacency flags.
3. **Daily schedule:** immutable date-to-country assignments and their schedule, country-pool, and geography versions.
4. **Guess engine:** resolve typed input to an eligible country ID, retrieve distance, assign proximity feedback, and detect success.
5. **Client experience:** compact date/header, country picker above the fold, navigable display map, guess history, UTC countdown after solving, destination postcard, and basic emoji sharing.
6. **Persistence:** validate and restore ordered guesses and completion for the current UTC puzzle.
7. **Discovery content:** three sourced facts, one cultural note, and at least one signature food for every eligible target; fetch and render only after solving.

## Shared daily puzzle

- Interpret the day as `YYYY-MM-DD` in **UTC**, independent of the browser's local timezone.
- Generate seeded country permutations offline and publish explicit date assignments. Every country appears exactly once in each complete eligible-country cycle.
- Never pick a country independently for a visitor, device, session, or page load.
- Published assignments are immutable across deployments. Pool changes begin at a future full-cycle boundary beyond already published assignments.
- Pin each assignment to its pool and geography versions so a deployment cannot silently change answers or distance feedback for an existing puzzle.
- Recheck UTC date at midnight, before submitting a guess, and when a suspended tab resumes. Revalidate the schedule index on startup and rollover; use immutable versioned data assets.
- A date missing from the available schedule is unavailable; never generate a local replacement. Publish future cycles ahead of time.
- No daily build or server job is required to change the puzzle at midnight.
- A static application relies on a reasonably correct device clock. Guaranteeing the current date on a misconfigured device would require a separately approved trusted time source.

## Guess rules and feedback

- Accept guesses only from typed country search. Suggestions may resolve a typed name; map clicks never choose a guess.
- Use the same approved country pool for answers and guesses. Countries outside the pool remain neutral on the map.
- Normalize case, surrounding whitespace, and reviewed aliases to a stable ID. Ambiguous or unknown input requires correction rather than an arbitrary guess.
- Allow unlimited guesses and no give-up action. Only solving unlocks discovery.
- A repeated country returns its existing result without increasing the guess count.
- A correct guess displays success rather than distance feedback.

### Distance

- Measure minimum geodesic distance between the geographic boundaries of the guessed and target country, including relevant islands and enclaves. Do not use center-to-center or vertex-only distances.
- Shared land borders return exactly **0 miles** and **"It borders this country!"**. Store adjacency explicitly; never infer it from rounded distance.
- For separated countries, measure the shortest boundary-to-boundary surface distance, including coastlines when separated by water.
- Store meters; display approximate whole miles by default, converting with 1 mile = 1,609.344 meters. A positive sub-mile distance displays **"<1 mile"**, never zero. Kilometers are optional.
- Generate a versioned symmetric distance matrix offline, with nonnegative finite values and explicit adjacency flags.
- Validate a computational tolerance of 100 meters relative to the selected geometries in the geography prototype. This does not assert 100-meter accuracy for the source boundaries.

### Proximity

Apply thresholds to unrounded distance. Use a continuous gradient from white for very far away through yellow and orange to red for very close. The bands below provide consistent labels and share emojis; map and history colors use the same global distance-to-color scale, never a scale relative to the player's other guesses.

| Distance | Label | Share symbol |
|---|---|---|
| 0–250 miles | Very close | 🟥 |
| Over 250–1,000 miles | Close | 🟧 |
| Over 1,000–3,000 miles | Far | 🟨 |
| Over 3,000 miles | Very far away | ⬜ |
| Correct country | Found | 🎯 |

Exact gradient colors and interpolation are styling choices to document and check for accessibility during implementation. Differentiate unguessed countries with a neutral fill and guessed countries with an outline so white feedback remains visible. Always accompany color with text and distance. No feedback uses green.

## Persistence and content visibility

- Key progress by UTC date and puzzle identity, with a storage schema version, ordered country IDs, and completion state.
- Restore the same day's history and completion after reload. Derive feedback from the puzzle's pinned geographic data.
- On rollover, load the new date's progress rather than carrying guesses into it. Validate stored data; explain unavailable storage without blocking play.
- The hidden target receives no special map styling, labels, or discovery content before completion. Country names remain available for ordinary guess input.
- Fetch and render the postcard only after solving. Public static assets can still be inspected by technically skilled users; this is not a tamper-proof game.
- Share only the UTC date, guess count, ordered proximity symbols, and success marker. Supply copyable text when native sharing is unavailable.

## Project structure

```text
.github/workflows/       # CI checks and Pages deployment
docs/                   # Requirements, decisions, geography, and sources
data/
  countries/            # Approved IDs, aliases, eligibility, geometry mapping
  geography/            # Source manifests, versions, checksums, licenses
  schedules/            # Immutable date assignments and cycle metadata
  discovery/            # Sourced country cards
scripts/
  geography/            # Offline boundary processing and distance generation
  schedules/            # Deterministic schedule generation and validation
public/data/            # Generated, versioned browser assets
src/
  app/                  # Application composition
  game/                 # UTC dates, schedule, guesses, feedback
  map/                  # Display rendering
  components/           # Picker, history, countdown, postcard, share
  storage/              # Progress validation and persistence
  styles/
tests/
  unit/
  geography/
  e2e/
```

Create directories as their implementation increments need them. Keep geographic generation outside the browser build, and commit reproducible generated assets with their manifests.

## Implementation phases and acceptance criteria

1. **Decisions:** approve the exact country list and geographic mapping. Resolve every country ID to the intended geometry, content entry, and schedule eligibility before application code.
2. **Geographic foundation:** pin licensed data; prototype and validate distance generation; publish versioned map assets, adjacency, distances, and schedule. Test finite, nonnegative, symmetric distances, shared-border fixtures, eligibility, deterministic selection, and no repeats within a cycle.
3. **First playable version:** build typed input, display map, unlimited guessing, numeric and color feedback, history, daily persistence, success, and a minimal sourced postcard. A user can solve, reload without losing progress, and receive the same puzzle in another timezone.
4. **Complete MVP:** finish country content, UTC countdown, basic emoji sharing, mobile styling, and accessibility. Every eligible target has reviewed content; keyboard users can finish; the answer and discovery remain hidden before success.
5. **Release:** run CI checks and deploy through GitHub Actions to GitHub Pages. Validate repository-subpath assets and preservation of existing puzzle assignments across builds.

Work in small, testable increments within each phase. Required checks cover UTC midnight, leap days, year boundaries, timezone differences, suspended tabs, cached schedule versions, duplicate guesses, boundary segments, narrow water gaps, islands, enclaves, antimeridian cases, rounding, persistence, corrupt storage, pre-completion visibility, typed-only guessing, and mobile/keyboard play.

## Implementation notes

- All 125 approved IDs resolve through `data/geography/crosswalk.v1.json`. Checksummed source archives are retained under `data/geography/source/`.
- The full matrix records 7,750 pairwise upper/lower bounds. A compact triangular matrix supplies browser feedback without shipping proof metadata in the JavaScript bundle.
- Twenty deterministic 125-country cycles cover 2026-01-01 through 2032-11-04. Published assignments and pinned geography are immutable. The generation command refuses to overwrite existing dates with different answers.
- The gradient has fixed mile/color anchors: 0/red, 250/red-orange, 1,000/orange, 2,000/yellow, and 3,000/white; distances above 3,000 remain white. Share labels use the approved bands above.
- Geographic generation uses pyproj/PROJ's compiled GeographicLib C routines for performance; tests compare against the independent Python GeographicLib interface.
- Browser preview and CI use committed geographic artifacts. Recomputing geography is a separate offline command, not part of every frontend build.
- Deployment workflows are prepared for GitHub Pages; an actual deployment needs a GitHub checkout with Pages enabled.

## Map navigation and layout

The user approved removal of the large introductory banner, country entry above the fold, and zoomable/pannable map navigation on 2026-10-24. The country field precedes the map and travel log in DOM and visual order. The country field sits directly above the map in the same column. Latest guess feedback, storage notices, and completion/share content sit below the map. Desktop places history alongside this column; narrower screens place history below it.

SVG geography remains static; a bounded group transform handles navigation without affecting distance calculations or game state. Native pointer events support dragging and two-finger pinch, with pointer capture and touch-action handling. A non-passive wheel handler zooms around the cursor. Zoom ranges from 1× to 32×. Visible controls provide zoom in/out and reset; a focusable map region supports +/−, arrow keys, and 0/Home to reset. At 1× the centered initial view is restored. On phones (up to 700 px wide), the canvas is 65% of the small viewport height, clamped to 360–520 px. The SVG fills the canvas while preserving proportions, cropping the sides to enlarge the geography. Navigation bounds account for the visible crop, allowing sideways panning even at 1× to reach the whole world. No map click or gesture submits a guess, and no new runtime dependencies were added.

Map country paths have no name tooltips, whether guessed or unguessed. Their accessible image label refers to the travel log for exact results.

The original overview asset loads first. At 3× zoom, the app requests `world.detail.v1.geojson`, generated from the same licensed source and territory mapping with less simplification. The detailed data is retained in component memory for subsequent zooms. Both layers share the overview projection to avoid a position jump when switching. If the detail request fails, the overview remains navigable and a retry is available. The detailed display does not change the answer schedule, distance matrix, or country pool. `data/geography/display.v1.json` records separate display-asset provenance and hashes; `--display-only` regenerates map files without rewriting game data.

The travel log sorts a derived copy of guesses by unrounded meters ascending. A correct guess leads zero-distance ties; other ties retain chronological order. Each row keeps its original guess number. Session state, saved progress, and share emojis remain chronological.

## Security and content integrity

- Never commit credentials or API keys.
- Validate country IDs, dates, generated manifests, and stored progress.
- Treat local progress as convenience rather than tamper-proof scoring.
- Track source versions, checksums, transformations, and licenses. Do not invent boundaries, facts, food descriptions, or attribution.
- No recipe, passport, account, database, or other later feature enters MVP without approval.

## Local verification — 2026-10-24

- Clean installation through the committed npm lockfile and production builds pass.
- 19 unit tests cover UTC dates, schedule cycles, eligibility, distance lookup, persistence, sharing, and spherical display geometry for both map detail levels.
- 14 geographic tests cover source checksums, display asset provenance, approved territory components, shared borders, continuous minima, islands, enclaves, antimeridian seams, and GeographicLib reference agreement.
- 32 browser tests pass across desktop and mobile Chromium, including country entry above the fold at 320 × 568, entry/map/result placement, a taller mobile viewport with panning at 1×, closest-first history with stable ties and chronological persistence/sharing, wheel/button/keyboard zoom, mouse/touch panning, pinch gestures, absent country hover names, detailed map loading and retries, the 32× zoom limit, typed-only guessing, reloads, UTC rollover, timezone consistency, discovery visibility, sharing, unavailable storage, and automated WCAG AA scans of initial/solved views.
- The built app was also checked under a `/roamfolio/` repository subpath: map assets, guesses, restored progress, and solved discovery all loaded correctly.
- Desktop/mobile screenshots were inspected; a tiny-island winding issue found during visual QA is fixed and covered by a regression test.
- GitHub Pages workflows are prepared, with deployment gated on validation. No remote publication has been performed. Safari, Firefox, and physical-device checks remain outside this verification pass.

## Technical references

- [React with a build tool](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite deployment to GitHub Pages](https://vite.dev/guide/static-deploy)
- [D3 geographic projections and SVG paths](https://d3js.org/d3-geo)
- [Vitest](https://vitest.dev/guide/)
- [Playwright clock controls](https://playwright.dev/docs/clock)
