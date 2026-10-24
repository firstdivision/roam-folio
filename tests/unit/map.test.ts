import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geoArea, geoEqualEarth, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';

const world = JSON.parse(readFileSync(new URL('../../public/data/world.v1.geojson', import.meta.url), 'utf8')) as FeatureCollection;

describe('licensed display geometry', () => {
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
