import pool from '../data/countries/pool.v2.json';
import publishedSchedule from '../data/schedules/schedule.v1.json';
import distances from '../data/geography/feedback.v2.json';

export type Country = { id: string; name: string; aliases: string[] };
export type Puzzle = { date: string; target: string; identity: string };
export type Guess = { countryId: string; meters: number; borders: boolean; correct: boolean };
export type CitedText = { text: string; sourceUrl: string; sourceTitle: string };
export type Discovery = { facts: CitedText[]; culture: CitedText; food: CitedText & { name: string } };
export const countries: Country[] = pool;
const countryIds = new Set(countries.map(country => country.id));
let assignments: Record<string, string> = publishedSchedule.assignments;
const matrixIds = new Map(distances.ids.map((id, index) => [id, index]));
const borderIndices = new Set(distances.borderIndices);
const MILE = 1609.344;
const DAY = 86_400_000;

export function getUtcDate(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid date');
  return now.toISOString().slice(0, 10);
}

export function nextReset(now = new Date()): Date {
  return new Date(Date.parse(getUtcDate(now) + 'T00:00:00Z') + DAY);
}

export function getPuzzle(date: string): Puzzle {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || getUtcDate(new Date(date)) !== date) {
    throw new Error('Invalid UTC puzzle date');
  }
  const target = assignments[date];
  if (!target || !countryIds.has(target)) throw new Error('No published puzzle for this date');
  const era = publishedSchedule.eras.find(era => date >= era.startsOn && date <= era.endsOn);
  if (!era) throw new Error('No published pool version for this date');
  return { date, target, identity: `${publishedSchedule.version}:${era.poolVersion}:${era.geographyVersion}:${date}` };
}

export function evaluateGuess(puzzle: Puzzle, countryId: string): Guess {
  if (!countryIds.has(countryId) || !countryIds.has(puzzle.target)) throw new Error('Ineligible country');
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
  if (!entries.every(([date, id]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof id === 'string' && countryIds.has(id))) throw new Error('Invalid schedule');
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

export function shareResult(puzzle: Puzzle, guesses: Guess[]): string {
  if (!guesses.at(-1)?.correct) throw new Error('Solve the puzzle before sharing');
  return `Roamfolio · ${puzzle.date} UTC\n${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'} to discover today's country\n${guesses.map(guess => guess.correct ? '🎯' : proximity(guess.meters).emoji).join('')}\nDiscover a country. Collect its story.`;
}
