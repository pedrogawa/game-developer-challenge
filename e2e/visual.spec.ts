import { configureGame, expect, finishByTime, startGame, test } from './fixtures';

test('@visual menu visual regression', async ({ page, openApp }) => {
  await openApp();
  await expect(page).toHaveScreenshot('menu.png', { animations: 'disabled', fullPage: true });
});

test('@visual stable arena visual regression', async ({ page, openApp }) => {
  await openApp();
  await startGame(page);
  await configureGame(page, {
    player: { x: 600, y: 340, angle: Math.PI / 2 },
    enemies: [
      { kind: 'chaser', x: 890, y: 150, angle: Math.PI },
      { kind: 'shooter', x: 820, y: 420, angle: Math.PI },
    ],
    spawnCooldown: 999,
  });
  await expect(page.locator('.arena-frame')).toHaveScreenshot('arena.png', { animations: 'disabled' });
});

test('@visual result visual regression', async ({ page, openApp }) => {
  await openApp();
  await startGame(page);
  await configureGame(page, { score: 14 });
  await finishByTime(page);
  await expect(page.getByRole('dialog')).toHaveScreenshot('result.png', { animations: 'disabled' });
});
