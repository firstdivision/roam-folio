# Architecture

## Status and approved decisions

The technical proposal was approved on 2026-10-24, with these product corrections: guesses are typed, the map is display-only, there is no give-up option, and proximity moves from white to red rather than green to red. The initial 125-country pool and territory policy were subsequently approved on the same date; the user later approved adding Chad, bringing the registry to 126. On 2026-10-25, the user approved 20 additional answers and made the other 51 countries from the reviewed exclusions table guessable only. The current registry has 197 guesses and 146 possible answers; separate territories remain excluded. The first playable version is implemented locally; deployment has not been performed.

- **Client:** React, TypeScript, and Vite; plain CSS and React's built-in state tools initially.
- **Map:** SVG country shapes projected with D3 geographic utilities. The map displays countries and guesses, with pan/zoom navigation; it does not select or submit guesses.
- **Guess input:** accessible typed country search with suggestions and explicit submission, placed above the map and visible without scrolling on initial desktop/mobile load. Keyboard and screen-reader users can complete the game through the form and history.
- **Hosting:** static GitHub Pages deployed with GitHub Actions; no required backend, production database, or authentication system.
- **Content:** versioned JSON files, with attributed country discovery content.
- **Persistence:** browser local storage for date-keyed progress; no account required.
- **Geography:** Natural Earth Admin 0 at 1:10 million as the MVP starting dataset, with an offline Python pipeline and a precomputed, versioned distance matrix. See [GEOGRAPHY.md](GEOGRAPHY.md).
- **Tests:** Vitest for TypeScript game logic, geographic pipeline tests, and Playwright for browser acceptance tests.

## Required components

1. **Country registry:** approved country IDs, names, aliases, explicit answer eligibility, and an explicit mapping to source geometry. Registry membership permits a guess; `answerEligible` permits daily selection.
2. **Geographic assets:** licensed boundaries for the display map, geographic source manifests, pairwise distances, and separate adjacency flags.
3. **Daily schedule:** immutable date-to-country assignments and their schedule, country-pool, and geography versions.
4. **Guess engine:** resolve typed input to an eligible country ID, retrieve distance, assign proximity feedback, and detect success.
5. **Client experience:** compact date/header, country picker above the fold, navigable display map, guess history, local-midnight countdown after solving, destination postcard, and basic emoji sharing.
6. **Persistence:** validate and restore ordered guesses and completion for the current local-date puzzle.
7. **Discovery content:** three sourced facts, one cultural note, and at least one signature food for every eligible target; fetch and render only after solving.

## Shared daily puzzle

The user approved switching from a simultaneous UTC reset to local-midnight availability on 2026-10-25. Published date assignments, puzzle identities, and storage keys remain unchanged. Existing UTC-era progress restores when its date matches the browser's local date; progress for other dates stays saved. Changing the device clock or time zone selects that local date's saved puzzle rather than transferring guesses between answers. The next-reset calculation advances to local calendar midnight rather than adding 24 hours, so daylight saving days can last 23 or 25 hours.

- Interpret the day as `YYYY-MM-DD` in the **browser's local time zone**. A new puzzle unlocks at local midnight. Everyone on the same calendar date receives the same published assignment; different time zones may be playing different dates at the same instant.
- Generate seeded country permutations offline and publish explicit date assignments. Every country appears exactly once in each complete eligible-country cycle.
- Never pick a country independently for a visitor, device, session, or page load.
- Published assignments are immutable across deployments. Pool changes begin at a future full-cycle boundary beyond already published assignments.
- Pin each assignment to its pool and geography versions so a deployment cannot silently change answers or distance feedback for an existing puzzle.
- Recheck the local date at midnight, before submitting a guess, and when a suspended tab resumes. Revalidate the schedule index on startup and rollover; use immutable versioned data assets.
- A date missing from the available schedule is unavailable; never generate a local replacement. Publish future cycles ahead of time.
- No daily build or server job is required to change the puzzle at midnight.
- A static application relies on a reasonably correct device clock. Guaranteeing the current date on a misconfigured device would require a separately approved trusted time source.

## Guess rules and feedback

- Accept guesses only from typed country search. Suggestions may resolve a typed name; map clicks never choose a guess.
- Use all current registry entries for guesses, but filter `answerEligible: true` for new answer cycles. Retain previous answer pools for published cycles. Guess-only countries receive ordinary distance/color feedback and can persist in history, but cannot be targets. Countries outside the registry remain neutral.
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

- Key progress by calendar date and puzzle identity, with a storage schema version, ordered country IDs, and completion state.
- Restore the same day's history and completion after reload. Derive feedback from the puzzle's pinned geographic data.
- On rollover, load the new date's progress rather than carrying guesses into it. Validate stored data; explain unavailable storage without blocking play.
- The hidden target receives no special map styling, labels, or discovery content before completion. Country names remain available for ordinary guess input.
- Fetch and render the postcard only after solving, inside the completion modal. Public static assets can still be inspected by technically skilled users; this is not a tamper-proof game.
- Derive average guesses per solve from existing date-keyed progress in local storage. Validate each record against its published puzzle identity and guess rules, and count only completed puzzles once. Include the current in-memory solve even if saving fails. No separate counter, new storage schema, or migration is needed; earlier valid saved solves contribute automatically. Display one decimal place on the postcard with the solved puzzle count; synchronize statistics when another tab changes saved progress. History is local to this browser and is lost when browser data is cleared.
- Format shared results as `Roam-folio: <date>`, `Today: <guess count>`, and `Average: <average guesses>` on separate lines, followed by a blank line and the chronological proximity symbols with their success marker. The average uses one decimal place; no URL is included. Supply copyable text when native sharing is unavailable.

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
  game/                 # Local dates, schedule, guesses, feedback
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
3. **First playable version:** build typed input, display map, unlimited guessing, numeric and color feedback, history, daily persistence, success, and a minimal sourced postcard. A user can solve, reload without losing progress, and receive the same puzzle for the same local calendar date in another time zone.
4. **Complete MVP:** finish country content, local-midnight countdown, basic emoji sharing, mobile styling, and accessibility. Every eligible target has reviewed content; keyboard users can finish; the answer and discovery remain hidden before success.
5. **Release:** run CI checks and deploy through GitHub Actions to GitHub Pages. Validate repository-subpath assets and preservation of existing puzzle assignments across builds.

Work in small, testable increments within each phase. Required checks cover local midnight, leap days, year boundaries, timezone differences, daylight saving transitions, suspended tabs, cached schedule versions, duplicate guesses, boundary segments, narrow water gaps, islands, enclaves, antimeridian cases, rounding, persistence, corrupt storage, pre-completion visibility, typed-only guessing, and mobile/keyboard play.

## Implementation notes

- All 197 guessable IDs resolve through `data/geography/crosswalk.v3.json`; the v1 and v2 crosswalks remain unchanged. Checksummed source archives are retained under `data/geography/source/`.
- The v3 matrix records 19,306 pairwise upper/lower bounds, preserving all 7,875 v2 records exactly and adding 11,431 pairs. The historical v2 matrix preserves all 7,750 v1 records and adds 125 Chad pairs. A compact triangular matrix supplies browser feedback without shipping proof metadata in the JavaScript bundle.
- Twenty deterministic 125-country cycles cover 2026-01-01 through 2032-11-04. Published assignments and pinned geography are immutable. The expanded 126-country cycle begins on 2032-11-05 and runs through 2033-03-10. The appended 146-answer cycle runs from 2033-03-11 through 2033-08-03. The generation command refuses to overwrite existing dates or published era metadata. `data/schedules/legacy.v1.json` records a regression hash of the original 2,500 assignments, and `legacy.v2.json` preserves the 2,626 pre-v3 assignments and their eras.
- The gradient has fixed mile/color anchors: 0/red, 250/red-orange, 1,000/orange, 2,000/yellow, and 3,000/white; distances above 3,000 remain white. Share labels use the approved bands above.
- Geographic generation uses pyproj/PROJ's compiled GeographicLib C routines for performance; tests compare against the independent Python GeographicLib interface.
- Browser preview and CI use committed geographic artifacts. Recomputing geography is a separate offline command, not part of every frontend build.
- Deployment workflows are prepared for GitHub Pages; an actual deployment needs a GitHub checkout with Pages enabled.

## Chad / pool-v2 expansion

`pool.v2.json` appends Chad (`TCD`) and reviewed aliases to the preserved v1 registry. Eligibility counts in search validation errors are derived from this registry; no country-count/tagline helper line is displayed. The original map files already contain TCD; their source geometry and historical eligibility metadata remain unchanged. Runtime eligibility is derived from the current registry.

`scripts/geography/extend.py` verifies the pinned sources and base artifact hashes, retains all original pair records, computes only missing pairs using the same 100-meter certified method, and writes separate v2 crosswalk, proof matrix, compact feedback, and generation manifest. The browser uses the v2 compact matrix, whose original-pair distances are identical to v1. Historical v1 assets remain available.

The schedule retains its original top-level version identifiers for compatibility and adds explicit `eras` with date ranges, pool version, geography version, seed, and cycle length. Puzzle identity uses the matching era; all original dates retain their exact identity and browser storage keys. Chad is accepted as a guess immediately. It first becomes eligible for daily selection in the appended pool-v2 cycle after the original published schedule. Schedule refresh rejects changed era metadata. Discovery generation includes `data/discovery/chad.json` with claim-level sources tracked separately.

## Separate answer and guess eligibility / pool-v3

`data/countries/pool.v3.json` preserves the v2 country names, IDs and aliases, appends the 20 approved answers followed by 51 guess-only countries, and sets an explicit boolean `answerEligible` on every entry. `countries` exposes all 197 choices; `answerCountries` exposes the 146 possible destinations. Typed search never presents guess-only countries as invalid. Runtime puzzle loading and downloaded-schedule validation check answer eligibility against the date’s era; direct guess evaluation also rejects a guess-only target. Browser progress retains its schema and keys and accepts the larger guess registry.

`scripts/geography/expand.py` verifies v2 artifact hashes and source archives, preserves every v2 pair exactly, computes missing pairs, and writes separate v3 crosswalk, proof matrix, compact feedback and generation records. Generation is checkpointed with registry/source/code fingerprints. No map boundaries or historical map assets change. Source IDs KOS (Kosovo), PSX (Palestine), SDS (South Sudan) and VAT (Vatican City) are retained as application IDs; common alternative codes/names are reviewed aliases.

The immutable v1/v2 schedule eras remain unchanged. The new 146-answer cycle begins on 2033-03-11, after every published date. Schedule generation filters answer eligibility, so none of the 51 guess-only countries enters the cycle. The 20 new sourced postcards live in `data/discovery/expansion.v3.json`; discovery build coverage is exactly the answer pool rather than the guess registry.

## Map navigation and layout

The user approved removal of the large introductory banner, country entry above the fold, and zoomable/pannable map navigation on 2026-10-24. The country field precedes the map canvas and travel log in DOM and visual order. The country field begins at the top of the map panel and sits directly against the canvas before guessing. The map heading and visible zoom/reset toolbar have been removed. Its visible label remains above the search row. A compact latest-guess notice appears directly under the submit row after guessing, showing the country's nearest-border distance and, after the first guess, a comparison with the best earlier unrounded distance (closer, farther, or matching). Repeated guesses compare their existing result with the current best; they do not add history. On reload, derive the notice from the last saved chronological guess and all earlier guesses. The status live region announces feedback without moving focus. Storage notices and a completed-journey summary with a “View your postcard” button sit below the map. Completion/share content and the postcard live together in a native `<dialog>` opened with `showModal()` immediately after solving and when restoring a completed puzzle. The dialog names its completion heading, initially focuses that heading, keeps background content inert, locks page scrolling, and contains focus through native modal behavior. A sticky close button and Escape dismiss it; focus returns to “View your postcard,” which reopens it. The dialog scrolls within the viewport on small screens. The dialog and postcard are removed on local-date rollover, and page scrolling is restored. Desktop places history alongside this column; narrower screens place history below it.

SVG geography remains static; a bounded group transform handles navigation without affecting distance calculations or game state. Native pointer events support dragging and two-finger pinch, with pointer capture and touch-action handling. A non-passive wheel handler zooms around the cursor. Zoom ranges from 1× to 32×. A focusable map region supports +/− to zoom, arrow keys to pan, and 0/Home to reset. The map retains an accessible region name and keyboard instructions without a visible heading, zoom buttons, zoom percentage, or reset button. At 1× the centered initial view is restored. On phones (up to 700 px wide), the canvas is 65% of the small viewport height, clamped to 360–520 px. The SVG fills the canvas while preserving proportions, cropping the sides to enlarge the geography. Navigation bounds account for the visible crop, allowing sideways panning even at 1× to reach the whole world. No map click or gesture submits a guess, and no new runtime dependencies were added.

Map country paths have no name tooltips, whether guessed or unguessed. Their accessible image label refers to the travel log for exact results.

The original overview asset loads first. At 3× zoom, the app requests `world.detail.v1.geojson`, generated from the same licensed source and territory mapping with less simplification. The detailed data is retained in component memory for subsequent zooms. Both layers share the overview projection to avoid a position jump when switching. If the detail request fails, the overview remains navigable and a retry is available. The detailed display does not change the answer schedule, distance matrix, or country pool. `data/geography/display.v1.json` records separate display-asset provenance and hashes; `--display-only` regenerates map files without rewriting game data.

The travel log sorts a derived copy of guesses by unrounded meters ascending. A correct guess leads zero-distance ties; other ties retain chronological order. Each row keeps its original guess number. Session state, saved progress, and share emojis remain chronological.

## Link preview metadata

`index.html` declares Open Graph and Twitter card metadata in the initial HTML so crawlers do not need to run React. Vite replaces `%SITE_URL%` with a normalized absolute public URL, defaulting to `https://roam-folio.com/`. The Pages workflow supplies `VITE_SITE_URL` from `actions/configure-pages`' `base_url`, preserving custom domains and repository subpaths. The canonical URL, `og:url`, and image URLs share that base.

`public/social-preview.v1.png` is a committed 1200 × 630 PNG (101,602 bytes). `npm run image:social` uses the existing Playwright Chromium and D3 dependencies to render original brand artwork with the approved Natural Earth overview geometry. It never reads the schedule or player state. Image dimensions, MIME type, and descriptive alternative text accompany the image metadata. Updating the image later should use a new versioned filename and matching metadata to distinguish it from cached artwork. No preview image is generated during ordinary builds.

References: [Apple Messages rich previews](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages), [Open Graph protocol](https://ogp.me/).

## Security and content integrity

- Never commit credentials or API keys.
- Validate country IDs, dates, generated manifests, and stored progress.
- Treat local progress as convenience rather than tamper-proof scoring.
- Track source versions, checksums, transformations, and licenses. Do not invent boundaries, facts, food descriptions, or attribution.
- No recipe, passport, account, database, or other later feature enters MVP without approval.

## Local verification — 2026-10-24

- Clean installation through the committed npm lockfile and production builds pass.
- 22 unit tests cover UTC dates, schedule cycles, eligibility, distance lookup, persistence, sharing, and spherical display geometry for both map detail levels.
- 16 geographic tests cover source checksums, display asset provenance, approved territory components, shared borders, continuous minima, islands, enclaves, antimeridian seams, and GeographicLib reference agreement.
- 38 browser tests pass across desktop and mobile Chromium, including Chad aliases, old progress compatibility, its future puzzle and sourced postcard, link preview metadata and PNG delivery without JavaScript, country entry above the fold at 320 × 568, entry/map/result placement, a taller mobile viewport with panning at 1×, closest-first history with stable ties and chronological persistence/sharing, wheel/button/keyboard zoom, mouse/touch panning, pinch gestures, absent country hover names, detailed map loading and retries, the 32× zoom limit, typed-only guessing, reloads, UTC rollover, timezone consistency, discovery visibility, sharing, unavailable storage, and automated WCAG AA scans of initial/solved views.
- Production preview metadata and PNG output were checked for both `https://roam-folio.com/` and a `/roam-folio/` repository subpath.
- The built app was also checked under a `/roamfolio/` repository subpath: map assets, guesses, restored progress, and solved discovery all loaded correctly.
- Desktop/mobile screenshots were inspected; a tiny-island winding issue found during visual QA is fixed and covered by a regression test.
- GitHub Pages workflows are prepared, with deployment gated on validation. No remote publication has been performed. Safari, Firefox, and physical-device checks remain outside this verification pass.

## Pool-v3 verification — 2026-10-25

- 26 unit tests pass, including exact 146-answer/51-guess-only membership, 19,306 certified pair lookups, distances from every guess-only country to every answer, deterministic schedule generation in read-only `--check` mode, rejection of guess-only targets, and reload/storage compatibility.
- 18 geographic tests pass, including all 197 source geometries, v3 provenance, preservation of all 7,875 v2 pair records, real enclave borders, and source mappings for Kosovo, Palestine and South Sudan.
- All 92 desktop/mobile Chromium browser checks pass in a complete run. Each of the 20 added answers unlocks its sourced postcard only after solving and restores after reload. Guess-only countries receive suggestions, border/distance feedback, map color and persisted history without unlocking discovery. Existing UTC rollover, accessibility, map and sharing checks pass.
- Discovery generation validates 146 complete sourced postcards. TypeScript and the production build pass. Vite reports a JavaScript chunk-size advisory (about 580 kB before compression, 218 kB gzip); no new runtime dependency was added.
- All 2,626 pre-expansion assignments and their eras match the retained regression snapshot; the 146-answer cycle begins on 2033-03-11. No deployment was performed in this verification pass.

## Local-midnight verification — 2026-10-25

- All 36 unit tests pass, including local date boundaries in five time zones, leap days, year-end, unchanged local dates through UTC midnight, daylight saving transitions, calendar-date schedule validation, and existing progress identities.
- All 110 desktop/mobile Chromium checks pass across focused and remaining regression runs. Local-midnight rollover, countdowns, restored dated progress, pre-guess/resume date checks, shared targets for matching local dates, and different targets for different local dates are covered alongside existing map, postcard, sharing, and accessibility checks.
- TypeScript and the production build pass. The existing JavaScript chunk-size advisory remains. No schedule assignments, runtime dependencies, or storage keys changed.

## Technical references

- [React with a build tool](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite deployment to GitHub Pages](https://vite.dev/guide/static-deploy)
- [D3 geographic projections and SVG paths](https://d3js.org/d3-geo)
- [Vitest](https://vitest.dev/guide/)
- [Playwright clock controls](https://playwright.dev/docs/clock)
