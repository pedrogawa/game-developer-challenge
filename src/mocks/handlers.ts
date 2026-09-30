import { delay, http, HttpResponse } from 'msw';
import type { MatchRecord, PaginatedResponse, RankingRecord, RegisterMatchRequest } from '../data/contracts';
import { isMatchRecord } from '../matchRecords';
import { createMultiPageHistoryFixtures, createMultiPageRankingFixtures, OTHER_CAPTAIN_MATCHES } from './fixtures';
import { getMockScenario, nextRequestSequence, seededLatency } from './scenarios';
import { loadConfirmedMatches, saveConfirmedMatches } from './storage';

type Endpoint = 'ranking' | 'history' | 'registration';

const CLIENT_TIMEOUT_MS = 6_000;
const DEFAULT_DELAYS: Record<Endpoint, number> = { ranking: 180, history: 180, registration: 220 };

const positiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const paginate = <T>(items: T[], page: number, pageSize: number): PaginatedResponse<T> => {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, pageSize, totalItems, totalPages };
};

const scenarioFailure = (endpoint: Endpoint) => {
  const { id } = getMockScenario();
  if (id === 'network-error' || (id === 'offline-at-finish' && endpoint === 'registration')) {
    return HttpResponse.error();
  }
  if (id === 'http-4xx') {
    return HttpResponse.json({ message: 'The mock scenario returned HTTP 429.' }, { status: 429 });
  }
  if (id === 'http-5xx'
    || (id === 'ranking-error' && endpoint === 'ranking')
    || (id === 'history-error' && endpoint === 'history')) {
    return HttpResponse.json({ message: `The mock ${endpoint} service is unavailable.` }, { status: 503 });
  }
  return null;
};

const applyScenarioDelay = async (endpoint: Endpoint, request: Request) => {
  const { id, seed } = getMockScenario();
  const sequence = nextRequestSequence();
  if (id === 'timeout') {
    await delay(CLIENT_TIMEOUT_MS + 1_000);
    return;
  }
  if (id === 'slow') {
    await delay(2_500);
    return;
  }
  if (id === 'variable-latency') {
    await delay(seededLatency(`${endpoint}:${request.url}:${sequence}`, seed));
    return;
  }
  if (id === 'out-of-order') {
    await delay(sequence % 2 === 0 ? 1_400 : 100);
    return;
  }
  await delay(DEFAULT_DELAYS[endpoint]);
};

export const handlers = [
  http.get('*/api/ranking', async ({ request }) => {
    const failure = scenarioFailure('ranking');
    if (failure) return failure;
    await applyScenarioDelay('ranking', request);

    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get('page'), 1);
    const pageSize = positiveInteger(url.searchParams.get('pageSize'), 5);
    const sessionDuration = Number(url.searchParams.get('sessionDuration'));
    const spawnInterval = Number(url.searchParams.get('spawnInterval'));
    if (!Number.isFinite(sessionDuration) || !Number.isFinite(spawnInterval)) {
      return HttpResponse.json({ message: 'A valid match configuration is required.' }, { status: 400 });
    }

    if (getMockScenario().id === 'empty') return HttpResponse.json(paginate<RankingRecord>([], page, pageSize));
    const fixtures = getMockScenario().id === 'multiple-pages'
      ? createMultiPageRankingFixtures(sessionDuration, spawnInterval)
      : OTHER_CAPTAIN_MATCHES;
    const ranked = [...fixtures, ...loadConfirmedMatches()]
      .filter((match) => match.config.sessionDuration === sessionDuration
        && match.config.spawnInterval === spawnInterval)
      .sort((a, b) => b.score - a.score
        || a.durationSeconds - b.durationSeconds
        || a.playedAt.localeCompare(b.playedAt)
        || a.matchId.localeCompare(b.matchId))
      .map<RankingRecord>((match, index) => ({ ...match, rank: index + 1 }));
    return HttpResponse.json(paginate(ranked, page, pageSize));
  }),

  http.get('*/api/players/:playerId/matches', async ({ params, request }) => {
    const failure = scenarioFailure('history');
    if (failure) return failure;
    await applyScenarioDelay('history', request);

    const url = new URL(request.url);
    const page = positiveInteger(url.searchParams.get('page'), 1);
    const pageSize = positiveInteger(url.searchParams.get('pageSize'), 5);
    if (getMockScenario().id === 'empty') return HttpResponse.json(paginate<MatchRecord>([], page, pageSize));
    const scenarioHistory = getMockScenario().id === 'multiple-pages'
      ? createMultiPageHistoryFixtures(String(params.playerId))
      : [];
    const history = [...scenarioHistory, ...loadConfirmedMatches()]
      .filter((match) => match.playerId === params.playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId));
    return HttpResponse.json(paginate(history, page, pageSize));
  }),

  http.post('*/api/matches', async ({ request }) => {
    const failure = scenarioFailure('registration');
    if (failure) return failure;

    const body = await request.json() as Partial<RegisterMatchRequest>;
    if (!isMatchRecord(body.match)) {
      await applyScenarioDelay('registration', request);
      return HttpResponse.json({ message: 'The match payload is invalid.' }, { status: 400 });
    }

    const matches = loadConfirmedMatches();
    const existing = matches.find((match) => match.matchId === body.match?.matchId);
    if (existing) {
      await applyScenarioDelay('registration', request);
      return HttpResponse.json({ match: existing, created: false });
    }

    saveConfirmedMatches([body.match, ...matches]);
    if (getMockScenario().id === 'post-commit-timeout') {
      await delay(CLIENT_TIMEOUT_MS + 1_000);
    } else {
      await applyScenarioDelay('registration', request);
    }
    return HttpResponse.json({ match: body.match, created: true }, { status: 201 });
  }),
];
