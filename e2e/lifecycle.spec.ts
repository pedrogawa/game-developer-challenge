import { advanceGame, configureGame, expect, finishByTime, gameState, holdKey, saveResult, startGame, test } from './fixtures';

test.beforeEach(async ({ openApp, page }) => {
  await openApp();
  await startGame(page);
});

test('ends by time, freezes the simulation and restarts cleanly', async ({ page }) => {
  await configureGame(page, { player: { x: 600, y: 350 }, enemies: [], score: 4, timeRemaining: 0.05, spawnCooldown: 999 });
  await advanceGame(page, 100);
  await expect(page.getByRole('heading', { name: 'Battle Complete' })).toBeVisible();
  await expect(page.getByLabel('4 points')).toBeVisible();
  const finished = await gameState(page);
  expect(finished.endReason).toBe('time');
  await advanceGame(page, 5_000);
  expect((await gameState(page)).timeRemaining).toBe(finished.timeRemaining);

  await saveResult(page);
  await expect(page.getByText('Match saved')).toBeVisible();
  await page.getByRole('button', { name: 'Play Again' }).click();
  await expect(page.getByRole('heading', { name: 'Loading the fleet…' })).toBeHidden({ timeout: 15_000 });
  await expect.poll(() => gameState(page).then(({ score }) => score)).toBe(0);
  const restarted = await gameState(page);
  expect(restarted.player.health).toBe(restarted.player.maxHealth);
  expect(restarted.gameOver).toBe(false);
});

test('ends by death and cannot continue moving', async ({ page }) => {
  await configureGame(page, {
    player: { x: 600, y: 350, angle: 0, health: 1 },
    enemies: [{ kind: 'chaser', x: 600, y: 375, angle: 0 }],
    spawnCooldown: 999,
  });
  const sunk = await advanceGame(page, 20);
  expect(sunk.gameOver).toBe(true);
  expect(sunk.endReason).toBe('sunk');
  await expect(page.getByText('Ship Sunk')).toBeVisible();
  const afterInput = await holdKey(page, 'w', 1_000);
  expect(afterInput.player.x).toBe(sunk.player.x);
  expect(afterInput.player.y).toBe(sunk.player.y);
});

test('pauses explicitly and on focus loss without skipping time', async ({ page }) => {
  await configureGame(page, { enemies: [], timeRemaining: 45, spawnCooldown: 999 });
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await advanceGame(page, 10_000);
  expect((await gameState(page)).timeRemaining).toBe(45);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(() => gameState(page).then(({ paused }) => paused)).toBe(false);
  await advanceGame(page, 1_000);
  expect((await gameState(page)).timeRemaining).toBeCloseTo(44, 4);

  await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  const pausedAt = (await gameState(page)).timeRemaining;
  await advanceGame(page, 3_000);
  expect((await gameState(page)).timeRemaining).toBe(pausedAt);
});

test('shows and persists the completed result across refresh', async ({ page }) => {
  await configureGame(page, { score: 12 });
  await finishByTime(page);
  await expect(page.getByLabel('12 points')).toBeVisible();
  await saveResult(page, 'Twelve Seas');
  await expect(page.getByText('Match saved')).toBeVisible();
  const savedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle-last-match-v1') ?? 'null'));
  expect(savedBefore.score).toBe(12);
  expect(savedBefore.endReason).toBe('time');
  expect(savedBefore.playerName).toBe('Twelve Seas');

  await page.reload();
  await expect(page.getByRole('img', { name: 'Pirate Battle' })).toBeVisible();
  const savedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('pirate-battle-last-match-v1') ?? 'null'));
  expect(savedAfter).toEqual(savedBefore);
});

test('abandons a battle and starts the next one without leaking state', async ({ page }) => {
  await configureGame(page, { score: 7, player: { health: 41 } });
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expect(page.getByRole('img', { name: 'Pirate Battle' })).toBeVisible();
  await startGame(page);
  const next = await gameState(page);
  expect(next.score).toBe(0);
  expect(next.player.health).toBe(next.player.maxHealth);
});
