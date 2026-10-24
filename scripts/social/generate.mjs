// Render the approved public-domain map and original brand artwork to a PNG.
// Requires the existing Playwright Chromium installation; never reads a puzzle.
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { geoEqualEarth, geoPath } from 'd3-geo';

const world = JSON.parse(await readFile(new URL('../../public/data/world.v1.geojson', import.meta.url), 'utf8'));
world.features = world.features.filter(feature => feature.properties.id !== 'ATA');
const projection = geoEqualEarth().fitExtent([[625, 125], [1120, 445]], world);
const path = geoPath(projection);
const countries = world.features.map(feature => `<path d="${path(feature)}"/>`).join('');
const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#c7cebf" opacity=".5"/></pattern>
    <linearGradient id="proximity"><stop stop-color="#fff"/><stop offset=".35" stop-color="#ffe580"/><stop offset=".65" stop-color="#f5a149"/><stop offset="1" stop-color="#c74332"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#faf8f2"/>
  <rect x="22" y="22" width="1156" height="586" rx="12" fill="none" stroke="#d6dace" stroke-width="2"/>
  <rect x="600" y="70" width="540" height="462" rx="12" fill="#f0f2e9"/>
  <rect x="600" y="70" width="540" height="462" rx="12" fill="url(#dots)"/>
  <g fill="#c5cebc" stroke="#faf8f2" stroke-width=".8" stroke-linejoin="round">${countries}</g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#233d40">
    <circle cx="88" cy="101" r="22" fill="none" stroke="#233d40" stroke-width="3"/>
    <circle cx="88" cy="101" r="9" fill="none" stroke="#233d40" stroke-width="3"/>
    <text x="125" y="120" font-size="56" font-weight="700" letter-spacing="-3">roamfolio<tspan fill="#bd4939">.</tspan></text>
    <text x="66" y="202" font-size="14" font-weight="700" letter-spacing="2.5" fill="#566653">THE DAILY GEOGRAPHY GAME</text>
    <text x="63" y="282" font-size="55" font-weight="700" letter-spacing="-2">One world.</text>
    <text x="63" y="346" font-size="48" font-weight="700" letter-spacing="-2">One daily destination.</text>
    <text x="66" y="408" font-size="21" fill="#566653">Discover a country. Collect its story.</text>
    <rect x="66" y="457" width="264" height="47" rx="5" fill="#233d40"/>
    <text x="90" y="487" font-size="18" font-weight="700" fill="#faf8f2">Where shall we go? <tspan dx="12">↗</tspan></text>
    <text x="630" y="500" font-size="11" letter-spacing="2" fill="#566653">FARTHER</text>
    <rect x="712" y="489" width="260" height="10" rx="5" fill="url(#proximity)" stroke="#b5bfad"/>
    <text x="989" y="500" font-size="11" letter-spacing="2" fill="#566653">CLOSER</text>
    <path d="M66 548H1134" stroke="#d6dace"/>
    <text x="66" y="580" font-size="14" fill="#566653">A new mystery country every day. Unlimited guesses.</text>
    <text x="1134" y="580" text-anchor="end" font-size="12" fill="#566653">Map data: Natural Earth</text>
  </g>
</svg>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${artwork}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const output = new URL('../../public/social-preview.v1.png', import.meta.url);
  await mkdir(new URL('../../public/', import.meta.url), { recursive: true });
  await page.screenshot({ path: output.pathname, type: 'png' });
  console.log('Generated public/social-preview.v1.png (1200 × 630).');
} finally {
  await browser.close();
}
