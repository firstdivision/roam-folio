import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const registry = JSON.parse(await readFile(new URL('../../data/countries/pool.v3.json', import.meta.url), 'utf8'));
const pool = registry.filter(country => country.answerEligible);
const photoManifest = JSON.parse(await readFile(new URL('../../data/photos/postcards.v1.json', import.meta.url), 'utf8'));
if (photoManifest.version !== 'postcard-photos-v1' || JSON.stringify(Object.keys(photoManifest.photos).sort()) !== JSON.stringify(pool.map(country => country.id).sort())) throw new Error('Photo data does not match approved answer eligibility');
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
async function validatePhoto(photo, id) {
  for (const field of ['alt', 'author', 'sourceTitle', 'sourceUrl', 'license', 'licenseUrl', 'changes']) {
    if (typeof photo[field] !== 'string' || !photo[field].trim()) throw new Error(`Missing photo ${field} for ${id}`);
  }
  if (!/^[a-f0-9]{64}$/.test(photo.sha256) || photo.src !== `data/postcards/${id}.${photo.sha256.slice(0, 12)}.jpg`) throw new Error(`Invalid photo path/hash for ${id}`);
  if (!Number.isInteger(photo.width) || photo.width < 400 || photo.width > 960 || !Number.isInteger(photo.height) || photo.height < 100) throw new Error(`Invalid photo dimensions for ${id}`);
  const source = new URL(photo.sourceUrl), license = new URL(photo.licenseUrl);
  if (source.protocol !== 'https:' || source.hostname !== 'commons.wikimedia.org' || !source.pathname.startsWith('/wiki/File:')) throw new Error(`Invalid photo source for ${id}`);
  if (license.protocol !== 'https:') throw new Error(`Invalid photo license URL for ${id}`);
  const cc = /^CC (BY(?:-SA)?) (1\.0|2\.0|2\.5|3\.0|4\.0)( igo)?$/.exec(photo.license);
  const permitted = cc ? license.hostname === 'creativecommons.org' && license.pathname.replace(/\/$/, '').startsWith(`/licenses/${cc[1].toLowerCase()}/${cc[2]}${cc[3] ? '/igo' : ''}`)
    : photo.license === 'CC0' ? license.hostname === 'creativecommons.org' && license.pathname.startsWith('/publicdomain/zero/1.0/')
    : photo.license === 'Public domain' && photo.licenseUrl === `${photo.sourceUrl}#Licensing`;
  if (!permitted) throw new Error(`Unapproved photo license for ${id}`);
  const data = await readFile(new URL(`../../public/${photo.src}`, import.meta.url));
  if (data.length !== photo.bytes || data[0] !== 0xff || data[1] !== 0xd8 || createHash('sha256').update(data).digest('hex') !== photo.sha256) throw new Error(`Photo bytes do not match provenance for ${id}`);
}
const output = new URL('../../public/data/discovery/', import.meta.url);
await mkdir(output, { recursive: true });
const hashes = {};
for (const country of pool) {
  const card = cards[country.id];
  if (!card || !Array.isArray(card.facts) || card.facts.length !== 3 || !card.food?.name?.trim()) throw new Error(`Incomplete country card ${country.id}`);
  [...card.facts, card.culture, card.food].forEach(item => validateCited(item, country.id));
  const photo = photoManifest.photos[country.id];
  await validatePhoto(photo, country.id);
  const { src, alt, width, height, author, sourceTitle, sourceUrl, license, licenseUrl, changes } = photo;
  const text = JSON.stringify({ ...card, photo: { src, alt, width, height, author, sourceTitle, sourceUrl, license, licenseUrl, changes } }) + '\n';
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
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const photoCredits = pool.map(country => {
  const photo = photoManifest.photos[country.id];
  return `<li id="${country.id}"><strong>${escapeHtml(country.name)}</strong>: <a href="${escapeHtml(photo.sourceUrl)}">${escapeHtml(photo.sourceTitle)}</a> — ${escapeHtml(photo.author)}. <a href="${escapeHtml(photo.licenseUrl)}">${escapeHtml(photo.license)}</a>. ${escapeHtml(photo.changes)}</li>`;
}).join('\n');
await writeFile(new URL('photo-credits.html', publicData), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roamfolio — Postcard photo credits</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui,sans-serif;color:#233d40;background:#faf8f2}li{margin:1em 0;overflow-wrap:anywhere}a:focus-visible{outline:3px solid #245d66;outline-offset:3px}</style></head><body><main><p><a href="attribution.html">← All credits</a></p><h1>Postcard photo credits</h1><p>Photos from Wikimedia Commons, selected for each answer-eligible country. Each image retains its individual license; attribution and ShareAlike terms apply to the photos, independently of the application code. Wikimedia thumbnails are resized copies; Roamfolio displays the complete image without cropping. The source page supplies original files, history, and license details. A photo records a place at the time it was taken and is not a claim about current conditions.</p><ul>
${photoCredits}
</ul></main></body></html>\n`);
console.log(`Validated and published ${pool.length} sourced country postcards and licensed photos.`);
