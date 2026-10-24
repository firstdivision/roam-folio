import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const pool = JSON.parse(await readFile(new URL('../../data/countries/pool.v1.json', import.meta.url), 'utf8'));
const directory = new URL('../../data/discovery/', import.meta.url);
const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
const cards = {};
for (const file of files) {
  const parsed = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  for (const [id, card] of Object.entries(parsed)) {
    if (cards[id]) throw new Error(`Duplicate discovery ${id}`);
    cards[id] = card;
  }
}
function validateCited(item, id) {
  if (!item || typeof item.text !== 'string' || !item.text.trim() || typeof item.sourceTitle !== 'string' || !item.sourceTitle.trim()) throw new Error(`Missing sourced text for ${id}`);
  const url = new URL(item.sourceUrl);
  if (url.protocol !== 'https:') throw new Error(`Invalid source URL for ${id}`);
}
const output = new URL('../../public/data/discovery/', import.meta.url);
await mkdir(output, { recursive: true });
const hashes = {};
for (const country of pool) {
  const card = cards[country.id];
  if (!card || !Array.isArray(card.facts) || card.facts.length !== 3 || !card.food?.name?.trim()) throw new Error(`Incomplete country card ${country.id}`);
  [...card.facts, card.culture, card.food].forEach(item => validateCited(item, country.id));
  const text = JSON.stringify(card) + '\n';
  await writeFile(new URL(`${country.id}.json`, output), text);
  hashes[country.id] = createHash('sha256').update(text).digest('hex');
}
if (Object.keys(cards).length !== pool.length) throw new Error('Discovery data does not match approved eligibility');
await writeFile(new URL('../../data/discovery/manifest.generated.txt', import.meta.url), `Discovery cards: ${pool.length}\nSHA-256\n${Object.entries(hashes).map(([id,hash]) => `${id} ${hash}`).join('\n')}\n`);
const publicData = new URL('../../public/data/', import.meta.url);
await mkdir(new URL('licenses/', publicData), { recursive: true });
await copyFile(new URL('europe-africa/LICENSE.mledoze-countries.txt', import.meta.url), new URL('licenses/ODbL-1.0.txt', publicData));
const extraction = Object.fromEntries(Object.entries(cards).map(([id, card]) => [id, card.facts.filter(fact => fact.sourceUrl.includes('mledoze/countries'))]).filter(([, facts]) => facts.length));
await writeFile(new URL('reference-extract.v1.json', publicData), JSON.stringify({ license: 'ODbL-1.0', attribution: 'mledoze/countries contributors; selected and rewritten by Roamfolio', source: 'https://github.com/mledoze/countries/tree/6031f5df137c41c76d180c55a0782185ae3ed05b', facts: extraction }) + '\n');
console.log(`Validated and published ${pool.length} sourced country postcards.`);
