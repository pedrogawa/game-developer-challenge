import type {
  HistoryParams,
  MatchRecord,
  PaginatedResponse,
  RankingParams,
  RankingRecord,
  RegisterMatchResponse,
} from './contracts';
import { httpClient } from './http';

export const getRanking = async (params: RankingParams, signal?: AbortSignal) => {
  const response = await httpClient.get<PaginatedResponse<RankingRecord>>('/ranking', {
    signal,
    params: {
      page: params.page,
      pageSize: params.pageSize,
      sessionDuration: params.config.sessionDuration,
      spawnInterval: params.config.spawnInterval,
    },
  });
  return response.data;
};

export const getMatchHistory = async (params: HistoryParams, signal?: AbortSignal) => {
  const response = await httpClient.get<PaginatedResponse<MatchRecord>>(`/players/${params.playerId}/matches`, {
    signal,
    params: { page: params.page, pageSize: params.pageSize },
  });
  return response.data;
};

export const registerMatch = async (match: MatchRecord) => {
  const response = await httpClient.post<RegisterMatchResponse>('/matches', { match });
  return response.data;
};
