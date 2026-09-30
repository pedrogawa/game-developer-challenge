import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { MatchRecord, PaginatedResponse, RankingRecord, RegisterMatchResponse } from '../data/contracts';
import { selectMockScenario } from './controls';
import { getRequestSequence, seededLatency } from './scenarios';
import { resetMockServer, startMockServer, stopMockServer } from './server';

const API = 'http://localhost/api';
const rankingUrl = `${API}/ranking?page=1&pageSize=5&sessionDuration=90&spawnInterval=6`;
const historyUrl = `${API}/players/test-player/matches?page=1&pageSize=5`;
const scenario = (id: Parameters<typeof selectMockScenario>[0]['id']) => selectMockScenario({ id, seed: 1337 });
const testMatch: MatchRecord = {
  matchId: 'test-match-1',
  playerId: 'test-player',
  playerName: 'Test Captain',
  playedAt: '2026-09-29T12:00:00.000Z',
  score: 12,
  durationSeconds: 90,
  endReason: 'time',
  config: { sessionDuration: 90, spawnInterval: 6 },
};

const register = (match = testMatch, signal?: AbortSignal) => fetch(`${API}/matches`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ match }),
  signal,
});

beforeAll(startMockServer);
afterEach(resetMockServer);
afterAll(stopMockServer);

describe('shared MSW scenarios', () => {
  it('returns successful, deterministic ranking pages', async () => {
    const response = await fetch(rankingUrl);
    const body = await response.json() as PaginatedResponse<RankingRecord>;
    expect(response.status).toBe(200);
    expect(body.totalItems).toBe(7);
    expect(body.totalPages).toBe(2);
    expect(body.items.map(({ score }) => score)).toEqual([18, 15, 11, 9, 7]);
  });

  it('provides explicit empty and multi-page data for both queries', async () => {
    scenario('empty');
    const emptyRanking = await (await fetch(rankingUrl)).json() as PaginatedResponse<RankingRecord>;
    const emptyHistory = await (await fetch(historyUrl)).json() as PaginatedResponse<MatchRecord>;
    expect(emptyRanking.totalItems).toBe(0);
    expect(emptyHistory.totalItems).toBe(0);

    scenario('multiple-pages');
    const ranking = await (await fetch(rankingUrl)).json() as PaginatedResponse<RankingRecord>;
    const history = await (await fetch(historyUrl)).json() as PaginatedResponse<MatchRecord>;
    expect(ranking.totalPages).toBeGreaterThan(1);
    expect(history.totalPages).toBeGreaterThan(1);
  });

  it('isolates ranking and history failures', async () => {
    scenario('ranking-error');
    expect((await fetch(rankingUrl)).status).toBe(503);
    expect((await fetch(historyUrl)).status).toBe(200);

    scenario('history-error');
    expect((await fetch(rankingUrl)).status).toBe(200);
    expect((await fetch(historyUrl)).status).toBe(503);
  });

  it.each([
    ['http-4xx', 429],
    ['http-5xx', 503],
  ] as const)('returns the configured %s response', async (id, status) => {
    scenario(id);
    expect((await fetch(rankingUrl)).status).toBe(status);
  });

  it('simulates a connection failure', async () => {
    scenario('network-error');
    await expect(fetch(rankingUrl)).rejects.toThrow();
  });

  it('commits before timeout and recovers without duplication', async () => {
    scenario('post-commit-timeout');
    const controller = new AbortController();
    const firstAttempt = register(testMatch, controller.signal);
    setTimeout(() => controller.abort(), 80);
    await expect(firstAttempt).rejects.toThrow();

    const retry = await register();
    const body = await retry.json() as RegisterMatchResponse;
    expect(retry.status).toBe(200);
    expect(body.created).toBe(false);

    const history = await (await fetch(historyUrl)).json() as PaginatedResponse<MatchRecord>;
    expect(history.items.filter(({ matchId }) => matchId === testMatch.matchId)).toHaveLength(1);
  });

  it('keeps a submission recoverable after the endpoint returns online', async () => {
    scenario('offline-at-finish');
    await expect(register()).rejects.toThrow();
    scenario('success');
    const recovered = await register();
    expect(recovered.status).toBe(201);
  });

  it('makes variable latency reproducible from its seed', () => {
    expect(seededLatency('ranking:request:1', 1337)).toBe(seededLatency('ranking:request:1', 1337));
    expect(seededLatency('ranking:request:1', 1337)).not.toBe(seededLatency('ranking:request:1', 7331));
  });

  it('can complete a newer request before an older one', async () => {
    scenario('out-of-order');
    const first = fetch(rankingUrl).then(() => 'first');
    await expect.poll(getRequestSequence).toBe(1);
    const second = fetch(rankingUrl).then(() => 'second');
    expect(await Promise.race([first, second])).toBe('second');
    await Promise.all([first, second]);
  });
});
