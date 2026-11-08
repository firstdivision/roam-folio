import { geoBounds, geoPath } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';

export type MapWorld = FeatureCollection<Geometry, { id: string; name: string; eligible: boolean }>;
export type Point = { x: number; y: number };
export type View = Point & { scale: number };
export type Bounds = [[number, number], [number, number]];
export const WIDTH = 1000, HEIGHT = 530, MIN_ZOOM = 1.2, MAX_ZOOM = 32;
export const initialView: View = { x: -100, y: -53, scale: MIN_ZOOM };
const worldBounds: Bounds = [[0, 0], [WIDTH, HEIGHT]];
const MARGIN = 0.1;
const MIN_CONTEXT_METERS = 250 * 1609.344;

export function framingBounds(world: MapWorld, projection: GeoProjection, countryId: string, meters: number): Bounds {
  if (!Number.isFinite(meters) || meters < 0) throw new Error('Invalid map framing distance');
  const features = world.features.filter(feature => feature.properties.id === countryId);
  if (!features.length) throw new Error('Country map geometry is unavailable');
  const country: MapWorld = { type: 'FeatureCollection', features };
  const [[west, south], [east, north]] = geoBounds(country);
  // A geographic bounding box expanded by a spherical distance conservatively
  // contains the boundary buffer. Allow 1% for the ellipsoidal distance model.
  const radius = Math.max(meters, MIN_CONTEXT_METERS) * 1.01 / 6_371_000;
  const degrees = radius * 180 / Math.PI;
  const latitude = Math.max(Math.abs(south), Math.abs(north));
  if (west > east || latitude + degrees >= 89 || radius >= Math.PI / 2) return worldBounds;
  const longitude = Math.asin(Math.sin(radius) / Math.cos(latitude * Math.PI / 180)) * 180 / Math.PI;
  const left = west - longitude, right = east + longitude;
  if (left <= -180 || right >= 180) return worldBounds;
  const bottom = south - degrees, top = north + degrees;
  const bounds = geoPath(projection).bounds(country);
  // Sample the expanded envelope, not just its corners: Equal Earth bends
  // meridians. A two-unit allowance covers the gaps between one-degree samples.
  const include = (lon: number, lat: number) => {
    const point = projection([lon, lat]);
    if (!point || point.some(value => !Number.isFinite(value))) throw new Error('Map framing projection is unavailable');
    bounds[0][0] = Math.min(bounds[0][0], point[0] - 2);
    bounds[0][1] = Math.min(bounds[0][1], point[1] - 2);
    bounds[1][0] = Math.max(bounds[1][0], point[0] + 2);
    bounds[1][1] = Math.max(bounds[1][1], point[1] + 2);
  };
  for (let lon = left; lon < right; lon += 1) { include(lon, bottom); include(lon, top); }
  for (let lat = bottom; lat < top; lat += 1) { include(left, lat); include(right, lat); }
  include(right, top); include(right, bottom); include(left, top);
  if (bottom <= 0 && top >= 0) { include(left, 0); include(right, 0); }
  return bounds;
}

export function visibleViewport(viewport: { width: number; height: number }) {
  const ratio = Math.max(viewport.width / WIDTH, viewport.height / HEIGHT);
  const width = viewport.width / ratio, height = viewport.height / ratio;
  return { width, height, left: (WIDTH - width) / 2, top: (HEIGHT - height) / 2 };
}

export function fitBounds(bounds: Bounds, viewport: { width: number; height: number }): View {
  const { width, height } = visibleViewport(viewport);
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
    (1 - 2 * MARGIN) * Math.min(width / (bounds[1][0] - bounds[0][0]), height / (bounds[1][1] - bounds[0][1]))));
  return constrain({
    scale,
    x: WIDTH / 2 - (bounds[0][0] + bounds[1][0]) / 2 * scale,
    y: HEIGHT / 2 - (bounds[0][1] + bounds[1][1]) / 2 * scale,
  }, viewport);
}

export function constrain(view: View, viewport: { width: number; height: number }): View {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.scale));
  const { width, height, left, top } = visibleViewport(viewport);
  const axis = (position: number, start: number, length: number, extent: number) => {
    const padding = extent * MARGIN / (1 - 2 * MARGIN);
    const min = start + length - (extent + padding) * scale;
    const max = start + padding * scale;
    return min > max ? start + length / 2 - extent * scale / 2 : Math.max(min, Math.min(max, position));
  };
  return { scale, x: axis(view.x, left, width, WIDTH), y: axis(view.y, top, height, HEIGHT) };
}
