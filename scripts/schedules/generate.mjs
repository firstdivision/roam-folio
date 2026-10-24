import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const pool = JSON.parse(await readFile(new URL('../../data/countries/pool.v1.json', import.meta.url), 'utf8'));
const seed = 'roamfolio/pool-v1/schedule-v1';
const start = Date.parse('2026-01-01T00:00:00Z');
const assignments = {};
let previous;
for (let cycle = 0; cycle < 20; cycle++) {
  const order = pool.map(country => ({
    id: country.id,
    hash: createHash('sha256').update(`${seed}:${cycle}:${country.id}`).digest('hex'),
  })).sort((a, b) => a.hash.localeCompare(b.hash, 'en')).map(country => country.id);
  if (order[0] === previous) [order[0], order[1]] = [order[1], order[0]];
  order.forEach((id, offset) => {
    const date = new Date(start + (cycle * pool.length + offset) * 86_400_000).toISOString().slice(0, 10);
    assignments[date] = id;
  });
  previous = order.at(-1);
}
const schedule = {
  version: 'schedule-v1', poolVersion: 'pool-v1', geographyVersion: 'natural-earth-5.1.1-policy-1',
  seed, cycleLength: pool.length, startsOn: '2026-01-01', endsOn: Object.keys(assignments).at(-1), assignments,
};
// Regeneration must never rewrite an assignment that has already been published.
const path = new URL('../../data/schedules/schedule.v1.json', import.meta.url);
try {
  const old = JSON.parse(await readFile(path, 'utf8'));
  for (const [date, id] of Object.entries(old.assignments)) {
    if (assignments[date] !== id) throw new Error(`Refusing to rewrite published puzzle ${date}`);
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(new URL('../../data/schedules/', import.meta.url), { recursive: true });
await mkdir(new URL('../../public/data/', import.meta.url), { recursive: true });
for (const location of [path, new URL('../../public/data/schedule.v1.json', import.meta.url)]) {
  await writeFile(location, JSON.stringify(schedule) + '\n');
}
console.log(`Published ${Object.keys(assignments).length} immutable daily assignments through ${schedule.endsOn}.`);
