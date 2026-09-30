import { queryClient } from '../data/queryClient';
import { resetMockData, selectMockScenario } from './controls';
import {
  DEFAULT_MOCK_SCENARIO,
  MOCK_SCENARIOS,
  getMockScenario,
  type MockScenarioConfig,
  type MockScenarioDefinition,
  type MockScenarioId,
} from './scenarios';

type NetworkDebugBridge = {
  list: () => readonly MockScenarioDefinition[];
  current: () => MockScenarioConfig;
  select: (id: MockScenarioId, seed?: number) => MockScenarioConfig;
  reset: () => MockScenarioConfig;
};

declare global {
  interface Window {
    pirateBattleDebug?: {
      network: NetworkDebugBridge;
    };
  }
}

const scenarioIds = new Set(MOCK_SCENARIOS.map(({ id }) => id));

export const installNetworkDebugBridge = () => {
  const network: NetworkDebugBridge = {
    list: () => MOCK_SCENARIOS,
    current: getMockScenario,
    select: (id, seed = DEFAULT_MOCK_SCENARIO.seed) => {
      if (!scenarioIds.has(id)) throw new RangeError(`Unknown network scenario: ${id}`);
      if (!Number.isSafeInteger(seed)) throw new TypeError('The network scenario seed must be a safe integer.');

      const config = { id, seed };
      selectMockScenario(config);
      queryClient.clear();
      return getMockScenario();
    },
    reset: () => {
      resetMockData();
      queryClient.clear();
      return getMockScenario();
    },
  };

  window.pirateBattleDebug = { network };
};
