# Roamfolio

**Discover a country. Collect its story.**

Roamfolio is a daily country-guessing game inspired by geography games such as Globle. Everyone plays the **same mystery country each UTC day**. Players type country names; each guess reveals the nearest-border distance in miles and proximity feedback on a display-only world map. Solving the puzzle unlocks a travel-postcard-style country discovery with culture, history, and food. Recipes are planned for later.

## Core experience
1. Open today's puzzle; no account required.
2. Start typing an eligible country's name in the field directly above the map, using accessible search and suggestions. Map clicks do not select or submit guesses.
3. See the nearest-border distance in miles and map proximity feedback, moving from white for very far away through yellow and orange to red for very close. Drag to pan the map, scroll or pinch to zoom, or use its keyboard and button controls. More detailed boundaries load when zooming in, up to 32×; map countries have no hover-name labels. On mobile, a taller map fills the viewport area and can be panned sideways. The latest result appears below the map, and the travel log lists closest guesses first.
4. Keep guessing until the target country is found; there is no guess limit or give-up option. Today's progress survives refreshes on the same browser.
5. Explore country facts, cultural notes, and a signature food; share spoiler-free emoji results. Recipes and a passport collection come later.

## Product documents
- [Vision](docs/VISION.md)
- [Feature requirements](docs/FEATURES.md)
- [Architecture and open decisions](docs/ARCHITECTURE.md)
- [Approved eligible countries](docs/COUNTRIES.md)
- [Geographic data and distance policy](docs/GEOGRAPHY.md)
- [Sources and license tracking](docs/SOURCES.md)
- [Agent instructions](AGENTS.md)

## Project status
Technical approach approved: React, TypeScript, Vite, an SVG/D3 display map, precomputed distances, and static GitHub Pages hosting through GitHub Actions. The first playable version is implemented with the approved 126-country pool, verified geographic mapping, persistent progress, and sourced discovery cards. GitHub Pages workflows are included; no remote deployment has been performed. GitHub Pages is configured with the custom domain `roam-folio.com`.

## Getting started

Requires Node.js 20.19+ (Node 22 recommended). Geographic assets are already generated and included.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The puzzle uses the browser's UTC date; current schedules cover 2026-01-01 through 2033-03-10. Chad is accepted as a guess now; the expanded answer pool begins on 2032-11-05, after the original published assignments.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Regenerating data

Only geographic processing needs Python (3.14 used for the pinned dependency set):

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/geography/requirements.txt
.venv/bin/python -m unittest discover -s tests/geography -v
.venv/bin/python scripts/geography/generate.py
.venv/bin/python scripts/geography/extend.py
npm run data:schedule
npm run data:discovery
```

For map-display changes alone, use `.venv/bin/python scripts/geography/generate.py --display-only` to retain the existing puzzle and distance data.

The geographic generator verifies retained source archive checksums, records component mapping and calculation bounds, and writes reproducible browser assets. The additive geography extension preserves every v1 distance exactly and computes the new pairs for pool-v2. Schedule generation refuses to rewrite existing assignments or their pool/geography versions. Discovery generation validates exact pool coverage and citations. Read `AGENTS.md` and all documentation before changing rules or data policies.

## GitHub Pages

Push to `main` in a GitHub repository and enable **Settings → Pages → GitHub Actions**. The deployment workflow tests and builds the app, using Pages' supplied base path for either a repository URL or custom domain. The CI workflow also runs geographic and desktop/mobile browser tests. Publishing is not tied to the daily UTC reset.

## Link previews

The initial HTML includes Open Graph and Twitter card metadata and a spoiler-free 1200 × 630 PNG for messaging and social apps. The canonical URL defaults to `https://roam-folio.com/`. Set `VITE_SITE_URL` to the complete public site URL (including any repository subpath) for other deployments; the Pages workflow supplies it from `actions/configure-pages`.

The preview image is committed and needs no runtime service or routine regeneration. To update its artwork after installing Playwright Chromium, run `npm run image:social`. It renders original brand artwork and the approved Natural Earth display data without reading puzzle answers.

## Attribution

Map data: Natural Earth, public domain. Discovery summaries include Wikivoyage contributor material and an attributed country-reference extraction; license and modification notices are in [SOURCES.md](docs/SOURCES.md) and `public/data/attribution.html`. No country photos or recipes are included.
