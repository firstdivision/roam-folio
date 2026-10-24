import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geoArea, geoEqualEarth, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';

const readWorld = (file: string) => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8')) as FeatureCollection;

describe.each(['world.v1.geojson', 'world.detail.v1.geojson'])('licensed display geometry: %s', file => {
  const world = readWorld(file);
  it('renders country interiors rather than the complement of the globe', () => {
    for (const feature of world.features) {
      // No country in this dataset occupies a hemisphere. A reversed tiny ring
      // can otherwise turn a valid planar polygon into a globe-filling SVG path.
      expect(geoArea(feature), `${feature.properties?.id} spherical area`).toBeLessThan(2 * Math.PI);
    }
    const totalArea = world.features.reduce((sum, feature) => sum + geoArea(feature), 0);
    expect(totalArea).toBeGreaterThan(2);
    expect(totalArea).toBeLessThan(5);
  });
  it('produces finite projected country paths', () => {
    const path = geoPath(geoEqualEarth());
    for (const feature of world.features) {
      const drawing = path(feature);
      expect(drawing).toBeTruthy();
      expect(drawing).not.toMatch(/NaN|Infinity/);
    }
  });
});

it('retains more boundary detail with the same country identities and components', () => {
  const overview = readWorld('world.v1.geojson'), detail = readWorld('world.detail.v1.geojson');
  expect(detail.features.map(feature => feature.properties)).toEqual(overview.features.map(feature => feature.properties));
  function countCoordinates(value: unknown): number {
    if (!Array.isArray(value)) return 0;
    return typeof value[0] === 'number' ? 1 : value.reduce((sum, item) => sum + countCoordinates(item), 0);
  }
  const vertices = (world: FeatureCollection) => world.features.reduce((sum, feature) => sum + ('coordinates' in feature.geometry ? countCoordinates(feature.geometry.coordinates) : 0), 0);
  expect(vertices(detail)).toBeGreaterThan(vertices(overview) * 2);
});
