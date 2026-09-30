import { advanceGame, configureGame, expect, gameState, holdKey, startGame, test } from './fixtures';

test.beforeEach(async ({ openApp, page }) => {
  await openApp();
  await startGame(page);
});

test('moves, rotates, respects arena limits and collides with islands', async ({ page }) => {
  await configureGame(page, { player: { x: 600, y: 340, angle: 0 }, enemies: [], spawnCooldown: 999 });
  const start = await gameState(page);
  const moved = await holdKey(page, 'w', 500);
  expect(moved.player.y).toBeLessThan(start.player.y);
  const rotated = await holdKey(page, 'a', 300);
  expect(rotated.player.angle).toBeLessThan(moved.player.angle);

  await configureGame(page, { player: { x: 600, y: 35, angle: 0 } });
  const bounded = await holdKey(page, 'w', 1_000);
  expect(bounded.player.y).toBeGreaterThanOrEqual(34);

  await configureGame(page, { player: { x: 350, y: 100, angle: -Math.PI / 2 } });
  const islandContact = await holdKey(page, 'w', 600);
  const blockedX = islandContact.player.x;
  const stillBlocked = await holdKey(page, 'w', 600);
  expect(blockedX).toBeGreaterThanOrEqual(331);
  expect(stillBlocked.player.x).toBeCloseTo(blockedX, 5);
});

test('fires front and broadside shots with cooldown and no duplicate score', async ({ page }) => {
  await configureGame(page, {
    player: { x: 600, y: 350, angle: 0, fireCooldown: 0 },
    enemies: [{ kind: 'chaser', x: 600, y: 220, health: 23, maxHealth: 45, angle: Math.PI }],
    spawnCooldown: 999,
  });
  await holdKey(page, 'Space', 250);
  const destroyed = await gameState(page);
  expect(destroyed.score).toBe(1);
  expect(destroyed.enemies).toHaveLength(0);
  await advanceGame(page, 500);
  expect((await gameState(page)).score).toBe(1);

  await configureGame(page, { player: { x: 600, y: 350, angle: 0, fireCooldown: 0 }, enemies: [], projectiles: [] });
  await page.keyboard.down('q');
  const broadside = await advanceGame(page, 10);
  await page.keyboard.up('q');
  expect(broadside.projectiles.filter(({ owner }) => owner === 'player')).toHaveLength(3);

  await configureGame(page, { player: { fireCooldown: 0 }, projectiles: [] });
  await page.keyboard.down('Space');
  const first = await advanceGame(page, 10);
  const cooling = await advanceGame(page, 200);
  const readyAgain = await advanceGame(page, 250);
  await page.keyboard.up('Space');
  expect(first.projectiles).toHaveLength(1);
  expect(cooling.projectiles).toHaveLength(1);
  expect(readyAgain.projectiles).toHaveLength(2);
});

test('runs Chaser, Shooter and seeded spawn interval rules', async ({ page }) => {
  await configureGame(page, {
    player: { x: 600, y: 350, health: 100 },
    enemies: [{ kind: 'chaser', x: 600, y: 390, angle: 0 }],
    projectiles: [],
    spawnCooldown: 999,
  });
  const chaser = await advanceGame(page, 100);
  expect(chaser.player.health).toBeLessThan(100);
  expect(chaser.enemies).toHaveLength(0);
  expect(chaser.effects.filter(({ kind }) => kind === 'explosion')).toHaveLength(1);
  expect(chaser.effects.filter(({ kind }) => kind === 'hit')).toHaveLength(0);

  await configureGame(page, {
    player: { x: 600, y: 350 },
    enemies: [{ kind: 'shooter', x: 600, y: 150, angle: Math.PI, fireCooldown: 0 }],
    projectiles: [],
    spawnCooldown: 999,
  });
  const shooter = await advanceGame(page, 50);
  expect(shooter.projectiles.some(({ owner }) => owner === 'enemy')).toBe(true);

  await configureGame(page, { enemies: [], projectiles: [], spawnCooldown: 0.1 });
  const spawned = await advanceGame(page, 110);
  expect(spawned.enemies).toHaveLength(1);
  const beforeInterval = await advanceGame(page, 1_000);
  expect(beforeInterval.enemies).toHaveLength(1);
});

test('@mobile touch controls drive the same movement and weapon rules', async ({ page }) => {
  await configureGame(page, { player: { x: 600, y: 350, angle: 0 }, enemies: [], projectiles: [], spawnCooldown: 999 });
  const forward = page.getByRole('button', { name: 'Sail forward' });
  await forward.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 1 });
  const moved = await advanceGame(page, 400);
  await forward.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  expect(moved.player.y).toBeLessThan(350);

  const fire = page.getByRole('button', { name: 'Fire front cannon' });
  const fireBox = await fire.boundingBox();
  expect(fireBox).not.toBeNull();
  await page.mouse.move(fireBox!.x + fireBox!.width / 2, fireBox!.y + fireBox!.height / 2);
  await page.mouse.down();
  const fired = await advanceGame(page, 10);
  await page.mouse.up();
  expect(fired.projectiles.some(({ owner }) => owner === 'player')).toBe(true);
  await expect(fire).toHaveAttribute('aria-disabled', 'true');
  await expect.poll(() => fire.locator('.cooldown-shade')
    .evaluate((element) => parseFloat(getComputedStyle(element).height))).toBeGreaterThan(0);

  await fire.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: true, buttons: 1 });
  await advanceGame(page, 100);
  await fire.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', isPrimary: true });
  expect((await gameState(page)).projectiles).toHaveLength(1);

  await advanceGame(page, 400);
  await expect(fire).not.toHaveAttribute('aria-disabled', 'true');
});
