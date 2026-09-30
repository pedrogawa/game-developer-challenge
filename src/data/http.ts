import axios from 'axios';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 6_000,
  headers: { Accept: 'application/json' },
});

export const isRetryableHttpError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return error.response.status >= 500 || error.response.status === 408 || error.response.status === 429;
};

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string') return message;
    if (error.code === 'ECONNABORTED') return 'The request timed out.';
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
};
