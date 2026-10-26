import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pool from '../../data/countries/pool.v3.json' with { type: 'json' };
import schedule from '../../data/schedules/schedule.v1.json' with { type: 'json' };
import distances from '../../data/geography/distances.v3.json' with { type: 'json' };

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
  await expect(page.getByText('Your world of possibilities', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map controls' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Zoom in|Zoom out|Reset map)$/ })).toHaveCount(0);
  await expect(page.getByLabel('Map zoom level')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByRole('combobox')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Guess', exact: false })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const submit of ['button', 'Enter'] as const) {
  test(`${submit} submission releases touch input focus and preserves desktop focus`, async ({ page, isMobile }) => {
    await page.goto('/');
    const input = page.getByRole('combobox');
    await input.fill(wrong.name);
    await expect(input).toBeFocused();
    if (submit === 'button') await page.getByRole('button', { name: 'Guess', exact: false }).click();
    else await input.press('Enter');
    await expect(page.locator('.guess-list li')).toHaveCount(1);
    await expect(input).toHaveValue('');
    if (isMobile) await expect(input).not.toBeFocused();
    else await expect(input).toBeFocused();
    // The next guess remains available after dismissing the keyboard.
    await input.fill(wrong.name);
    await expect(input).toBeFocused();
  });
}

test('entry and latest guess notice sit above the map without an initial helper line', async ({ page }) => {
  await page.goto('/');
  const checkOrder = async () => {
    const entry = (await page.locator('.input-row').boundingBox())!;
    const map = (await page.locator('.map-canvas').boundingBox())!;
    const notice = page.locator('.latest-feedback');
    if (await notice.count()) {
      const result = (await notice.boundingBox())!;
      expect(result.y).toBeGreaterThanOrEqual(entry.y + entry.height);
      expect(map.y).toBeGreaterThanOrEqual(result.y + result.height);
      expect(result.y - entry.y - entry.height).toBeLessThanOrEqual(12);
    } else expect(Math.abs(map.y - entry.y - entry.height)).toBeLessThan(1);
    await expect(page.locator('.input-hint')).toHaveCount(0);
  };
  await checkOrder();
  await guess(page, wrong.name);
  await checkOrder();
  await page.setViewportSize({ width: 320, height: 568 });
  await checkOrder();
  const canvas = (await page.locator('.map-canvas').boundingBox())!;
  expect(canvas.height).toBeGreaterThanOrEqual(360);
  // The actual geography fills the taller viewport rather than letterboxing.
  const svgScale = await page.locator('.map-canvas svg').evaluate(element => (element as SVGSVGElement).getScreenCTM()!.a);
  expect(svgScale).toBeCloseTo(canvas.height / 530, 3);
});

test('latest notice compares with the best earlier guess and survives reloads', async ({ page }, testInfo) => {
  const candidates = pool.filter(country => country.id !== targetId).map(country => {
    const key = [country.id, targetId].sort().join(':') as keyof typeof distances.pairs;
    return { ...country, ...distances.pairs[key] };
  }).sort((a, b) => a.meters - b.meters);
  const nearest = candidates[0], farthest = candidates.at(-1)!;
  const middle = candidates[Math.floor(candidates.length / 2)];
  const neighbor = candidates.find(country => country.id !== nearest.id && country.meters === nearest.meters)!;
  const notice = page.locator('.latest-feedback');
  await page.goto('/');
  await expect(notice).toHaveCount(0);
  await guess(page, farthest.name);
  await expect(notice).toContainText(`${farthest.name}.`);
  await expect(notice).toContainText(`${Math.round(farthest.meters / 1609.344).toLocaleString('en-US')} miles away.`);
  await expect(notice).not.toContainText(/closer|farther|matches/i);
  await page.reload();
  await expect(notice).toContainText(`${farthest.name}.`);
  await expect(notice).not.toContainText(/closer|farther|matches/i);
  await guess(page, nearest.name);
  await expect(notice).toContainText('0 miles away. It borders this country!');
  await expect(notice).toContainText('Closer than your previous closest guess.');
  await guess(page, middle.name);
  await expect(notice).toContainText('Farther away than your closest guess so far.');
  await page.reload();
  await expect(notice).toContainText(`${middle.name}.`);
  await expect(notice).toContainText('Farther away than your closest guess so far.');
  await guess(page, neighbor.name);
  await expect(notice).toContainText('Matches your closest guess so far.');
  await guess(page, farthest.name);
  await expect(notice).toContainText(`already guessed ${farthest.name}`);
  await expect(notice).toContainText('Farther away than your closest guess so far.');
  await expect(page.locator('.guess-list li')).toHaveCount(4);
  await guess(page, nearest.name);
  await expect(notice).toContainText('Matches your closest guess so far.');
  await guess(page, 'Atlantis');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(notice).toContainText(`already guessed ${nearest.name}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('guess-notice.png'), fullPage: true });
  await guess(page, target.name);
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.success-panel')).toBeVisible();
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
  await page.getByRole('region', { name: 'Map navigation', exact: true }).press('0');
  await drag(-90);
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', /translate\(-/);
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', /scale\(1\)/);
  await expect(page.locator('.guess-list li')).toHaveCount(0);
});

test('keyboard, wheel and drag navigate without submitting guesses', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('region', { name: 'Map navigation', exact: true });
  const layer = page.locator('.map-countries');
  await expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  await navigation.press('+');
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
  await navigation.press('Home');
  await expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  await navigation.press('-');
  await expect(layer).toHaveAttribute('transform', 'translate(0 0) scale(1)');
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
  const navigation = page.getByRole('region', { name: 'Map navigation', exact: true });
  const response = page.waitForResponse(response => response.url().endsWith('/world.detail.v1.geojson'));
  for (let i = 0; i < 3; i++) await navigation.press('+');
  expect((await response).ok()).toBe(true);
  await expect.poll(drawingLength).toBeGreaterThan(overviewLength * 2);
  for (let i = 0; i < 12; i++) await navigation.press('+');
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', /scale\(32\)/);
  await navigation.press('0');
  await expect(page.locator('.map-countries')).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  for (let i = 0; i < 3; i++) await navigation.press('+');
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
  for (let i = 0; i < 3; i++) await page.getByRole('region', { name: 'Map navigation', exact: true }).press('+');
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

test('guess-only countries offer suggestions, distance feedback, map color and saved progress', async ({ page }) => {
  const beninDate = Object.entries(schedule.assignments).find(([, id]) => id === 'BEN')![0];
  await page.clock.setSystemTime(new Date(`${beninDate}T12:00:00Z`));
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/discovery/')) requests.push(request.url()); });
  await page.goto('/');
  await page.getByRole('combobox').fill('Burkina');
  await expect(page.getByRole('option', { name: 'Burkina Faso' })).toBeVisible();
  await page.getByRole('combobox').press('Escape');
  await guess(page, 'Burkina Faso');
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await expect(page.locator('.latest-feedback')).toContainText('0 miles');
  await expect(page.locator('.latest-feedback')).toContainText('It borders this country');
  await expect(page.locator('.map-countries path[stroke="#253c3e"]').first()).toHaveAttribute('fill', /rgb/);
  await expect(page.locator('.postcard')).toHaveCount(0);
  expect(requests).toEqual([]);
  await guess(page, 'Burkina Faso');
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await guess(page, 'Vanuatu');
  await expect(page.locator('.guess-list li')).toHaveCount(2);
  await expect(page.locator('.latest-feedback')).toContainText(/Vanuatu.+miles/);
  await page.reload();
  await expect(page.locator('.guess-list li')).toHaveCount(2);
  await expect(page.locator('.guess-country strong')).toContainText(['Burkina Faso', 'Vanuatu']);
  expect(requests).toEqual([]);
  await guess(page, 'Benin');
  await expect(page.locator('.postcard h2')).toHaveText('Benin');
});

for (const country of pool.slice(126).filter(country => country.answerEligible)) {
  test(`new answer ${country.name} unlocks a sourced postcard only after solving`, async ({ page }) => {
    const answerDate = Object.entries(schedule.assignments).find(([, id]) => id === country.id)![0];
    await page.clock.setSystemTime(new Date(`${answerDate}T12:00:00Z`));
    const requests: string[] = [];
    page.on('request', request => { if (request.url().includes('/discovery/')) requests.push(request.url()); });
    await page.goto('/');
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.locator('.postcard')).toHaveCount(0);
    expect(requests).toEqual([]);
    await guess(page, country.name);
    await expect(page.locator('.postcard h2')).toHaveText(country.name);
    await expect(page.locator('.country-facts li')).toHaveCount(3);
    await expect(page.locator('.postcard-content a.source-link')).toHaveCount(5);
    expect(requests.some(url => url.endsWith(`/discovery/${country.id}.json`))).toBe(true);
    await page.reload();
    await expect(page.locator('.postcard h2')).toHaveText(country.name);
    await expect(page.locator('.guess-list li')).toHaveCount(1);
  });
}

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
  await expect(page.locator('.next-puzzle')).toContainText('Resets at midnight local time');
  // Avoid a native system share sheet so the copyable browser fallback is tested.
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Share your journey' }).click();
  await expect(page.getByLabel('Your spoiler-free result')).toHaveValue(/Roamfolio · 2026-10-24\n/);
  expect(await page.getByLabel('Your spoiler-free result').inputValue()).not.toContain(target.name);
  await page.reload();
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toBeVisible();
  await expect(page.locator('.country-facts li')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /give up/i })).toHaveCount(0);
});

test('solving opens a focused modal that can close, reopen, and restore after reload', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.style.overflow);
  await guess(page, target.name);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(`You’ve arrived in ${target.name}!`);
  await expect(dialog.locator('.success-panel')).toContainText('DESTINATION DISCOVERED');
  await expect(dialog.locator('#completion-heading')).toBeFocused();
  await expect(dialog.locator('.country-facts li')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  // Native modal behavior makes the underlying game inert to focus and clicks.
  await page.locator('.help-button').evaluate(element => (element as HTMLButtonElement).focus());
  await expect(dialog.locator('#completion-heading')).toBeFocused();
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  // A scrollable native dialog can itself be a Tab stop before its controls.
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Share your journey' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const reopen = page.getByRole('button', { name: 'View your postcard' });
  await expect(reopen).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe(overflow);
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await reopen.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#completion-heading')).toBeFocused();
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.postcard h2')).toHaveText(target.name);
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reopen).toBeFocused();
});

test('average guesses includes earlier saves and stays consistent across sharing, reloads, and midnight', async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-24T23:59:00Z'));
  await page.goto('/');
  const previousDate = '2026-10-23';
  const previousTarget = schedule.assignments[previousDate];
  const previousGuesses = [...pool.filter(country => country.id !== previousTarget).slice(0, 2).map(country => country.id), previousTarget];
  const era = schedule.eras.find(era => previousDate >= era.startsOn && previousDate <= era.endsOn)!;
  const identity = `${schedule.version}:${era.poolVersion}:${era.geographyVersion}:${previousDate}`;
  await page.evaluate(({ identity, guesses }) => {
    localStorage.setItem(`roamfolio:progress:v1:${identity}`, JSON.stringify({ schema: 1, identity, guesses, completed: true }));
  }, { identity, guesses: previousGuesses });
  await page.reload();
  await expect(page.locator('.postcard-statistic')).toHaveCount(0);
  await guess(page, wrong.name);
  await guess(page, wrong.name); // Repeated guesses do not change the average.
  await guess(page, target.name);
  const statistic = page.locator('.postcard-statistic');
  await expect(statistic).toContainText('Your average: 2.5 guesses per solve');
  await expect(statistic).toContainText('Across 2 solved puzzles in this browser');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'View your postcard' }).click();
  await expect(statistic).toContainText('2.5 guesses per solve');
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Share your journey' }).click();
  const text = await page.getByLabel('Your spoiler-free result').inputValue();
  expect(text).toContain('\nAverage: 2.5 guesses per solve\nhttps://roam-folio.com/');
  expect(text).not.toContain(target.name);
  await page.reload();
  await expect(statistic).toContainText('2.5 guesses per solve');
  await expect(statistic).toContainText('Across 2 solved puzzles');
  await page.clock.fastForward(61_000);
  await expect(page.getByRole('combobox')).toBeVisible();
  const nextTarget = pool.find(country => country.id === schedule.assignments['2026-10-25'])!;
  await guess(page, nextTarget.name);
  await expect(statistic).toContainText('Your average: 2.0 guesses per solve');
  await expect(statistic).toContainText('Across 3 solved puzzles');
  await page.reload();
  await expect(statistic).toContainText('2.0 guesses per solve');
});

test('native sharing includes the same average as the postcard', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
    document.documentElement.dataset.sharedText = data.text;
  } }));
  await guess(page, target.name);
  await expect(page.locator('.postcard-statistic')).toContainText('Your average: 1.0 guesses per solve');
  await expect(page.locator('.postcard-statistic')).toContainText('Across 1 solved puzzle in this browser');
  await page.getByRole('button', { name: 'Share your journey' }).click();
  const text = await page.locator('html').getAttribute('data-shared-text');
  expect(text).toContain('\nAverage: 1.0 guesses per solve\nhttps://roam-folio.com/');
  expect(text).toBe(await page.getByLabel('Your spoiler-free result').inputValue());
});

test('completion modal fits a small phone and keeps the postcard and close button reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await guess(page, target.name);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog.locator('.country-facts li')).toHaveCount(3);
  await expect(dialog.locator('#completion-heading')).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('completion-modal-top.png') });
  await dialog.getByRole('link', { name: /Content credits and licenses/ }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('link', { name: /Content credits and licenses/ })).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('completion-modal-postcard.png') });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('a failed postcard can retry inside the completion modal without losing the win', async ({ page }) => {
  await page.route('**/data/discovery/*.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await guess(page, target.name);
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.success-panel')).toContainText('DESTINATION DISCOVERED');
  await expect(dialog.locator('.postcard')).toContainText('The postcard couldn’t load.');
  await page.unroute('**/data/discovery/*.json');
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(dialog.locator('.country-facts li')).toHaveCount(3);
  await expect(page.locator('.guess-list li')).toHaveCount(1);
  await expect(dialog).toBeVisible();
});

for (const timezoneId of ['UTC', 'America/Chicago', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
  test.describe(`local rollover in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test('midnight closes completion, unlocks the next puzzle, and preserves dated progress', async ({ page }) => {
      const midnight = await page.evaluate(() => new Date(2026, 9, 25).getTime());
      await page.clock.setSystemTime(midnight - 60_000);
      await page.goto('/');
      await expect(page.locator('.daily-label time')).toHaveAttribute('datetime', date);
      await expect(page.locator('.daily-label')).toContainText('Local time');
      await guess(page, target.name);
      await expect(page.locator('.success-panel')).toBeVisible();
      await expect(page.locator('.next-puzzle strong')).toHaveText('00:01:00');
      await expect(page.locator('.next-puzzle')).toContainText('midnight local time');
      await page.clock.fastForward(61_000);
      await expect(page.getByRole('combobox')).toBeVisible();
      await expect(page.locator('.guess-list li')).toHaveCount(0);
      await expect(page.locator('.postcard')).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'View your postcard' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
      await expect(page.locator('.daily-label')).toContainText('October 25');
      const nextTarget = pool.find(country => country.id === schedule.assignments['2026-10-25'])!;
      await guess(page, nextTarget.name);
      await expect(page.locator('.success-panel')).toContainText(nextTarget.name);
      await page.reload();
      await expect(page.locator('.success-panel')).toContainText(nextTarget.name);
      // Returning to the earlier date restores its completed progress under its original key.
      await page.clock.setSystemTime(midnight - 60_000);
      await page.reload();
      await expect(page.locator('.success-panel')).toContainText(target.name);
      await expect(page.locator('.guess-list li')).toHaveCount(1);
    });
    test('rechecks the local date before a guess and when a suspended tab resumes', async ({ page }) => {
      const midnight = await page.evaluate(() => new Date(2026, 9, 25).getTime());
      await page.clock.setSystemTime(midnight - 60_000);
      await page.goto('/');
      // Move the device clock without running the polling timer.
      await page.clock.setSystemTime(midnight);
      await guess(page, wrong.name);
      await expect(page.locator('.daily-label time')).toHaveAttribute('datetime', '2026-10-25');
      await expect(page.locator('.guess-list li')).toHaveCount(0);
      await guess(page, wrong.name);
      await expect(page.locator('.guess-list li')).toHaveCount(1);
      await page.clock.setSystemTime(midnight - 60_000);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.locator('.daily-label time')).toHaveAttribute('datetime', date);
      await expect(page.locator('.guess-list li')).toHaveCount(0);
    });
  });
}

test('countdown handles both daylight saving transitions', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/New_York' });
  try {
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-03-08T00:00:00-05:00') });
    for (const [date, instant, countdown] of [
      ['2026-03-08', '2026-03-08T00:00:00-05:00', '23:00:00'],
      ['2026-11-01', '2026-11-01T00:00:00-04:00', '25:00:00'],
    ]) {
      await page.clock.setSystemTime(new Date(instant));
      await page.goto('/');
      const targetId = (schedule.assignments as Record<string, string>)[date];
      await guess(page, pool.find(country => country.id === targetId)!.name);
      await expect(page.locator('.next-puzzle strong')).toHaveText(countdown);
    }
  } finally { await context.close(); }
});

test('the same local calendar date shares a target and progress identity across time zones', async ({ browser }) => {
  const contexts = await Promise.all(['Pacific/Honolulu', 'Pacific/Kiritimati'].map(timezoneId => browser.newContext({ timezoneId })));
  const identities: string[] = [];
  for (const context of contexts) {
    const page = await context.newPage();
    const instant = await page.evaluate(() => new Date(2026, 9, 24, 12).getTime());
    await page.clock.install({ time: instant });
    await page.goto('/');
    await guess(page, target.name);
    await expect(page.locator('.success-panel')).toContainText(target.name);
    identities.push(await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('roamfolio:progress:'))!));
    await context.close();
  }
  expect(identities[0]).toBe(identities[1]);
});

test('different local dates at the same instant unlock different scheduled puzzles', async ({ browser }) => {
  for (const [timezoneId, localDate] of [
    ['Pacific/Honolulu', '2026-10-24'], ['Pacific/Kiritimati', '2026-10-25'],
  ]) {
    const context = await browser.newContext({ timezoneId });
    try {
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-10-24T23:59:00Z') });
      await page.goto('/');
      await expect(page.locator('.daily-label time')).toHaveAttribute('datetime', localDate);
      const targetId = (schedule.assignments as Record<string, string>)[localDate];
      const target = pool.find(country => country.id === targetId)!;
      await guess(page, target.name);
      await expect(page.locator('.success-panel')).toContainText(target.name);
      await page.reload();
      await expect(page.locator('.success-panel')).toContainText(target.name);
    } finally { await context.close(); }
  }
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
  await guess(page, target.name);
  await expect(page.locator('.postcard-statistic')).toContainText('Your average: 2.0 guesses per solve');
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Share your journey' }).click();
  await expect(page.getByLabel('Your spoiler-free result')).toHaveValue(/Average: 2\.0 guesses per solve/);
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
