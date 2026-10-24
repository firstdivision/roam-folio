import { createHash } from 'node:crypto';
import legacyPool from '../../data/countries/pool.v1.json';
import legacySchedule from '../../data/schedules/legacy.v1.json';
import oldMatrix from '../../data/geography/distances.v1.json';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { countries, evaluateGuess, formatMiles, getPuzzle, getUtcDate, loadProgress, nextReset, proximity, refreshSchedule, resolveCountry, saveProgress, shareResult } from '../../src/game';
import schedule from '../../data/schedules/schedule.v1.json';
import matrix from '../../data/geography/distances.v2.json';

afterEach(() => vi.unstubAllGlobals());

describe('UTC puzzle dates', () => {
  it('switches at UTC midnight across local timezone offsets, leap day and year end', () => {
    expect(getUtcDate(new Date('2026-10-24T18:59:59-05:00'))).toBe('2026-10-24');
    expect(getUtcDate(new Date('2026-10-24T19:00:00-05:00'))).toBe('2026-10-25');
    expect(getUtcDate(new Date('2026-10-25T08:00:00+09:00'))).toBe('2026-10-24');
    expect(nextReset(new Date('2028-02-28T23:59:59Z')).toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(nextReset(new Date('2028-02-29T23:59:59Z')).toISOString()).toBe('2028-03-01T00:00:00.000Z');
    expect(nextReset(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
  it('rejects invalid and unavailable dates instead of selecting a fallback target', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-1-1', '2025-12-31', '__proto__']) expect(() => getPuzzle(date)).toThrow();
    expect(() => getUtcDate(new Date('invalid'))).toThrow();
  });
  it('is deterministic and changes the target on the next date', () => {
    expect(getPuzzle('2026-10-24')).toEqual(getPuzzle('2026-10-24'));
    expect(getPuzzle('2026-10-24').target).not.toBe(getPuzzle('2026-10-25').target);
  });
  it('contains every eligible country exactly once per cycle with no adjacent repeats', () => {
    const entries = Object.entries(schedule.assignments);
    for (const era of schedule.eras) {
      const expected = (era.poolVersion === 'pool-v1' ? legacyPool : countries).map(c => c.id).sort();
      const days = entries.filter(([date]) => date >= era.startsOn && date <= era.endsOn);
      expect(days).toHaveLength(era.cycleLength * era.cycles);
      for (let i = 0; i < days.length; i += era.cycleLength) expect(days.slice(i, i + era.cycleLength).map(([, id]) => id).sort()).toEqual(expected);
    }
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i][1]).not.toBe(entries[i - 1][1]);
      expect(Date.parse(entries[i][0]) - Date.parse(entries[i - 1][0])).toBe(86_400_000);
    }
  });
  it('preserves every published v1 answer and progress identity across the pool expansion', () => {
    const legacy = Object.fromEntries(Object.entries(schedule.assignments).filter(([date]) => date <= legacySchedule.endsOn));
    expect(Object.keys(legacy)).toHaveLength(legacySchedule.count);
    expect(createHash('sha256').update(JSON.stringify(legacy)).digest('hex')).toBe(legacySchedule.assignmentsSha256);
    expect(getPuzzle('2026-10-24').identity).toBe('schedule-v1:pool-v1:natural-earth-5.1.1-policy-1:2026-10-24');
    expect(getPuzzle('2032-11-05').identity).toContain(':pool-v2:natural-earth-5.1.1-policy-1-pool-2:');
    const chadDay = Object.entries(schedule.assignments).find(([, id]) => id === 'TCD')![0];
    expect(chadDay > legacySchedule.endsOn).toBe(true);
    expect(getPuzzle(chadDay).target).toBe('TCD');
  });
  it('rejects fetched schedules that change published pool/geography eras', async () => {
    const eras = schedule.eras.map(era => ({ ...era, poolVersion: 'pool-v2' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...schedule, eras }) }));
    await expect(refreshSchedule()).rejects.toThrow('newer game version');
  });
  it('rejects fetched schedules that rewrite existing assignments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...schedule, assignments: { ...schedule.assignments, '2026-10-24': 'USA' } }) }));
    const before = getPuzzle('2026-10-24');
    // Guarantee the replacement differs even if the published target is USA.
    const replacement = before.target === 'USA' ? 'FRA' : 'USA';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...schedule, assignments: { ...schedule.assignments, '2026-10-24': replacement } }) }));
    await expect(refreshSchedule()).rejects.toThrow('Published assignments cannot change');
    expect(getPuzzle('2026-10-24')).toEqual(before);
  });
});

describe('eligible guesses and geographic feedback', () => {
  it('has the approved 126 unique countries and rejects ambiguous/ineligible input', () => {
    expect(countries).toHaveLength(126);
    expect(new Set(countries.map(c => c.id)).size).toBe(126);
    for (const country of countries) expect(resolveCountry(country.name)?.id).toBe(country.id);
    for (const input of ['Congo', 'Korea', 'Atlantis', 'Greenland']) expect(resolveCountry(input)).toBeUndefined();
    expect(resolveCountry('  U.S.A.  ')?.id).toBe('USA');
    expect(resolveCountry('Türkiye')?.id).toBe('TUR');
    expect(resolveCountry('tUrKiYe')?.id).toBe('TUR');
    for (const name of ['Chad', 'Republic of Chad', 'Tchad', 'République du Tchad', 'TCD']) expect(resolveCountry(name)?.id).toBe('TCD');
  });
  it('returns zero and separate adjacency for shared land borders, and success for a correct guess', () => {
    const puzzle = { ...getPuzzle('2026-10-24'), target: 'FRA' };
    expect(evaluateGuess(puzzle, 'DEU')).toEqual({ countryId: 'DEU', meters: 0, borders: true, correct: false });
    expect(evaluateGuess(puzzle, 'FRA')).toEqual({ countryId: 'FRA', meters: 0, borders: false, correct: true });
    expect(evaluateGuess(puzzle, 'GBR').meters).toBeGreaterThan(0);
    expect(evaluateGuess(puzzle, 'BRA').borders).toBe(true); // Approved French Guiana component.
    expect(() => evaluateGuess(puzzle, 'GRL')).toThrow('Ineligible');
  });
  it('has complete finite, nonnegative, symmetric pair lookup with certified bounds', () => {
    expect(Object.keys(matrix.pairs)).toHaveLength(7875);
    for (const [key, pair] of Object.entries(matrix.pairs)) {
      const [a, b] = key.split(':');
      expect(Number.isFinite(pair.meters)).toBe(true);
      expect(pair.meters).toBeGreaterThanOrEqual(0);
      expect(pair.meters - pair.lowerMeters).toBeLessThanOrEqual(100.002);
      expect(pair.lowerMeters).toBeGreaterThanOrEqual(0);
      expect(pair.lowerMeters).toBeLessThanOrEqual(pair.meters);
      expect(evaluateGuess({ ...getPuzzle('2026-10-24'), target: a }, b).meters).toBe(pair.meters);
      expect(evaluateGuess({ ...getPuzzle('2026-10-24'), target: b }, a).meters).toBe(pair.meters);
      if (pair.borders) expect(pair.meters).toBe(0);
    }
  });
  it('adds Chad distances while preserving every original pair exactly', () => {
    for (const [key, pair] of Object.entries(oldMatrix.pairs)) expect(matrix.pairs[key as keyof typeof matrix.pairs]).toEqual(pair);
    const puzzle = { ...getPuzzle('2026-10-24'), target: 'TCD' };
    for (const id of ['CMR', 'NGA', 'SDN']) expect(evaluateGuess(puzzle, id)).toMatchObject({ meters: 0, borders: true });
    expect(evaluateGuess(puzzle, 'EGY').meters).toBeGreaterThan(0);
    expect(evaluateGuess(puzzle, 'TCD').correct).toBe(true);
  });
  it('never rounds positive sub-mile distances to zero and validates numeric input', () => {
    expect(formatMiles(0)).toBe('0 miles');
    expect(formatMiles(1)).toBe('<1 mile');
    expect(formatMiles(1600)).toBe('<1 mile');
    expect(formatMiles(1609.344)).toBe('1 mile');
    for (const invalid of [-1, NaN, Infinity]) {
      expect(() => formatMiles(invalid)).toThrow();
      expect(() => proximity(invalid)).toThrow();
    }
  });
  it('applies fixed unrounded proximity bands and the white/red endpoints', () => {
    for (const [miles, emoji] of [[0, '🟥'], [250, '🟥'], [250.0001, '🟧'], [1000, '🟧'], [1000.0001, '🟨'], [3000, '🟨'], [3000.0001, '⬜']] as const) {
      expect(proximity(miles * 1609.344).emoji).toBe(emoji);
    }
    expect(proximity(10_000_000).color).toBe('#ffffff');
    expect(proximity(0).color).toBe('rgb(199, 67, 50)');
  });
});

describe('date-keyed local progress', () => {
  function memory() {
    const values = new Map<string, string>();
    return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  }
  it('restores ordered guesses and completion after a reload; separates UTC days', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24');
    const wrong = countries.find(c => c.id !== puzzle.target)!.id;
    expect(saveProgress(puzzle, [wrong], store)).toBe(true);
    expect(loadProgress(puzzle, store)).toEqual({ guesses: [wrong], completed: false, storageAvailable: true });
    expect(saveProgress(puzzle, [wrong, puzzle.target], store)).toBe(true);
    expect(loadProgress(puzzle, store).completed).toBe(true);
    expect(loadProgress(getPuzzle('2026-10-25'), store).guesses).toEqual([]);
  });
  it('ignores corrupt, duplicated, ineligible, and post-win progress', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24');
    saveProgress(puzzle, [], store);
    const key = [...store.values.keys()][0];
    for (const guesses of [['USA', 'USA'], ['GRL'], [puzzle.target, countries.find(c => c.id !== puzzle.target)!.id]]) {
      store.values.set(key, JSON.stringify({ schema: 1, identity: puzzle.identity, guesses, completed: true }));
      expect(loadProgress(puzzle, store).guesses).toEqual([]);
    }
    store.values.set(key, '{broken');
    expect(loadProgress(puzzle, store).guesses).toEqual([]);
    store.values.set(key, JSON.stringify({ schema: 1, identity: puzzle.identity, guesses: [], completed: true }));
    expect(loadProgress(puzzle, store).completed).toBe(false);
  });
  it('handles storage denial and quota errors without blocking play', () => {
    const store = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    const puzzle = getPuzzle('2026-10-24');
    expect(loadProgress(puzzle, store).storageAvailable).toBe(false);
    expect(saveProgress(puzzle, [], store)).toBe(false);
  });
  it('shares only solved results without country names', () => {
    const puzzle = getPuzzle('2026-10-24'), correct = evaluateGuess(puzzle, puzzle.target);
    expect(() => shareResult(puzzle, [])).toThrow();
    const text = shareResult(puzzle, [correct]);
    expect(text).toContain('2026-10-24 UTC');
    expect(text).toContain('1 guess');
    expect(text).toContain('🎯');
    expect(text).not.toContain(countries.find(c => c.id === puzzle.target)!.name);
  });
});
