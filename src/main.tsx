import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { queryClient } from './data/queryClient';
import { enableMocking } from './mocks/browser';
import { installNetworkDebugBridge } from './mocks/debug';
import './styles.css';

installNetworkDebugBridge();

const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

void enableMocking().catch(() => undefined).finally(render);
