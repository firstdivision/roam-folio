import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { assetUrl, countries, proximity } from '../game';
import type { Guess } from '../game';

type World = FeatureCollection<Geometry, { id: string; name: string; eligible: boolean }>;
type Point = { x: number; y: number };
type View = Point & { scale: number };
// Eligibility lives in the current registry. Display geometry retains its
// original provenance, including the historical pool-v1 eligibility property.
const eligibleIds = new Set(countries.map(country => country.id));
const WIDTH = 1000, HEIGHT = 530, MAX_ZOOM = 32;
const initialView: View = { x: 0, y: 0, scale: 1 };

function constrain(view: View, viewport: { width: number; height: number }): View {
  const scale = Math.max(1, Math.min(MAX_ZOOM, view.scale));
  // Fill taller phone viewports by cropping the sides. Allow panning across
  // that crop even at 1×, with bounds expressed in SVG coordinates.
  const ratio = Math.max(viewport.width / WIDTH, viewport.height / HEIGHT);
  const width = viewport.width / ratio, height = viewport.height / ratio;
  const left = (WIDTH - width) / 2, top = (HEIGHT - height) / 2;
  return { scale, x: Math.max(left + width - WIDTH * scale, Math.min(left, view.x)), y: Math.max(top + height - HEIGHT * scale, Math.min(top, view.y)) };
}
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const separation = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function WorldMap({ guesses, children }: { guesses: Guess[]; children?: ReactNode }) {
  const [world, setWorld] = useState<World | null>(null);
  const [detail, setDetail] = useState<World | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState(initialView);
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(initialView);
  const canvas = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const needsDetail = view.scale >= 3;

  const updateView = useCallback((next: View) => {
    const element = svg.current;
    const bounded = constrain(next, element ? { width: element.clientWidth, height: element.clientHeight } : { width: WIDTH, height: HEIGHT });
    viewRef.current = bounded;
    setView(bounded);
  }, []);
  const pointAt = useCallback((clientX: number, clientY: number): Point => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : { x: WIDTH / 2, y: HEIGHT / 2 };
  }, []);
  const zoom = useCallback((factor: number, anchor: Point = { x: WIDTH / 2, y: HEIGHT / 2 }) => {
    const current = viewRef.current;
    const scale = Math.max(1, Math.min(MAX_ZOOM, current.scale * factor));
    const ratio = scale / current.scale;
    updateView({ scale, x: anchor.x - (anchor.x - current.x) * ratio, y: anchor.y - (anchor.y - current.y) * ratio });
  }, [updateView]);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(assetUrl('data/world.v1.geojson'), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Map unavailable'); return response.json() as Promise<World>; })
      .then(setWorld).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!world || !needsDetail || detail) return;
    const controller = new AbortController();
    setDetailFailed(false);
    fetch(assetUrl('data/world.detail.v1.geojson'), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Map detail unavailable'); return response.json() as Promise<World>; })
      .then(setDetail).catch(error => { if (error.name !== 'AbortError') setDetailFailed(true); });
    return () => controller.abort();
  }, [world, needsDetail, detail, detailAttempt]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !world) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? HEIGHT : 1;
      const delta = Math.max(-1000, Math.min(1000, event.deltaY * unit));
      zoom(Math.exp(-delta * 0.002), pointAt(event.clientX, event.clientY));
    };
    // A non-passive listener allows map zoom without scrolling the entire page.
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [world, pointAt, zoom]);

  const projection = useMemo(() => {
    if (!world) return null;
    const mapWorld = { ...world, features: world.features.filter(feature => feature.properties.id !== 'ATA') };
    return geoEqualEarth().fitExtent([[16, 10], [984, 510]], mapWorld);
  }, [world]);
  const displayedWorld = needsDetail && detail ? detail : world;
  const paths = useMemo(() => {
    if (!displayedWorld || !projection) return [];
    // Keep the overview projection when swapping detail to avoid shifting the view.
    const path = geoPath(projection);
    return displayedWorld.features.filter(feature => feature.properties.id !== 'ATA').map((feature, index) => ({ key: `${feature.properties.id}-${index}`, ...feature.properties, eligible: eligibleIds.has(feature.properties.id), d: path(feature) ?? '' }));
  }, [displayedWorld, projection]);
  const countryPaths = useMemo(() => {
    const results = new Map(guesses.map(guess => [guess.countryId, guess]));
    return paths.map(country => {
      const guess = results.get(country.id);
      return <path key={country.key} d={country.d} fill={guess ? guess.correct ? '#c74332' : proximity(guess.meters).color : '#d8ddd3'} stroke={guess ? '#253c3e' : '#f7f7f0'} strokeWidth={guess ? 1.8 : .8} vectorEffect="non-scaling-stroke"/>;
    });
  }, [paths, guesses]);

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    canvas.current?.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, pointAt(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    const old = pointers.current.get(event.pointerId)!;
    const point = pointAt(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, point);
    const current = viewRef.current;
    if (pointers.current.size === 1) {
      updateView({ ...current, x: current.x + point.x - old.x, y: current.y + point.y - old.y });
    } else {
      const after = [...pointers.current.values()];
      const distance = separation(before[0], before[1]);
      if (distance < 1) return;
      const from = midpoint(before[0], before[1]), to = midpoint(after[0], after[1]);
      const scale = Math.max(1, Math.min(MAX_ZOOM, current.scale * separation(after[0], after[1]) / distance));
      const ratio = scale / current.scale;
      updateView({ scale, x: to.x - (from.x - current.x) * ratio, y: to.y - (from.y - current.y) * ratio });
    }
  }
  function pointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    setDragging(pointers.current.size > 0);
  }

  return <section className="map-panel" aria-label="World map and guesses">
    {children && <div className="map-entry">{children}</div>}
    <div ref={canvas} className={`map-canvas${dragging ? ' is-dragging' : ''}`} role="region" aria-label="Map navigation" aria-describedby="map-navigation-help" tabIndex={world ? 0 : undefined} onKeyDown={event => {
      if (!world) return;
      const current = viewRef.current;
      if (['+', '=', '-', '_', '0', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
      if (event.key === '+' || event.key === '=') zoom(1.5);
      else if (event.key === '-' || event.key === '_') zoom(1 / 1.5);
      else if (event.key === '0' || event.key === 'Home') updateView(initialView);
      else if (event.key === 'ArrowLeft') updateView({ ...current, x: current.x + 80 });
      else if (event.key === 'ArrowRight') updateView({ ...current, x: current.x - 80 });
      else if (event.key === 'ArrowUp') updateView({ ...current, y: current.y + 80 });
      else if (event.key === 'ArrowDown') updateView({ ...current, y: current.y - 80 });
    }}>
      {!world && !failed && <p className="map-message" role="status">Unfolding the map…</p>}
      {failed && <div className="map-message"><p>The map couldn’t load. You can still guess above.</p><button type="button" className="text-button" onClick={() => setAttempt(value => value + 1)}>Try loading the map again</button></div>}
      {world && <svg ref={svg} viewBox="0 0 1000 530" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`World map showing ${guesses.length} guessed ${guesses.length === 1 ? 'country' : 'countries'}. Exact results are listed in your travel log.`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
        <defs><pattern id="map-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.65" fill="#c4c7be" opacity=".45"/></pattern></defs>
        <rect width="1000" height="530" fill="url(#map-dots)"/>
        <g className="map-countries" transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>{countryPaths}</g>
      </svg>}
    </div>
    {needsDetail && !detail && <p className="map-detail-status" role="status">{detailFailed ? <>Showing the overview map. <button className="text-button" type="button" onClick={() => setDetailAttempt(value => value + 1)}>Retry map detail</button></> : 'Loading map detail…'}</p>}
    <div className="map-bottomline"><span className="legend-label">FARTHER</span><span className="distance-gradient" aria-hidden="true"/><span className="legend-label">CLOSER</span></div>
    <p id="map-navigation-help" className="map-navigation-help">Drag to pan. Scroll or pinch to zoom.<span> Keyboard: + / − to zoom, arrow keys to pan, 0 to reset.</span></p>
  </section>;
}
