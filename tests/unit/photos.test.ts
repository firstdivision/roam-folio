import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import pool from '../../data/countries/pool.v3.json';
import manifest from '../../data/photos/postcards.v1.json';
import research from '../../scripts/content/photos/sources.v1.json';

describe('licensed postcard photographs', () => {
  const entries = Object.entries(manifest.photos);
  it('covers every answer and no guess-only countries with a distinct, locally retained photo', () => {
    const answers = pool.filter(country => country.answerEligible).map(country => country.id).sort();
    expect(entries.map(([id]) => id).sort()).toEqual(answers);
    expect(Object.keys(research.sources).sort()).toEqual(answers);
    expect(new Set(entries.map(([, photo]) => photo.src)).size).toBe(answers.length);
    expect(readdirSync(new URL('../../public/data/postcards/', import.meta.url)).sort()).toEqual(entries.map(([, photo]) => photo.src.split('/').at(-1)).sort());
  });

  it('pins real JPEG bytes and file-level licenses, source records, credits, and dimensions', () => {
    for (const [id, photo] of entries) {
      const source = research.sources[id as keyof typeof research.sources];
      const bytes = readFileSync(new URL(`../../public/${photo.src}`, import.meta.url));
      expect(bytes.subarray(0, 2).toString('hex'), id).toBe('ffd8');
      expect(bytes.length, id).toBe(photo.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), id).toBe(photo.sha256);
      expect(photo.src, id).toBe(`data/postcards/${id}.${photo.sha256.slice(0, 12)}.jpg`);
      expect(photo.width, id).toBeGreaterThanOrEqual(400);
      expect(photo.width, id).toBeLessThanOrEqual(960);
      expect(photo.height, id).toBeGreaterThan(100);
      expect(photo.alt.length, id).toBeGreaterThan(8);
      expect(photo.alt, id).not.toMatch(/\[\[|\]\]|thumbnail|[0-9]+px|thumb\|/);
      expect(photo.author, id).not.toMatch(/No machine-readable|assumed \(based on/);
      expect(photo.author.trim(), id).not.toBe('');
      expect(source.metadata.Artist.value.trim(), id).not.toBe('');
      expect(photo.license, id).toBe(source.metadata.LicenseShortName.value);
      expect(photo.license, id).toMatch(/^CC BY(?:-SA)? (?:1\.0|2\.0|2\.5|3\.0|4\.0)(?: igo)?$|^CC0$|^Public domain$/);
      expect(new URL(photo.sourceUrl).hostname, id).toBe('commons.wikimedia.org');
      expect(new URL(photo.licenseUrl).protocol, id).toBe('https:');
      expect(source.file, id).toBe(`File:${photo.sourceTitle}`);
      expect(photo.changes, id).toMatch(/^(Resized|Unmodified)\.$/);
    }
  });

  it('publishes the matching image and credit with each solved-only country card', () => {
    const credits = readFileSync(new URL('../../public/data/photo-credits.html', import.meta.url), 'utf8');
    for (const [id, photo] of entries) {
      const card = JSON.parse(readFileSync(new URL(`../../public/data/discovery/${id}.json`, import.meta.url), 'utf8'));
      for (const field of ['src', 'alt', 'width', 'height', 'author', 'sourceTitle', 'sourceUrl', 'license', 'licenseUrl', 'changes'] as const) expect(card.photo[field], `${id}.${field}`).toBe(photo[field]);
      expect(credits, id).toContain(`id="${id}"`);
    }
  });
});
