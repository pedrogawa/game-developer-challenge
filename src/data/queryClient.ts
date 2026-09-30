import { QueryClient } from '@tanstack/react-query';
import { isRetryableHttpError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => failureCount < 2 && isRetryableHttpError(error),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => failureCount < 1 && isRetryableHttpError(error),
    },
  },
});
