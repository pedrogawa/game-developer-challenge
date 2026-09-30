import { expect, test as base, type Page } from '@playwright/test';

type Scenario =
  | 'success'
  | 'empty'
  | 'multiple-pages'
  | 'slow'
  | 'out-of-order'
  | 'timeout'
  | 'ranking-error'
  | 'history-error'
  | 'post-commit-timeout'
  | 'offline-at-finish';

export type TestGameState = {
  player: { x: number; y: number; angle: number; health: number; maxHealth: number; fireCooldown: number; fireCooldownDuration: number; alive: boolean };
  enemies: Array<{ id: number; kind: 'chaser' | 'shooter'; x: number; y: number; angle: number; health: number; alive: boolean }>;
  projectiles: Array<{ id: number; owner: 'player' | 'enemy'; x: number; y: number }>;
  effects: Array<{ id: number; kind: 'muzzle' | 'explosion' | 'hit'; x: number; y: number }>;
  score: number;
  timeRemaining: number;
  spawnCooldown: number;
  paused: boolean;
  gameOver: boolean;
  endReason: 'sunk' | 'time' | null;
};

export const test = base.extend<{ openApp: (scenario?: Scenario) => Promise<void> }>({
  openApp: async ({ page }, provide) => {
    const openApp = async (scenario: Scenario = 'success') => {
      await page.addInitScript(({ selectedScenario }) => {
        if (sessionStorage.getItem('pirate-battle-e2e-initialized') !== '1') {
          localStorage.clear();
          localStorage.setItem('pirate-battle-player-v1', JSON.stringify({ id: 'e2e-captain', name: 'E2E Captain' }));
          localStorage.setItem('pirate-battle-mock-scenario-v1', JSON.stringify({ id: selectedScenario, seed: 1337 }));
          sessionStorage.setItem('pirate-battle-e2e-initialized', '1');
        }
      }, { selectedScenario: scenario });
      await page.goto('/?e2e=1&seed=1337');
      await expect(page.getByRole('img', { name: 'Pirate Battle' })).toBeVisible();
    };
    await provide(openApp);
  },
});

export { expect };

const unexpectedBrowserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  unexpectedBrowserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = unexpectedBrowserErrors.get(page) ?? [];
  const expectedConsoleErrors = testInfo.title === 'recovers an offline submission after refresh'
    ? ['console.error: Failed to load resource: net::ERR_FAILED']
    : testInfo.title === 'renders empty and error states with retry'
      ? ['console.error: Failed to load resource: the server responded with a status of 503 (Service Unavailable)']
      : [];
  const relevantErrors = errors.filter((error) => !expectedConsoleErrors.includes(error));

  expect(relevantErrors, 'browser console and page errors').toEqual([]);
});

export const startGame = async (page: Page) => {
  const touchPortrait = await page.evaluate(() => navigator.maxTouchPoints > 0 && innerHeight > innerWidth);
  if (touchPortrait) await page.setViewportSize({ width: 915, height: 412 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Loading the fleet…' })).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.__PIRATE_BATTLE_TEST__))).toBe(true);
};

export const gameState = (page: Page) => page.evaluate(() => window.__PIRATE_BATTLE_TEST__!.getState()) as Promise<TestGameState>;

export const configureGame = (page: Page, setup: object) =>
  page.evaluate((value) => window.__PIRATE_BATTLE_TEST__!.configure(value), setup) as Promise<TestGameState>;

export const advanceGame = (page: Page, milliseconds: number) =>
  page.evaluate((value) => window.__PIRATE_BATTLE_TEST__!.advance(value), milliseconds) as Promise<TestGameState>;

export const holdKey = async (page: Page, key: string, milliseconds: number) => {
  await page.keyboard.down(key);
  const state = await advanceGame(page, milliseconds);
  await page.keyboard.up(key);
  return state;
};

export const finishByTime = async (page: Page) => {
  await configureGame(page, { timeRemaining: 0.05, enemies: [], spawnCooldown: 999 });
  await advanceGame(page, 100);
  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
};

export const saveResult = async (page: Page, name = 'E2E Captain') => {
  await page.getByLabel('Captain name').fill(name);
  await page.getByRole('button', { name: 'Save Score' }).click();
};

export const setScenario = async (page: Page, id: Scenario) => {
  await page.getByRole('button', { name: 'Network scenarios' }).click();
  await page.locator('.network-field select').selectOption(id);
  await page.getByRole('button', { name: 'Apply' }).click();
};
