import pool from '../data/countries/pool.v3.json';
import originalPool from '../data/countries/pool.v1.json';
import chadPool from '../data/countries/pool.v2.json';
import publishedSchedule from '../data/schedules/schedule.v1.json';
import distances from '../data/geography/feedback.v3.json';

export type Country = { id: string; name: string; aliases: string[]; answerEligible: boolean };
export type Puzzle = { date: string; target: string; identity: string };
export type Guess = { countryId: string; meters: number; borders: boolean; correct: boolean };
export type SolveStatistics = { solvedCount: number; totalGuesses: number; averageGuesses: number | null };
export type CitedText = { text: string; sourceUrl: string; sourceTitle: string };
export type PostcardPhoto = { src: string; alt: string; width: number; height: number; author: string; sourceTitle: string; sourceUrl: string; license: string; licenseUrl: string; changes: string };
export type Discovery = { facts: CitedText[]; culture: CitedText; food: CitedText & { name: string }; photo?: PostcardPhoto };
export const countries: Country[] = pool;
export const answerCountries = countries.filter(country => country.answerEligible);
const countryIds = new Set(countries.map(country => country.id));
const answerIds = new Set(answerCountries.map(country => country.id));
const eraAnswerIds: Record<string, Set<string>> = {
  'pool-v1': new Set(originalPool.map(country => country.id)),
  'pool-v2': new Set(chadPool.map(country => country.id)),
  'pool-v3': answerIds,
};
let assignments: Record<string, string> = publishedSchedule.assignments;
const matrixIds = new Map(distances.ids.map((id, index) => [id, index]));
const borderIndices = new Set(distances.borderIndices);
const MILE = 1609.344;

export function getLocalDate(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid date');
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
}

export function nextReset(now = new Date()): Date {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid date');
  const reset = new Date(now);
  // Advance by a local calendar day: DST days can be shorter or longer than 24 hours.
  reset.setHours(24, 0, 0, 0);
  return reset;
}

function isPuzzleDate(date: string): boolean {
  // Validate date-only schedule keys independently of the browser's time zone.
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
}

export function getPuzzle(date: string): Puzzle {
  if (!isPuzzleDate(date)) {
    throw new Error('Invalid puzzle date');
  }
  const target = assignments[date];
  if (!target || !answerIds.has(target)) throw new Error('No published puzzle for this date');
  const era = publishedSchedule.eras.find(era => date >= era.startsOn && date <= era.endsOn);
  if (!era) throw new Error('No published pool version for this date');
  if (!eraAnswerIds[era.poolVersion]?.has(target)) throw new Error('Ineligible answer for this pool version');
  return { date, target, identity: `${publishedSchedule.version}:${era.poolVersion}:${era.geographyVersion}:${date}` };
}

export function evaluateGuess(puzzle: Puzzle, countryId: string): Guess {
  if (!countryIds.has(countryId) || !answerIds.has(puzzle.target)) throw new Error('Ineligible country');
  if (countryId === puzzle.target) return { countryId, meters: 0, borders: false, correct: true };
  const a = matrixIds.get(countryId), b = matrixIds.get(puzzle.target);
  if (a === undefined || b === undefined) throw new Error('Geographic feedback is unavailable');
  const low = Math.min(a, b), high = Math.max(a, b);
  const index = low * (2 * distances.ids.length - low - 1) / 2 + high - low - 1;
  const meters = distances.meters[index];
  if (!Number.isFinite(meters) || meters < 0) throw new Error('Geographic feedback is unavailable');
  return { countryId, meters, borders: borderIndices.has(index), correct: false };
}

const normalize = (input: string) => input.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en-US').replace(/[.’']/g, '').replace(/\s+/g, ' ');
const lookup = new Map<string, Country>();
for (const country of countries) {
  for (const name of [country.id, country.name, ...country.aliases]) {
    const normalized = normalize(name);
    if (lookup.has(normalized) && lookup.get(normalized)!.id !== country.id) throw new Error(`Ambiguous alias ${name}`);
    lookup.set(normalized, country);
  }
}
export function resolveCountry(input: string): Country | undefined { return lookup.get(normalize(input)); }

export function formatMiles(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) throw new Error('Invalid distance');
  if (meters === 0) return '0 miles';
  if (meters < MILE) return '<1 mile';
  const miles = Math.round(meters / MILE);
  return `${miles.toLocaleString('en-US')} ${miles === 1 ? 'mile' : 'miles'}`;
}

export function proximity(meters: number): { label: string; color: string; emoji: string } {
  if (!Number.isFinite(meters) || meters < 0) throw new Error('Invalid distance');
  const miles = meters / MILE;
  const band = miles <= 250 ? { label: 'Very close', emoji: '🟥' }
    : miles <= 1000 ? { label: 'Close', emoji: '🟧' }
    : miles <= 3000 ? { label: 'Far', emoji: '🟨' } : { label: 'Very far away', emoji: '⬜' };
  // Continuous fixed gradient, with a white plateau for very far distances.
  const stops = [
    { at: 0, rgb: [199, 67, 50] }, { at: 250, rgb: [227, 91, 58] },
    { at: 1000, rgb: [243, 157, 68] }, { at: 2000, rgb: [247, 219, 106] },
    { at: 3000, rgb: [255, 255, 255] },
  ];
  const end = stops.findIndex(stop => stop.at >= miles);
  if (end === -1) return { ...band, color: '#ffffff' };
  const high = stops[end], low = stops[Math.max(0, end - 1)];
  const t = high.at === low.at ? 0 : (miles - low.at) / (high.at - low.at);
  const rgb = high.rgb.map((value, index) => Math.round(low.rgb[index] + (value - low.rgb[index]) * t));
  return { ...band, color: `rgb(${rgb.join(', ')})` };
}

export function assetUrl(path: string): string { return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`; }

/** Revalidate append-only schedules without accepting edits to bundled dates. */
export async function refreshSchedule(): Promise<void> {
  const response = await fetch(assetUrl('data/schedule.v1.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Schedule could not be refreshed');
  const next = await response.json();
  if (next.version !== publishedSchedule.version || next.poolVersion !== publishedSchedule.poolVersion
      || next.geographyVersion !== publishedSchedule.geographyVersion
      || JSON.stringify(next.eras) !== JSON.stringify(publishedSchedule.eras)
      || !next.assignments || typeof next.assignments !== 'object') {
    throw new Error('A newer game version is required for this schedule');
  }
  const entries = Object.entries(next.assignments);
  if (!entries.every(([date, id]) => {
    const era = publishedSchedule.eras.find(era => date >= era.startsOn && date <= era.endsOn);
    return isPuzzleDate(date) && typeof id === 'string'
      && era && eraAnswerIds[era.poolVersion]?.has(id);
  })) throw new Error('Invalid schedule');
  if (Object.entries(assignments).some(([date, id]) => next.assignments[date] !== id)) throw new Error('Published assignments cannot change');
  assignments = Object.fromEntries(entries) as Record<string, string>;
}

const storageKey = (puzzle: Puzzle) => `roamfolio:progress:v1:${puzzle.identity}`;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

function validGuesses(puzzle: Puzzle, raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length > countries.length || raw.some(id => typeof id !== 'string' || !countryIds.has(id)) || new Set(raw).size !== raw.length) return;
  const wonAt = raw.indexOf(puzzle.target);
  if (wonAt !== -1 && wonAt !== raw.length - 1) return;
  return raw;
}

export function loadProgress(puzzle: Puzzle, storage?: StorageAccess): { guesses: string[]; completed: boolean; storageAvailable: boolean } {
  try {
    const store = storage ?? window.localStorage;
    const saved = store.getItem(storageKey(puzzle));
    if (!saved) return { guesses: [], completed: false, storageAvailable: true };
    let data;
    try { data = JSON.parse(saved); } catch { return { guesses: [], completed: false, storageAvailable: true }; }
    const guesses = data?.schema === 1 && data.identity === puzzle.identity ? validGuesses(puzzle, data.guesses) : undefined;
    return { guesses: guesses ?? [], completed: guesses?.includes(puzzle.target) ?? false, storageAvailable: true };
  } catch { return { guesses: [], completed: false, storageAvailable: false }; }
}

export function saveProgress(puzzle: Puzzle, guesses: string[], storage?: StorageAccess): boolean {
  if (!validGuesses(puzzle, guesses)) throw new Error('Invalid progress');
  try {
    const store = storage ?? window.localStorage;
    store.setItem(storageKey(puzzle), JSON.stringify({ schema: 1, identity: puzzle.identity, guesses, completed: guesses.includes(puzzle.target) }));
    return true;
  } catch { return false; }
}

/** Derive lifetime statistics from saved progress, counting each solved puzzle once. */
export function getSolveStatistics(puzzle: Puzzle, guesses: string[], storage?: StorageAccess & Pick<Storage, 'key' | 'length'>): SolveStatistics {
  if (!validGuesses(puzzle, guesses)) throw new Error('Invalid progress');
  const solves = new Map<string, number>();
  try {
    const store = storage ?? window.localStorage;
    for (let index = 0; index < store.length; index++) {
      const key = store.key(index);
      if (!key?.startsWith('roamfolio:progress:v1:')) continue;
      let savedPuzzle: Puzzle;
      try { savedPuzzle = getPuzzle(key.slice(-10)); } catch { continue; }
      if (key !== storageKey(savedPuzzle) || savedPuzzle.identity === puzzle.identity) continue;
      const progress = loadProgress(savedPuzzle, store);
      if (progress.completed) solves.set(savedPuzzle.identity, progress.guesses.length);
    }
  } catch {
    // With storage denied, the current solve can still be displayed and shared.
    solves.clear();
  }
  // Include the current in-memory solve even if saving failed, without double counting.
  if (guesses.at(-1) === puzzle.target) solves.set(puzzle.identity, guesses.length);
  const totalGuesses = [...solves.values()].reduce((total, count) => total + count, 0);
  return { solvedCount: solves.size, totalGuesses, averageGuesses: solves.size ? totalGuesses / solves.size : null };
}

export function shareResult(puzzle: Puzzle, guesses: Guess[], statistics?: SolveStatistics): string {
  if (!guesses.at(-1)?.correct) throw new Error('Solve the puzzle before sharing');
  const average = (statistics ?? getSolveStatistics(puzzle, guesses.map(guess => guess.countryId))).averageGuesses ?? guesses.length;
  return `Roam-folio: ${puzzle.date}\nToday: ${guesses.length}\nAverage: ${average.toFixed(1)}\n\n${guesses.map(guess => guess.correct ? '🎯' : proximity(guess.meters).emoji).join('')}`;
}
