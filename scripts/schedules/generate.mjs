import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readPool = async version => JSON.parse(await readFile(new URL(`../../data/countries/pool.${version}.json`, import.meta.url), 'utf8'));
const legacyPool = await readPool('v1');
const chadPool = await readPool('v2');
const registry = await readPool('v3');
if (registry.some(country => typeof country.answerEligible !== 'boolean')) throw new Error('Missing answer eligibility');
const currentPool = registry.filter(country => country.answerEligible);
const DAY = 86_400_000;
const start = Date.parse('2026-01-01T00:00:00Z');
const seed = 'roamfolio/pool-v1/schedule-v1';
const assignments = {};
const eras = [];
let cursor = start, previous;
function appendCycles(pool, poolVersion, geographyVersion, cycleSeed, count) {
  const startsOn = new Date(cursor).toISOString().slice(0, 10);
  for (let cycle = 0; cycle < count; cycle++) {
    const order = pool.map(country => ({
      id: country.id,
      hash: createHash('sha256').update(`${cycleSeed}:${cycle}:${country.id}`).digest('hex'),
    })).sort((a, b) => a.hash.localeCompare(b.hash, 'en')).map(country => country.id);
    if (order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
    for (const id of order) {
      assignments[new Date(cursor).toISOString().slice(0, 10)] = id;
      cursor += DAY;
    }
    previous = order.at(-1);
  }
  eras.push({ startsOn, endsOn: new Date(cursor - DAY).toISOString().slice(0, 10),
    poolVersion, geographyVersion, seed: cycleSeed, cycleLength: pool.length, cycles: count });
}
// Preserve all twenty already-published cycles, then begin the expanded pool.
appendCycles(legacyPool, 'pool-v1', 'natural-earth-5.1.1-policy-1', seed, 20);
appendCycles(chadPool, 'pool-v2', 'natural-earth-5.1.1-policy-1-pool-2', 'roamfolio/pool-v2/schedule-v1', 1);
appendCycles(currentPool, 'pool-v3', 'natural-earth-5.1.1-policy-1-pool-3', 'roamfolio/pool-v3/schedule-v1', 1);
const schedule = {
  version: 'schedule-v1', poolVersion: 'pool-v1', geographyVersion: 'natural-earth-5.1.1-policy-1',
  seed, cycleLength: legacyPool.length, startsOn: '2026-01-01', endsOn: Object.keys(assignments).at(-1), eras, assignments,
};
const path = new URL('../../data/schedules/schedule.v1.json', import.meta.url);
try {
  const old = JSON.parse(await readFile(path, 'utf8'));
  for (const [date, id] of Object.entries(old.assignments)) {
    if (assignments[date] !== id) throw new Error(`Refusing to rewrite published puzzle ${date}`);
  }
  if (old.eras && JSON.stringify(old.eras) !== JSON.stringify(eras.slice(0, old.eras.length))) {
    throw new Error('Refusing to rewrite published pool/geography versions');
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const text = JSON.stringify(schedule) + '\n';
const locations = [path, new URL('../../public/data/schedule.v1.json', import.meta.url)];
if (process.argv.includes('--check')) {
  for (const location of locations) {
    if (await readFile(location, 'utf8') !== text) throw new Error(`Schedule is not reproducible: ${location.pathname}`);
  }
} else {
  await mkdir(new URL('../../data/schedules/', import.meta.url), { recursive: true });
  await mkdir(new URL('../../public/data/', import.meta.url), { recursive: true });
  for (const location of locations) await writeFile(location, text);
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Published'} ${Object.keys(assignments).length} immutable daily assignments through ${schedule.endsOn}; ${currentPool.length}-answer pool-v3 begins ${eras[2].startsOn}.`);
