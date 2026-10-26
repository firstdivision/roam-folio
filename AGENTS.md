# AI Agent Instructions — Roamfolio

## Read first
Before proposing or making changes, read `README.md`, `docs/VISION.md`, `docs/FEATURES.md`, and `docs/ARCHITECTURE.md`.

## Product invariants
- **One shared puzzle per calendar date, unlocking at midnight in the browser's local time zone.** Players on the same local date receive the same target; never generate a different target per user or per page load.
- A guess must produce a **nearest-border distance in miles** to the target country (0 miles for shared land borders) and a consistent visual proximity cue.
- The target and its discovery content must not be exposed in the normal user interface before completion; note that purely client-side answers cannot be fully secret from technically skilled users.
- Preserve today's guesses and completion state across reloads without requiring an account.
- Do not choose from all world countries by default: use a curated, documented eligibility list. Familiar countries from the Caribbean and Oceania may be included.
- Food and culture are the post-game reward, not the primary guessing mechanic.

## Workflow
1. Explain the smallest useful next step and identify relevant acceptance criteria.
2. Ask for approval before choosing a framework, hosting provider, database, authentication system, or changing game rules.
3. Implement in small, testable increments; avoid unnecessary dependencies or abstractions.
4. Add tests for date boundaries, deterministic daily selection, distance calculations, persistence, and country eligibility.
5. Keep docs updated when requirements or decisions change.
6. Do not fabricate country facts, recipes, geographic boundaries, or attribution; track sources and licenses.

## Quality
- Mobile-first, keyboard-accessible, and screen-reader-conscious.
- Use real, licensed geographic data, not hand-drawn approximations for country boundaries.
- Keep gameplay deterministic and explainable.
- Never commit credentials or API keys.
- Avoid silently adding features not approved in the project docs.

## Status of decisions
Items labeled **Open decision** in `docs/ARCHITECTURE.md` are not settled. Present options rather than silently deciding them.
