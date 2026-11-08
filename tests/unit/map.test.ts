import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { geoArea, geoCircle, geoEqualEarth, geoPath } from 'd3-geo';
import type { FeatureCollection, Position } from 'geojson';
import { constrain, fitBounds, framingBounds, HEIGHT, initialView, MIN_ZOOM, visibleViewport, WIDTH } from '../../src/map/framing';
import type { Bounds, MapWorld } from '../../src/map/framing';

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

describe('distance-only map framing', () => {
  const world = JSON.parse(readFileSync(new URL('../../public/data/world.v1.geojson', import.meta.url), 'utf8')) as MapWorld;
  const projection = geoEqualEarth().fitExtent([[16, 10], [984, 510]], { ...world, features: world.features.filter(feature => feature.properties.id !== 'ATA') });
  const wholeWorld: Bounds = [[0, 0], [WIDTH, HEIGHT]];
  const mile = 1609.344;
  const viewports = [{ width: 740, height: 318 }, { width: 350, height: 400 }, { width: 280, height: 300 }];
  const inside = (inner: Bounds, outer: Bounds) => {
    for (const axis of [0, 1]) {
      expect(inner[0][axis]).toBeGreaterThanOrEqual(outer[0][axis] - 0.01);
      expect(inner[1][axis]).toBeLessThanOrEqual(outer[1][axis] + 0.01);
    }
  };

  it('uses at least 250 miles of context without changing the distance clue', () => {
    const border = framingBounds(world, projection, 'DEU', 0);
    expect(border).toEqual(framingBounds(world, projection, 'DEU', 250 * mile));
    expect(border).toEqual(framingBounds(world, projection, 'DEU', mile));
    const farther = framingBounds(world, projection, 'DEU', 1000 * mile);
    inside(border, farther);
    expect(farther[1][0] - farther[0][0]).toBeGreaterThan(border[1][0] - border[0][0]);
  });

  it.each(['FJI', 'RUS'])('uses the overview for seam country %s', id => {
    expect(framingBounds(world, projection, id, 0)).toEqual(wholeWorld);
  });
  it('uses the overview when the context area reaches a pole', () => {
    expect(framingBounds(world, projection, 'NOR', 1000 * mile)).toEqual(wholeWorld);
  });

  it('falls back to the whole world for a very distant clue', () => {
    expect(framingBounds(world, projection, 'DEU', 10_000 * mile)).toEqual(wholeWorld);
  });

  it('includes all integral overseas components rather than just the mainland', () => {
    const country = { ...world, features: world.features.filter(feature => feature.properties.id === 'FRA') };
    const bounds = framingBounds(world, projection, 'FRA', 0);
    inside(geoPath(projection).bounds(country), bounds);
    expect(fitBounds(bounds, viewports[0]).scale).toBeLessThan(2);
  });

  it('contains detailed country shapes without changing the overview framing', () => {
    const detail = JSON.parse(readFileSync(new URL('../../public/data/world.detail.v1.geojson', import.meta.url), 'utf8')) as MapWorld;
    for (const id of ['DEU', 'JAM', 'FRA']) {
      const bounds = framingBounds(world, projection, id, 0);
      inside(geoPath(projection).bounds({ ...detail, features: detail.features.filter(feature => feature.properties.id === id) }), bounds);
      const view = fitBounds(bounds, viewports[1]);
      expect(fitBounds(framingBounds(world, projection, id, 0), viewports[1])).toEqual(view);
    }
  });

  it.each(['DEU', 'JAM', 'FRA'])('contains dense geographic distance circles for %s', id => {
    const bounds = framingBounds(world, projection, id, 1000 * mile);
    const vertices: Position[] = [];
    for (const feature of world.features.filter(feature => feature.properties.id === id)) {
      if (feature.geometry.type === 'Polygon') vertices.push(...feature.geometry.coordinates.flat());
      else if (feature.geometry.type === 'MultiPolygon') vertices.push(...feature.geometry.coordinates.flat(2));
    }
    const circle = geoCircle().radius(1000 * mile / 6_371_000 * 180 / Math.PI).precision(0.1);
    for (let index = 0; index < vertices.length; index += Math.max(1, Math.floor(vertices.length / 40))) {
      const center = vertices[index];
      inside(geoPath(projection).bounds(circle.center([center[0], center[1]])()), bounds);
    }
  });

  it.each(viewports)('never zooms out past the initial view at $width x $height', viewport => {
    const view = fitBounds(wholeWorld, viewport);
    expect(view).toEqual(initialView);
    for (const scale of [0, 0.8, 1, 1.19]) {
      expect(constrain({ ...view, scale }, viewport).scale).toBe(MIN_ZOOM);
    }
  });

  it('fits with margins when possible and otherwise respects minimum zoom', () => {
    for (const id of new Set(world.features.filter(feature => feature.properties.id !== 'ATA').map(feature => feature.properties.id))) {
      for (const meters of [0, 1000 * mile, 5000 * mile]) {
        const bounds = framingBounds(world, projection, id, meters);
        for (const viewport of viewports) {
          const view = fitBounds(bounds, viewport), visible = visibleViewport(viewport);
          const projected: Bounds = [
            [bounds[0][0] * view.scale + view.x, bounds[0][1] * view.scale + view.y],
            [bounds[1][0] * view.scale + view.x, bounds[1][1] * view.scale + view.y],
          ];
          expect(view.scale).toBeGreaterThanOrEqual(MIN_ZOOM);
          if (view.scale > MIN_ZOOM) {
            inside(projected, [[visible.left + visible.width * 0.1, visible.top + visible.height * 0.1],
              [visible.left + visible.width * 0.9, visible.top + visible.height * 0.9]]);
          }
          expect(constrain(view, viewport)).toEqual(view);
        }
      }
    }
  });

  it('retains the initial reset view and reports invalid inputs explicitly', () => {
    for (const viewport of viewports) expect(constrain(initialView, viewport)).toEqual(initialView);
    expect(() => framingBounds(world, projection, 'missing', 0)).toThrow('geometry is unavailable');
    expect(() => framingBounds(world, projection, 'DEU', NaN)).toThrow('Invalid map framing distance');
    expect(() => framingBounds(world, projection, 'DEU', -1)).toThrow('Invalid map framing distance');
  });
});
