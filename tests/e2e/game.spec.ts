import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pool from '../../data/countries/pool.v2.json' with { type: 'json' };
import schedule from '../../data/schedules/schedule.v1.json' with { type: 'json' };
import distances from '../../data/geography/distances.v2.json' with { type: 'json' };

const date = '2026-10-24';
const targetId = schedule.assignments[date];
const target = pool.find(country => country.id === targetId)!;
const wrong = pool.find(country => country.id !== targetId)!;
async function guess(page: Page, name: string) {
  await page.getByRole('combobox').fill(name);
  await page.getByRole('button', { name: 'Guess', exact: false }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${date}T12:00:00Z`) });
});

test('link previews work without JavaScript and advertise a reachable PNG', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Roamfolio/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /mystery country/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://roam-folio.com/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://roam-folio.com/');
    const image = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!);
    expect(image.href).toBe('https://roam-folio.com/social-preview.v1.png');
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image.href);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const response = await request.get(image.pathname);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeLessThan(1_000_000);
  } finally { await context.close(); }
});

test('country entry and submit are above the fold, including a small phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Guess', exact: false })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.intro')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByRole('combobox')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Guess', exact: false })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('entry sits immediately above the map and guess results follow it', async ({ page }) => {
  await page.goto('/');
  const checkOrder = async () => {
    const entry = (await page.locator('.input-row').boundingBox())!;
    const map = (await page.locator('.map-canvas').boundingBox())!;
    expect(Math.abs(map.y - entry.y - entry.height)).toBeLessThan(1);
    await expect(page.locator('.input-hint')).toHaveCount(0);
  };
  await checkOrder();
  await guess(page, wrong.name);
  const map = (await page.locator('.map-panel').boundingBox())!;
  const result = (await page.locator('.latest-feedback').boundingBox())!;
  expect(result.y).toBeGreaterThanOrEqual(map.y + map.height);
  await checkOrder();
  await page.setViewportSize({ width: 320, height: 568 });
  await checkOrder();
  const canvas = (await page.locator('.map-canvas').boundingBox())!;
  expect(canvas.height).toBeGreaterThanOrEqual(360);
  // The actual geography fills the taller viewport rather than letterboxing.
  const svgScale = await page.locator('.map-canvas svg').evaluate(element => (element as SVGSVGElement).getScreenCTM()!.a);
  expect(svgScale).toBeCloseTo(canvas.height / 530, 3);
});

test('history sorts by exact distance while persistence and sharing retain guess order', async ({ page }) => {
  const candidates = pool.filter(country => country.id !== targetId).map(country => {
    const key = [country.id, targetId].sort().join(':') as keyof typeof distances.pairs;
    return { ...country, ...distances.pairs[key] };
  }).sort((a, b) => a.meters - b.meters);
  const nearest = candidates[0], farthest = candidates.at(-1)!;
  const middle = candidates[Math.floor(candidates.length / 2)];
  // Include two land neighbors so stable zero-distance ties are exercised.
  const neighbor = candidates.find(country => country.id !== nearest.id && country.meters === nearest.meters)!;
  expect(neighbor).toBeDefined();
  const entered = [farthest, nearest, middle, neighbor];
  const ordered = [nearest, neighbor, middle, farthest];
  const names = page.locator('.guess-country strong');
  await page.goto('/');
  for (const country of entered) await guess(page, country.name);
  await expect(names).toHaveText(ordered.map(country => country.name));
  await expect(page.locator('.guess-number')).toHaveText(['02', '04', '03', '01']);
  await page.reload();
  await expect(names).toHaveText(ordered.map(country => country.name));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith('roamfolio:progress:'))!)!).guesses);
  expect(saved).toEqual(entered.map(country => country.id));
  await guess(page, target.name);
  await expect(names).toHaveText([target, ...ordered].map(country => country.name));
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Share your journey' }).click();
  const emoji = (meters: number) => meters / 1609.344 <= 250 ? '🟥' : meters / 1609.344 <= 1000 ? '🟧' : meters / 1609.344 <= 3000 ? '🟨' : '⬜';
  await expect(page.getByLabel('Your spoiler-free result')).toHaveValue(new RegExp(entered.map(country => emoji(country.meters)).join('') + '🎯'));
});

test('a tall mobile map can pan to both sides at the initial zoom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const map = page.locator('.map-canvas svg');
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const drag = async (offset: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + offset, y, { steps: 5 });
    await page.mouse.up();
  };
  await drag(90);
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', /translate\([1-9]/);
  await page.getByRole('button', { name: 'Reset map', exact: true }).click();
  await drag(-90);
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', /translate\(-/);
  await expect(page.getByLabel('Map zoom level')).toHaveText('100%');
  await expect(page.locator('.guess-list li')).toHaveCount(0);
});

test('map controls, keyboard, wheel and drag navigate without submitting guesses', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('region', { name: 'Map navigation', exact: true });
  const layer = page.locator('.map-countries');
  await expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(layer).toHaveAttribute('transform', /scale\(1.5\)/);
  await navigation.focus();
  const beforeKey = await layer.getAttribute('transform');
  await navigation.press('ArrowRight');
  expect(await layer.getAttribute('transform')).not.toBe(beforeKey);
  await navigation.press('+');
  await expect(layer).toHaveAttribute('transform', /scale\(2.25\)/);
  const map = page.locator('.map-canvas svg');
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const beforeDrag = await layer.getAttribute('transform');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y + 25, { steps: 5 });
  await page.mouse.up();
  expect(await layer.getAttribute('transform')).not.toBe(beforeDrag);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const beforeWheel = await layer.getAttribute('transform');
  await page.mouse.wheel(0, -180);
  await expect(layer).not.toHaveAttribute('transform', beforeWheel!);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.getByRole('button', { name: 'Reset map', exact: true }).click();
  await expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await expect(page.locator('.guess-list li')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveValue('');
});

test('touch gestures pinch and pan the map without scrolling the page', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('.map-canvas svg');
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const touch = (type: string, points: { x: number; y: number; id: number }[]) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await touch('touchStart', [{ x: x - 25, y, id: 0 }, { x: x + 25, y, id: 1 }]);
  await touch('touchMove', [{ x: x - 65, y, id: 0 }, { x: x + 65, y, id: 1 }]);
  await touch('touchEnd', []);
  const layer = page.locator('.map-countries');
  await expect(layer).not.toHaveAttribute('transform', 'translate(0 0) scale(1)');
  const beforePan = await layer.getAttribute('transform');
  await touch('touchStart', [{ x, y, id: 0 }]);
  await touch('touchMove', [{ x: x + 30, y: y + 20, id: 0 }]);
  await touch('touchEnd', []);
  await expect(layer).not.toHaveAttribute('transform', beforePan!);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(page.locator('.guess-list li')).toHaveCount(0);
  await client.detach();
});

test('map hover never labels countries, including guessed countries', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.map-countries path').first()).toBeAttached();
  await page.locator('.map-canvas svg').hover();
  await expect(page.locator('.map-canvas title, .map-canvas [title]')).toHaveCount(0);
  expect(await page.locator('.map-countries').textContent()).toBe('');
  await guess(page, wrong.name);
  await page.locator('.map-canvas svg').hover();
  await expect(page.locator('.map-canvas title, .map-canvas [title]')).toHaveCount(0);
  expect(await page.locator('.map-countries').textContent()).toBe('');
});

test('more detailed boundaries load only on zoom and support 32x magnification', async ({ page }) => {
  const detailRequests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/world.detail.v1.geojson')) detailRequests.push(request.url()); });
  await page.goto('/');
  const paths = page.locator('.map-countries path');
  await expect(paths.first()).toBeAttached();
  const drawingLength = () => paths.evaluateAll(elements => elements.reduce((sum, element) => sum + (element.getAttribute('d')?.length ?? 0), 0));
  const overviewLength = await drawingLength();
  expect(detailRequests).toHaveLength(0);
  const zoomIn = page.getByRole('button', { name: 'Zoom in', exact: true });
  const response = page.waitForResponse(response => response.url().endsWith('/world.detail.v1.geojson'));
  for (let i = 0; i < 3; i++) await zoomIn.click();
  expect((await response).ok()).toBe(true);
  await expect.poll(drawingLength).toBeGreaterThan(overviewLength * 2);
  for (let i = 0; i < 12 && await zoomIn.isEnabled(); i++) await zoomIn.click();
  await expect(page.getByLabel('Map zoom level')).toHaveText('3200%');
  await expect(zoomIn).toBeDisabled();
  await page.getByRole('button', { name: 'Reset map', exact: true }).click();
  await expect(page.getByLabel('Map zoom level')).toHaveText('100%');
  for (let i = 0; i < 3; i++) await zoomIn.click();
  await expect.poll(drawingLength).toBeGreaterThan(overviewLength * 2);
  expect(detailRequests).toHaveLength(1);
  await expect(page.locator('.guess-list li')).toHaveCount(0);
});

test('overview stays usable when detail fails, and detail can be retried', async ({ page }) => {
  await page.route('**/world.detail.v1.geojson', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('.map-countries path').first()).toBeAttached();
  const paths = page.locator('.map-countries path');
  const drawingLength = () => paths.evaluateAll(elements => elements.reduce((sum, element) => sum + (element.getAttribute('d')?.length ?? 0), 0));
  const overviewLength = await drawingLength();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry map detail' })).toBeVisible();
  expect(await drawingLength()).toBe(overviewLength);
  await page.unroute('**/world.detail.v1.geojson');
  await page.getByRole('button', { name: 'Retry map detail' }).click();
  await expect.poll(drawingLength).toBeGreaterThan(overviewLength * 2);
  await expect(page.getByRole('button', { name: 'Retry map detail' })).toHaveCount(0);
});

test('typed guesses persist; duplicate guesses and map clicks never increase count', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const discoveryRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/data/discovery/')) discoveryRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'World map', exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toHaveCount(0);
  expect(discoveryRequests).toEqual([]);
  await guess(page, wrong.name);
  await expect(page.getByRole('img', { name: /showing 1 guessed country/ })).toBeVisible();
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await guess(page, wrong.name);
  await expect(page.locator('.latest-feedback')).toContainText('already guessed');
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await page.locator('.map-canvas svg').click({ position: { x: 80, y: 60 } });
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await expect(page.getByRole('combobox')).toHaveValue('');
  await page.reload();
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toHaveCount(0);
  expect(discoveryRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('Chad aliases are accepted alongside existing saved progress', async ({ page }) => {
  await page.addInitScript(({ date, id }) => {
    const identity = `schedule-v1:pool-v1:natural-earth-5.1.1-policy-1:${date}`;
    const key = `roamfolio:progress:v1:${identity}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schema: 1, identity, guesses: [id], completed: false }));
  }, { date, id: wrong.id });
  await page.goto('/');
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await expect(page.getByRole('combobox')).toBeVisible();
  await guess(page, 'Republic of Chad');
  await expect(page.locator('.guess-list li')).toHaveCount(2);
  await expect(page.locator('.guess-country strong')).toContainText(['Chad']);
  await expect(page.locator('.latest-feedback')).toContainText('Chad.');
  await guess(page, 'Chad');
  await expect(page.locator('.guess-list li')).toHaveCount(2);
  await expect(page.locator('.latest-feedback')).toContainText('already guessed Chad');
  await page.reload();
  await expect(page.locator('.guess-list li')).toHaveCount(2);
  await expect(page.locator('.guess-country strong')).toContainText(['Chad']);
});

test('a future Chad puzzle reveals its sourced discovery only after solving', async ({ page }) => {
  const chadDate = Object.entries(schedule.assignments).find(([, id]) => id === 'TCD')![0];
  await page.clock.setSystemTime(new Date(`${chadDate}T12:00:00Z`));
  const requests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/discovery/TCD.json')) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.postcard')).toHaveCount(0);
  expect(requests).toEqual([]);
  await guess(page, 'Republic of Chad');
  await expect(page.locator('.postcard h2')).toHaveText('Chad');
  await expect(page.locator('.country-facts li')).toHaveCount(3);
  await expect(page.locator('.postcard h4')).toHaveText('Boule');
  await expect(page.locator('.postcard-content a.source-link')).toHaveCount(5);
  expect(requests.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('.postcard h2')).toHaveText('Chad');
});

test('keyboard users solve, unlock a sourced postcard and share without spoilers', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('combobox');
  await input.fill(target.name);
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await input.press('Enter');
  await expect(page.locator('.guess-list li')).toHaveCount(0);
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toBeVisible();
  await expect(page.locator('.country-facts li')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'A taste of the country' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.locator('.next-puzzle strong')).toHaveText(/\d{2}:\d{2}:\d{2}/);
  await expect(page.locator('.next-puzzle')).toContainText('Resets at midnight UTC');
  // Avoid a native system share sheet so the copyable browser fallback is tested.
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Share your journey' }).click();
  await expect(page.getByLabel('Your spoiler-free result')).toHaveValue(/2026-10-24 UTC/);
  expect(await page.getByLabel('Your spoiler-free result').inputValue()).not.toContain(target.name);
  await page.reload();
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toBeVisible();
  await expect(page.locator('.country-facts li')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /give up/i })).toHaveCount(0);
});

test('a new UTC day clears active guesses and completion', async ({ page }) => {
  await page.clock.setSystemTime(new Date(`${date}T23:59:00Z`));
  await page.goto('/');
  await guess(page, target.name);
  await expect(page.locator('.success-panel')).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.locator('.guess-list li')).toHaveCount(0);
  await expect(page.locator('.postcard')).toHaveCount(0);
  await expect(page.locator('.daily-label')).toContainText('October 25');
});

test('timezone setting cannot change the daily target or progress identity', async ({ browser }) => {
  const contexts = await Promise.all(['Pacific/Honolulu', 'Pacific/Kiritimati'].map(timezoneId => browser.newContext({ timezoneId })));
  const identities: string[] = [];
  for (const context of contexts) {
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-24T23:59:00Z') });
    await page.goto('/');
    await guess(page, target.name);
    await expect(page.locator('.success-panel')).toContainText(target.name);
    identities.push(await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('roamfolio:progress:'))!));
    await context.close();
  }
  expect(identities[0]).toBe(identities[1]);
});

test('unknown input and denied storage keep play accessible without layout overflow', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } }));
  await page.goto('/');
  await expect(page.locator('.storage-warning')).toBeVisible();
  await guess(page, 'Atlantis');
  await expect(page.getByRole('alert')).toContainText('Choose a country');
  await expect(page.locator('.guess-list li')).toHaveCount(0);
  await guess(page, wrong.name);
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('unpublished date shows unavailable without inventing a target', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2040-01-01T12:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today’s journey isn’t available yet.' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('initial and solved views pass automated WCAG AA checks', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'World map', exact: false })).toBeVisible();
  const scan = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const initial = await scan();
  expect(initial.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('first-playable.png'), fullPage: true });
  await guess(page, target.name);
  await expect(page.locator('.country-facts li')).toHaveCount(3);
  const solved = await scan();
  expect(solved.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('solved.png'), fullPage: true });
});
