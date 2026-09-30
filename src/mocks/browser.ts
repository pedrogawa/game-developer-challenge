import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export const enableMocking = async () => {
  await worker.start({
    onUnhandledFrame: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
};
