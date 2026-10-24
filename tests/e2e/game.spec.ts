import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pool from '../../data/countries/pool.v1.json' with { type: 'json' };
import schedule from '../../data/schedules/schedule.v1.json' with { type: 'json' };

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
