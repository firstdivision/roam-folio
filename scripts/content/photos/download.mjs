import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Re-fetch pinned files only. Choosing or changing a photograph is an editorial step.
const manifest = JSON.parse(await readFile(new URL('../../../data/photos/postcards.v1.json', import.meta.url), 'utf8'));
await mkdir(new URL('../../../public/data/postcards/', import.meta.url), { recursive: true });
for (const [id, photo] of Object.entries(manifest.photos)) {
  if (!/^[A-Z]{3}$/.test(id) || !/^[a-f0-9]{64}$/.test(photo.sha256) || photo.src !== `data/postcards/${id}.${photo.sha256.slice(0, 12)}.jpg`) throw new Error(`Invalid photo identity: ${id}`);
  const target = new URL(`../../../public/${photo.src}`, import.meta.url);
  let data;
  try { data = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!data) {
    const url = new URL(photo.downloadUrl);
    if (url.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) throw new Error(`Unapproved photo download host: ${id}`);
    const response = await fetch(url, { headers: { 'User-Agent': 'RoamfolioPostcards/1.0 (https://roam-folio.com/)' }, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Photo download failed: ${id} (${response.status})`);
    data = Buffer.from(await response.arrayBuffer());
  }
  if (data.length !== photo.bytes || createHash('sha256').update(data).digest('hex') !== photo.sha256) throw new Error(`Photo changed: ${id}. Review its source and license before updating the lock.`);
  await writeFile(target, data);
}
console.log(`Verified ${Object.keys(manifest.photos).length} pinned postcard photos.`);
