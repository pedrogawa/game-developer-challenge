import { resetPendingMatchPersistence } from '../matchRecords';
import { resetConfirmedMatches } from './storage';
import { resetMockScenario, resetScenarioSequence, setMockScenario } from './scenarios';
import type { MockScenarioConfig } from './scenarios';

export const selectMockScenario = (config: MockScenarioConfig) => {
  setMockScenario(config);
};

export const resetMockData = () => {
  resetConfirmedMatches();
  resetPendingMatchPersistence();
  resetMockScenario();
  resetScenarioSequence();
};
