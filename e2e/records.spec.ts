import { configureGame, expect, finishByTime, saveResult, setScenario, startGame, test } from './fixtures';

test('loads and paginates Ranking and Match History', async ({ page, openApp }) => {
  await openApp('multiple-pages');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Reading the captain’s log' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Ranking' }).getByRole('row')).toHaveCount(6);
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();

  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Match history' }).getByRole('row')).toHaveCount(6);
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
});

test('renders empty and error states with retry', async ({ page, openApp }) => {
  await openApp('empty');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('No captains ranked yet')).toBeVisible();
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByText('No battles recorded yet')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();

  await setScenario(page, 'ranking-error');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not load the captain’s log');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('registers a match and updates ranking and history', async ({ page, openApp }) => {
  await openApp();
  await startGame(page);
  await configureGame(page, { score: 99 });
  await finishByTime(page);
  await page.getByLabel('Captain name').fill('A');
  await page.getByRole('button', { name: 'Save Score' }).click();
  await expect(page.getByRole('alert')).toContainText('Use 2 to 20 characters');
  await saveResult(page, 'Black Pearl');
  await expect(page.getByText('Match saved')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();

  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ranking' })).toContainText('Black Pearl');
  await expect(page.getByRole('table', { name: 'Ranking' })).toContainText('99');
  await page.getByRole('button', { name: 'Match History', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Match history' })).toContainText('99');
});

test('recovers an offline submission after refresh', async ({ page, openApp }) => {
  await openApp('offline-at-finish');
  await startGame(page);
  await configureGame(page, { score: 31 });
  await finishByTime(page);
  await saveResult(page);
  await expect(page.getByText('Match pending — retry available')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/1 match is waiting to sync/)).toBeVisible();
  await setScenario(page, 'success');
  await page.getByRole('button', { name: 'Retry sync' }).click();
  await expect(page.getByText(/waiting to sync/)).toBeHidden();
});

test('retries a post-commit timeout idempotently after refresh', async ({ page, openApp }) => {
  await openApp('post-commit-timeout');
  const outcome = await page.evaluate(async () => {
    const match = {
      matchId: 'e2e-timeout-idempotency', playerId: 'e2e-captain', playerName: 'E2E Captain',
      playedAt: '2026-09-30T12:00:00.000Z', score: 88, durationSeconds: 90,
      endReason: 'time', config: { sessionDuration: 90, spawnInterval: 6 },
    };
    const controller = new AbortController();
    const first = fetch('/api/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match }), signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 80);
    let timedOut = false;
    try { await first; } catch { timedOut = true; }
    const retry = await fetch('/api/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match }),
    });
    const retryBody = await retry.json() as { created: boolean };
    const history = await (await fetch('/api/players/e2e-captain/matches?page=1&pageSize=5')).json() as {
      items: Array<{ matchId: string }>;
    };
    return { timedOut, createdOnRetry: retryBody.created, count: history.items.filter((item) => item.matchId === match.matchId).length };
  });
  expect(outcome).toEqual({ timedOut: true, createdOnRetry: false, count: 1 });
});

test('keeps the newest paginated response when older responses arrive late', async ({ page, openApp }) => {
  await openApp('out-of-order');
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('Reading the captain’s log…')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('button', { name: 'Decrease game session time' }).click();
  await page.getByRole('button', { name: 'Save & Main Menu' }).click();
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await expect(page.getByText('60 second battles · 6 second spawn interval')).toBeVisible();
  await expect(page.getByText('No captains ranked yet')).toBeVisible();
  await page.waitForTimeout(1_600);
  await expect(page.getByText('60 second battles · 6 second spawn interval')).toBeVisible();
  await expect(page.getByText('No captains ranked yet')).toBeVisible();
});
