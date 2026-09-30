import type { GameOptions } from '../game/config';

export type MatchEndReason = 'time' | 'sunk';

export type PlayerIdentity = {
  id: string;
  name: string;
};

export type MatchRecord = {
  matchId: string;
  playerId: string;
  playerName: string;
  playedAt: string;
  score: number;
  durationSeconds: number;
  endReason: MatchEndReason;
  config: GameOptions;
};

export type RankingRecord = MatchRecord & {
  rank: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type RankingParams = {
  page: number;
  pageSize: number;
  config: GameOptions;
};

export type HistoryParams = {
  playerId: string;
  page: number;
  pageSize: number;
};

export type RegisterMatchRequest = {
  match: MatchRecord;
};

export type RegisterMatchResponse = {
  match: MatchRecord;
  created: boolean;
};

export type PendingMatch = {
  match: MatchRecord;
  attempts: number;
  lastAttemptAt: string | null;
};
