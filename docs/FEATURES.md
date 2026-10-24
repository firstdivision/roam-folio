# Feature Requirements

Legend: **MVP** = first playable release; **Later** = planned enhancement; **Open** = decision needed.

## MVP — Daily guessing
- **MVP:** Every player receives the **same target country for the same UTC date**, regardless of timezone, device, or session.
- **MVP:** A new puzzle begins at 00:00 UTC; show a countdown to the next puzzle after completion.
- **MVP:** Select the day's target deterministically from a curated eligible-country list; never pick independently for each visitor.
- **MVP:** Avoid repeating a target until the current eligible-country cycle is exhausted; use a stable, versioned schedule or deterministic permutation.
- **MVP:** Players guess by typing a country name through an accessible search interface with suggestions. Map clicks do not select or submit guesses; the map only displays countries and the guesses made.
- **MVP:** Keep the country field and submit button above the fold on desktop and mobile, with a compact header and no large introductory banner.
- **MVP:** The display map supports drag/touch panning, wheel/pinch zoom, explicit zoom/reset controls, and keyboard navigation. Navigating the map never selects or submits a guess.
- **MVP:** Allow unlimited guesses until the target is found. There is no give-up option or alternative discovery unlock.
- **MVP:** After every guess, display **numeric nearest-border distance to the target** (default miles; optional kilometers) and color the guessed country according to proximity.
- **MVP:** Feedback should be consistent for every player and guess. Use minimum distance between country boundaries; shared land borders display 0 miles and an explicit bordering message (see architecture).
- **MVP:** Track guess count and history; mark guesses on the map; clearly indicate when the target is found.
- **MVP:** Repeating a guessed country returns its existing result without increasing the guess count.
- **MVP:** Proximity uses a continuous gradient from white (very far away), through yellow and orange, to red (very close). Map and history share a fixed global distance-to-color scale; labels and share emojis use the same distance bands. Labels and numeric distances accompany color; outlines distinguish white guesses from unguessed countries.
- **MVP:** Preserve current day's guesses and completion status across reloads on the same device, without an account.
- **MVP:** Do not reveal the destination's name, facts, or food before the player solves the puzzle.
- **MVP:** After solving, show a destination postcard with three sourced facts, one cultural note, and at least one signature food. No recipes are required for MVP.
- **MVP:** Responsive and accessible on mobile and desktop.
- **MVP:** Once solved, offer spoiler-free text sharing with the UTC puzzle date, guess count, and ordered proximity emojis: white square for very far away, yellow and orange squares for intermediate distances, red square for very close, and a distinct success marker. Do not include country names or discovery content. Provide a copyable text fallback when native sharing is unavailable.

## Country pool
- **MVP:** Begin with approximately 100–130 curated, widely recognizable countries; the exact 125-country list was approved on 2026-10-24.
- **MVP:** Avoid making tiny or highly obscure island nations frequent or mandatory answers.
- **MVP:** Do not categorically exclude the Caribbean or Oceania; familiar countries may be included.
- **MVP:** Country identifiers and boundaries must be stable and consistent between map, guess input, and distance data.
- **MVP:** Use the same approved pool for guesses and targets. Display countries outside the pool neutrally, without accepting them as guesses. See [the approved list](COUNTRIES.md).

## Later — Discovery and retention
- Recipes with ingredients, steps, and source attribution.
- Digital passport of solved countries and destination cards.
- Saved recipes and favorites.
- Daily streaks, statistics, and richer shareable results beyond the basic MVP emoji share.
- Regional challenges, cultural and food trivia, achievements.

## Acceptance tests
1. Two devices in different timezones load the same UTC day and receive the same answer.
2. Reloading does not change today's answer or erase a player's guesses.
3. A guess displays a finite, nonnegative distance and map proximity feedback.
4. Repeating a guess returns the same feedback and does not increase the guess count.
5. On the next UTC day, the puzzle changes for everyone simultaneously.
6. No target repeats within one full eligible-country cycle.
7. Discovery content appears only after solving the puzzle.
8. Mobile and keyboard users can complete the core game.
9. Typing and submitting country names is the guessing mechanism; clicking a map country never selects or submits a guess.
10. Very far guesses use white, very close guesses use red, and white guesses remain distinguishable from unguessed countries. Numeric and text feedback remain usable without color.
11. There is no guess limit or give-up action; basic sharing becomes available only after solving.
12. The country field and submit button are fully visible on initial load, including a 320 × 568 viewport.
13. Map zoom, drag, pinch, reset, and keyboard navigation work without changing the guess count or country input; map gestures do not scroll the whole page.

## Decision status

The stack, exact country list, and geographic policy were approved before application implementation. See [COUNTRIES.md](COUNTRIES.md), [GEOGRAPHY.md](GEOGRAPHY.md), and [ARCHITECTURE.md](ARCHITECTURE.md). Future game-rule or country-pool changes require approval.
