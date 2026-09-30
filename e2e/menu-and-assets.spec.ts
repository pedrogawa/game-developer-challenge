import { expect, startGame, test } from './fixtures';

test('navigates repeatedly and persists only valid option values', async ({ page, openApp }) => {
  await openApp();
  await page.getByRole('button', { name: 'Options' }).click();
  const decreaseSession = page.getByRole('button', { name: 'Decrease game session time' });
  await decreaseSession.click();
  await expect(decreaseSession).toBeDisabled();
  await expect(page.getByText('60 s', { exact: true })).toBeVisible();

  const increaseSpawn = page.getByRole('button', { name: 'Increase enemy spawn time' });
  await increaseSpawn.click();
  await increaseSpawn.click();
  await page.getByRole('button', { name: 'Save & Main Menu' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.getByText('60 s', { exact: true })).toBeVisible();
  await expect(page.getByText('8 s', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close options' }).click();

  for (const destination of ['Ranking', 'Match History', 'Ranking']) {
    await page.getByRole('button', { name: destination, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Captain’s Log' })).toBeVisible();
    await page.getByRole('button', { name: 'Main Menu' }).click();
  }
});

test('reports an asset failure and succeeds after retry', async ({ page, openApp }) => {
  await openApp();
  await page.evaluate(() => sessionStorage.setItem('pirate-battle-e2e-fail-assets-once', '1'));
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assets lost at sea' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Loading the fleet…' })).toBeHidden({ timeout: 15_000 });
  await expect(page.getByLabel('Pirate battle arena')).toBeVisible();
});

test('@mobile completes the primary menu-to-game flow on a touch viewport', async ({ page, openApp }) => {
  await openApp();
  await startGame(page);
  await expect(page.getByRole('group', { name: 'Touch controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sail forward' })).toBeEnabled();
});
