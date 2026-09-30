import type { MatchRecord } from '../data/contracts';

const fixture = (
  matchId: string,
  playerId: string,
  playerName: string,
  score: number,
  durationSeconds: number,
  playedAt: string,
  sessionDuration: number,
  spawnInterval: number,
): MatchRecord => ({
  matchId,
  playerId,
  playerName,
  score,
  durationSeconds,
  playedAt,
  endReason: durationSeconds >= sessionDuration ? 'time' : 'sunk',
  config: { sessionDuration, spawnInterval },
});

export const OTHER_CAPTAIN_MATCHES: MatchRecord[] = [
  fixture('fixture-flint-90-1', 'captain-flint', 'Captain Flint', 18, 90, '2026-09-08T21:42:00.000Z', 90, 6),
  fixture('fixture-sparrow-90-1', 'red-sparrow', 'Red Sparrow', 15, 82, '2026-09-08T20:18:00.000Z', 90, 6),
  fixture('fixture-wolf-90-1', 'sea-wolf', 'Sea Wolf', 11, 90, '2026-09-08T18:24:00.000Z', 90, 6),
  fixture('fixture-storm-90-1', 'storm-rider', 'Storm Rider', 9, 76, '2026-09-08T17:50:00.000Z', 90, 6),
  fixture('fixture-coral-90-1', 'coral-queen', 'Coral Queen', 7, 90, '2026-09-08T16:31:00.000Z', 90, 6),
  fixture('fixture-tide-90-1', 'black-tide', 'Black Tide', 5, 61, '2026-09-08T15:12:00.000Z', 90, 6),
  fixture('fixture-anne-90-1', 'anne-bonny', 'Anne Bonny', 3, 54, '2026-09-08T14:05:00.000Z', 90, 6),
  fixture('fixture-flint-120-1', 'captain-flint', 'Captain Flint', 38, 120, '2026-09-08T21:42:00.000Z', 120, 3),
  fixture('fixture-sparrow-120-1', 'red-sparrow', 'Red Sparrow', 32, 108, '2026-09-08T20:18:00.000Z', 120, 3),
  fixture('fixture-storm-120-1', 'storm-rider', 'Storm Rider', 21, 120, '2026-09-08T18:50:00.000Z', 120, 3),
  fixture('fixture-flint-180-1', 'captain-flint', 'Captain Flint', 44, 180, '2026-09-08T21:42:00.000Z', 180, 2),
  fixture('fixture-sparrow-180-1', 'red-sparrow', 'Red Sparrow', 36, 164, '2026-09-08T20:18:00.000Z', 180, 2),
  fixture('fixture-wolf-180-1', 'sea-wolf', 'Sea Wolf', 27, 180, '2026-09-08T18:24:00.000Z', 180, 2),
];

export const createMultiPageRankingFixtures = (sessionDuration: number, spawnInterval: number): MatchRecord[] =>
  OTHER_CAPTAIN_MATCHES.map((match, index) => ({
    ...match,
    matchId: `scenario-ranking-${sessionDuration}-${spawnInterval}-${index + 1}`,
    durationSeconds: Math.min(sessionDuration, Math.max(1, match.durationSeconds)),
    config: { sessionDuration, spawnInterval },
  }));

export const createMultiPageHistoryFixtures = (playerId: string): MatchRecord[] =>
  OTHER_CAPTAIN_MATCHES.slice(0, 12).map((match, index) => ({
    ...match,
    matchId: `scenario-history-${playerId}-${index + 1}`,
    playerId,
    playerName: 'Scenario Captain',
  }));
