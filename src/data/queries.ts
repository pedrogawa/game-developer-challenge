import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GameOptions } from '../game/config';
import { getMatchHistory, getRanking } from './api';

export const recordKeys = {
  all: ['records'] as const,
  rankings: () => [...recordKeys.all, 'ranking'] as const,
  ranking: (page: number, pageSize: number, config: GameOptions) =>
    [...recordKeys.rankings(), { page, pageSize, ...config }] as const,
  histories: () => [...recordKeys.all, 'history'] as const,
  history: (playerId: string, page: number, pageSize: number) =>
    [...recordKeys.histories(), { playerId, page, pageSize }] as const,
};

type QueryOptions = {
  page: number;
  pageSize: number;
  enabled: boolean;
};

export const useRankingQuery = ({ page, pageSize, enabled, config }: QueryOptions & { config: GameOptions }) =>
  useQuery({
    queryKey: recordKeys.ranking(page, pageSize, config),
    queryFn: ({ signal }) => getRanking({ page, pageSize, config }, signal),
    enabled,
    placeholderData: (previousData, previousQuery) => {
      const previousParams = previousQuery?.queryKey[2] as Partial<GameOptions> | undefined;
      const sameConfiguration = previousParams?.sessionDuration === config.sessionDuration
        && previousParams?.spawnInterval === config.spawnInterval;
      return sameConfiguration ? previousData : undefined;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

export const useHistoryQuery = ({ page, pageSize, enabled, playerId }: QueryOptions & { playerId: string }) =>
  useQuery({
    queryKey: recordKeys.history(playerId, page, pageSize),
    queryFn: ({ signal }) => getMatchHistory({ playerId, page, pageSize }, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: 'always',
  });
