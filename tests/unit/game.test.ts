import { createHash } from 'node:crypto';
import legacyPool from '../../data/countries/pool.v1.json';
import chadPool from '../../data/countries/pool.v2.json';
import legacySchedule from '../../data/schedules/legacy.v1.json';
import previousSchedule from '../../data/schedules/legacy.v2.json';
import oldMatrix from '../../data/geography/distances.v2.json';
import packed from '../../data/geography/feedback.v3.json';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { answerCountries, countries, evaluateGuess, formatMiles, getPuzzle, getLocalDate, getSolveStatistics, loadProgress, nextReset, proximity, refreshSchedule, resolveCountry, saveProgress, shareResult } from '../../src/game';
import schedule from '../../data/schedules/schedule.v1.json';
import matrix from '../../data/geography/distances.v3.json';

const newAnswers = 'BEN BDI SOM SDS SMR VAT MLT MDA MCO KOS LUX AFG KWT KGZ PRK PSX SYR TJK TKM YEM'.split(' ');
const guessOnlyIds = 'BFA CPV CAF COM CIV DJI GNQ ERI SWZ GAB GMB GIN GNB LSO LBR LBY MWI MRT NER COG STP SYC SLE TGO AND LIE MNE BHR BTN BRN MDV TLS ATG BRB DMA GRD GUY KNA LCA VCT SUR KIR MHL FSM NRU PLW WSM SLB TON TUV VUT'.split(' ');

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('local puzzle dates', () => {
  it.each(['UTC', 'America/Chicago', 'Asia/Kolkata', 'Pacific/Honolulu', 'Pacific/Kiritimati'])(
    'switches only at local midnight in %s, including leap day and year end', timezone => {
      vi.stubEnv('TZ', timezone);
      for (const [year, month, day, today, tomorrow] of [
        [2026, 9, 24, '2026-10-24', '2026-10-25'],
        [2028, 1, 28, '2028-02-28', '2028-02-29'],
        [2028, 1, 29, '2028-02-29', '2028-03-01'],
        [2026, 11, 31, '2026-12-31', '2027-01-01'],
      ] as const) {
        const now = new Date(year, month, day, 23, 59, 59);
        expect(getLocalDate(now)).toBe(today);
        const reset = nextReset(now);
        expect(reset.getTime() - now.getTime()).toBe(1000);
        expect(getLocalDate(reset)).toBe(tomorrow);
        expect(reset.getHours()).toBe(0);
        expect(getPuzzle(today)).toEqual(getPuzzle(getLocalDate(now)));
      }
    });
  it.each([
    ['America/Chicago', '2026-10-24'],
    ['Asia/Kolkata', '2026-10-25'],
    ['Pacific/Kiritimati', '2026-10-25'],
  ])('uses the local date through UTC midnight in %s', (timezone, date) => {
    vi.stubEnv('TZ', timezone);
    expect(getLocalDate(new Date('2026-10-24T23:59:00Z'))).toBe(date);
    expect(getLocalDate(new Date('2026-10-25T00:00:00Z'))).toBe(date);
  });
  it.each([
    [2, 8, 23], // Spring forward.
    [10, 1, 25], // Fall back.
  ])('counts down to local midnight across DST on month %i day %i', (month, day, hours) => {
    vi.stubEnv('TZ', 'America/New_York');
    const now = new Date(2026, month, day);
    const reset = nextReset(now);
    expect(reset.getTime() - now.getTime()).toBe(hours * 3_600_000);
    expect(reset.getDate()).toBe(day + 1);
    expect(reset.getHours()).toBe(0);
    expect(now.getDate()).toBe(day);
  });
  it('validates calendar dates and downloaded schedules independently of local time', async () => {
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    expect(getPuzzle('2026-10-24').date).toBe('2026-10-24');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => schedule }));
    await expect(refreshSchedule()).resolves.toBeUndefined();
  });
  it('rejects invalid and unavailable dates instead of selecting a fallback target', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-1-1', '2025-12-31', '__proto__']) expect(() => getPuzzle(date)).toThrow();
    expect(() => getLocalDate(new Date('invalid'))).toThrow();
    expect(() => nextReset(new Date('invalid'))).toThrow();
  });
  it('is deterministic and changes the target on the next date', () => {
    expect(getPuzzle('2026-10-24')).toEqual(getPuzzle('2026-10-24'));
    expect(getPuzzle('2026-10-24').target).not.toBe(getPuzzle('2026-10-25').target);
  });
  it('contains every eligible country exactly once per cycle with no adjacent repeats', () => {
    const entries = Object.entries(schedule.assignments);
    for (const era of schedule.eras) {
      const expected = (era.poolVersion === 'pool-v1' ? legacyPool : era.poolVersion === 'pool-v2' ? chadPool : answerCountries).map(c => c.id).sort();
      const days = entries.filter(([date]) => date >= era.startsOn && date <= era.endsOn);
      expect(days).toHaveLength(era.cycleLength * era.cycles);
      for (let i = 0; i < days.length; i += era.cycleLength) expect(days.slice(i, i + era.cycleLength).map(([, id]) => id).sort()).toEqual(expected);
    }
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i][1]).not.toBe(entries[i - 1][1]);
      expect(Date.parse(entries[i][0]) - Date.parse(entries[i - 1][0])).toBe(86_400_000);
    }
  });
  it('preserves every v2 answer and era and deterministically generates answer-only cycles', () => {
    const previous = Object.fromEntries(Object.entries(schedule.assignments).filter(([date]) => date <= previousSchedule.endsOn));
    expect(Object.keys(previous)).toHaveLength(previousSchedule.count);
    expect(createHash('sha256').update(JSON.stringify(previous)).digest('hex')).toBe(previousSchedule.assignmentsSha256);
    expect(schedule.eras.slice(0, 2)).toEqual(previousSchedule.eras);
    expect(getPuzzle('2033-03-10').identity).toContain(':pool-v2:');
    expect(getPuzzle('2033-03-11').identity).toContain(':pool-v3:natural-earth-5.1.1-policy-1-pool-3:');
    const path = new URL('../../data/schedules/schedule.v1.json', import.meta.url);
    const before = readFileSync(path, 'utf8');
    execFileSync(process.execPath, ['scripts/schedules/generate.mjs', '--check']);
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(readFileSync(new URL('../../public/data/schedule.v1.json', import.meta.url), 'utf8')).toBe(before);
    const scheduled = new Set(Object.values(schedule.assignments));
    for (const country of countries.filter(country => !country.answerEligible)) expect(scheduled.has(country.id)).toBe(false);
    for (const id of newAnswers) {
      const date = Object.entries(schedule.assignments).find(([, target]) => target === id)![0];
      expect(date >= '2033-03-11').toBe(true);
      expect(getPuzzle(date).target).toBe(id);
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
  it('rejects guess-only answers and answers outside their approved era in fetched schedules', async () => {
    const date = '2026-10-24';
    for (const target of ['BFA', 'BEN']) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...schedule, assignments: { ...schedule.assignments, [date]: target } }) }));
      await expect(refreshSchedule()).rejects.toThrow('Invalid schedule');
    }
  });
});

describe('eligible guesses and geographic feedback', () => {
  it('has 197 guessable countries and exactly the approved 146 answers', () => {
    expect(countries).toHaveLength(197);
    expect(new Set(countries.map(c => c.id)).size).toBe(197);
    expect(answerCountries).toHaveLength(146);
    expect(answerCountries.map(c => c.id).sort()).toEqual([...chadPool.map(c => c.id), ...newAnswers].sort());
    expect(countries.filter(c => !c.answerEligible).map(c => c.id).sort()).toEqual(guessOnlyIds.sort());
    for (const country of countries) expect(resolveCountry(country.name)?.id).toBe(country.id);
    for (const input of ['Congo', 'Korea', 'Atlantis', 'Greenland']) expect(resolveCountry(input)).toBeUndefined();
    expect(resolveCountry('  U.S.A.  ')?.id).toBe('USA');
    expect(resolveCountry('Türkiye')?.id).toBe('TUR');
    expect(resolveCountry('tUrKiYe')?.id).toBe('TUR');
    for (const name of ['Chad', 'Republic of Chad', 'Tchad', 'République du Tchad', 'TCD']) expect(resolveCountry(name)?.id).toBe('TCD');
    for (const [name, id] of [['Holy See', 'VAT'], ['Ivory Coast', 'CIV'], ['East Timor', 'TLS'], ['South Sudan', 'SDS'], ['PSE', 'PSX'], ['XKX', 'KOS'], ['Federated States of Micronesia', 'FSM']]) expect(resolveCountry(name)?.id).toBe(id);
    for (const name of ['Puerto Rico', 'Hong Kong', 'Macao', 'Western Sahara', 'Cook Islands', 'Niue']) expect(resolveCountry(name)).toBeUndefined();
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
    expect(Object.keys(matrix.pairs)).toHaveLength(19306);
    expect(packed.ids).toEqual(countries.map(c => c.id));
    const answers = new Set(answerCountries.map(c => c.id));
    for (const [key, pair] of Object.entries(matrix.pairs)) {
      const [a, b] = key.split(':');
      expect(Number.isFinite(pair.meters)).toBe(true);
      expect(pair.meters).toBeGreaterThanOrEqual(0);
      expect(pair.meters - pair.lowerMeters).toBeLessThanOrEqual(100.002);
      expect(pair.lowerMeters).toBeGreaterThanOrEqual(0);
      expect(pair.lowerMeters).toBeLessThanOrEqual(pair.meters);
      const ai = packed.ids.indexOf(a), bi = packed.ids.indexOf(b);
      const low = Math.min(ai, bi), high = Math.max(ai, bi);
      const index = low * (2 * packed.ids.length - low - 1) / 2 + high - low - 1;
      expect(packed.meters[index]).toBe(pair.meters);
      expect(packed.borderIndices.includes(index)).toBe(pair.borders);
      if (answers.has(a)) expect(evaluateGuess({ ...getPuzzle('2026-10-24'), target: a }, b).meters).toBe(pair.meters);
      if (answers.has(b)) expect(evaluateGuess({ ...getPuzzle('2026-10-24'), target: b }, a).meters).toBe(pair.meters);
      if (pair.borders) expect(pair.meters).toBe(0);
    }
  });
  it('calculates distances for every guess-only country but rejects it as an answer', () => {
    for (const country of countries.filter(c => !c.answerEligible)) {
      for (const answer of answerCountries) {
        const result = evaluateGuess({ ...getPuzzle('2026-10-24'), target: answer.id }, country.id);
        expect(Number.isFinite(result.meters)).toBe(true);
        expect(result.correct).toBe(false);
      }
      expect(() => evaluateGuess({ ...getPuzzle('2026-10-24'), target: country.id }, country.id)).toThrow('Ineligible');
    }
    expect(evaluateGuess({ ...getPuzzle('2026-10-24'), target: 'BEN' }, 'BFA')).toMatchObject({ meters: 0, borders: true, correct: false });
  });
  it('preserves every published v2 pair, including the Chad extension, exactly', () => {
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
    return { values, get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  }
  const solvedGuesses = (puzzle: ReturnType<typeof getPuzzle>, count: number) => [...countries.filter(country => country.id !== puzzle.target).slice(0, count - 1).map(country => country.id), puzzle.target];

  it('averages all saved solves and the current solve once, including after reload', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24');
    const earlier = getPuzzle('2026-10-23'), oldest = getPuzzle('2026-10-22');
    const unfinished = getPuzzle('2026-10-21');
    saveProgress(earlier, solvedGuesses(earlier, 2), store);
    saveProgress(oldest, solvedGuesses(oldest, 5), store);
    saveProgress(unfinished, countries.filter(country => country.id !== unfinished.target).slice(0, 3).map(country => country.id), store);
    const current = [puzzle.target];
    const expected = { solvedCount: 3, totalGuesses: 8, averageGuesses: 8 / 3 };
    expect(getSolveStatistics(puzzle, current, store)).toEqual(expected);
    saveProgress(puzzle, current, store);
    for (let reload = 0; reload < 3; reload++) {
      expect(getSolveStatistics(puzzle, loadProgress(puzzle, store).guesses, store)).toEqual(expected);
    }
    expect(store.length).toBe(4); // No additional counter or migration writes.
    const shared = shareResult(puzzle, current.map(id => evaluateGuess(puzzle, id)), expected);
    expect(shared).toBe('Roam-folio: 2026-10-24\nToday: 1\nAverage: 2.7\n\n🎯');
    expect(shared).not.toContain(countries.find(country => country.id === puzzle.target)!.name);
  });

  it('has no average before the first solve and retains past solves at the next date', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24'), tomorrow = getPuzzle('2026-10-25');
    expect(getSolveStatistics(puzzle, [], store)).toEqual({ solvedCount: 0, totalGuesses: 0, averageGuesses: null });
    const unfinished = [countries.find(country => country.id !== puzzle.target)!.id];
    saveProgress(puzzle, unfinished, store);
    expect(getSolveStatistics(puzzle, unfinished, store).averageGuesses).toBeNull();
    saveProgress(puzzle, solvedGuesses(puzzle, 4), store);
    expect(getSolveStatistics(tomorrow, [], store)).toEqual({ solvedCount: 1, totalGuesses: 4, averageGuesses: 4 });
    saveProgress(tomorrow, [tomorrow.target], store);
    expect(getSolveStatistics(tomorrow, [tomorrow.target], store)).toEqual({ solvedCount: 2, totalGuesses: 5, averageGuesses: 2.5 });
  });

  it('includes previously saved solves across all published pool eras', () => {
    const store = memory(), current = getPuzzle('2033-03-12');
    for (const date of ['2026-10-24', '2032-11-05', '2033-03-11']) {
      const puzzle = getPuzzle(date);
      saveProgress(puzzle, solvedGuesses(puzzle, 3), store);
    }
    expect(getSolveStatistics(current, [], store)).toEqual({ solvedCount: 3, totalGuesses: 9, averageGuesses: 3 });
  });

  it('excludes corrupt progress, forged completion flags, and mismatched storage keys', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24'), previous = getPuzzle('2026-10-23');
    saveProgress(previous, [previous.target], store);
    const key = [...store.values.keys()][0];
    const wrong = countries.find(country => country.id !== previous.target)!.id;
    for (const saved of [
      '{broken', 'null', JSON.stringify({ schema: 2, identity: previous.identity, guesses: [previous.target] }),
      ...[[wrong], ['GRL', previous.target], [wrong, wrong, previous.target], [previous.target, wrong]].map(guesses => JSON.stringify({ schema: 1, identity: previous.identity, guesses, completed: true })),
      JSON.stringify({ schema: 1, identity: puzzle.identity, guesses: [previous.target], completed: true }),
    ]) {
      store.values.set(key, saved);
      expect(getSolveStatistics(puzzle, [], store).solvedCount).toBe(0);
    }
    saveProgress(previous, [previous.target], store);
    store.values.set(key.replace('pool-v1', 'pool-v2'), store.values.get(key)!);
    store.values.set('unrelated-data', '{broken');
    store.values.set('roamfolio:progress:v1:invalid-date', '{}');
    expect(getSolveStatistics(puzzle, [], store)).toEqual({ solvedCount: 1, totalGuesses: 1, averageGuesses: 1 });
  });

  it('includes the in-memory solve when storage is denied or saving exceeds quota', () => {
    const puzzle = getPuzzle('2026-10-24');
    const denied = { get length(): number { throw new Error('denied'); }, key: () => null, getItem: () => null, setItem: () => {} };
    expect(getSolveStatistics(puzzle, [], denied).averageGuesses).toBeNull();
    expect(getSolveStatistics(puzzle, solvedGuesses(puzzle, 2), denied)).toEqual({ solvedCount: 1, totalGuesses: 2, averageGuesses: 2 });
    const store = memory(), previous = getPuzzle('2026-10-23');
    saveProgress(previous, solvedGuesses(previous, 4), store);
    saveProgress(puzzle, [], store);
    store.setItem = () => { throw new Error('quota'); };
    expect(saveProgress(puzzle, solvedGuesses(puzzle, 2), store)).toBe(false);
    expect(getSolveStatistics(puzzle, solvedGuesses(puzzle, 2), store)).toEqual({ solvedCount: 2, totalGuesses: 6, averageGuesses: 3 });
  });
  it('restores ordered guesses and completion after a reload; separates puzzle dates', () => {
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
  it('restores guess-only countries without changing existing progress keys', () => {
    const store = memory(), puzzle = getPuzzle('2026-10-24');
    const guesses = ['BFA', 'LIE', puzzle.target];
    saveProgress(puzzle, guesses, store);
    expect(loadProgress(puzzle, store)).toEqual({ guesses, completed: true, storageAvailable: true });
    expect([...store.values.keys()]).toEqual([`roamfolio:progress:v1:schedule-v1:pool-v1:natural-earth-5.1.1-policy-1:${puzzle.date}`]);
  });
  it('shares only solved results without country names', () => {
    const puzzle = getPuzzle('2026-10-24'), correct = evaluateGuess(puzzle, puzzle.target);
    expect(() => shareResult(puzzle, [])).toThrow();
    const text = shareResult(puzzle, [correct]);
    expect(text).toContain('Roam-folio: 2026-10-24\n');
    expect(text).not.toContain('UTC');
    expect(text).toContain('Today: 1');
    expect(text).toContain('🎯');
    expect(text).toBe('Roam-folio: 2026-10-24\nToday: 1\nAverage: 1.0\n\n🎯');
    expect(text).not.toContain(countries.find(c => c.id === puzzle.target)!.name);
  });
});
