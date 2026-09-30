import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { resetMockData } from './controls';

/** Shared Node server for unit/integration test runners. */
export const mockServer = setupServer(...handlers);

export const startMockServer = () => mockServer.listen({ onUnhandledFrame: 'error' });
export const resetMockServer = () => {
  mockServer.resetHandlers(...handlers);
  resetMockData();
};
export const stopMockServer = () => mockServer.close();
