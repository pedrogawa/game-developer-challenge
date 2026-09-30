export const MOCK_SCENARIO_STORAGE_KEY = 'pirate-battle-mock-scenario-v1';
export const MOCK_SCENARIO_CHANGE_EVENT = 'pirate-battle:mock-scenario-change';

export type MockScenarioId =
  | 'success'
  | 'empty'
  | 'multiple-pages'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'timeout'
  | 'network-error'
  | 'http-4xx'
  | 'http-5xx'
  | 'ranking-error'
  | 'history-error'
  | 'post-commit-timeout'
  | 'offline-at-finish';

export type MockScenarioConfig = {
  id: MockScenarioId;
  seed: number;
};

export type MockScenarioDefinition = {
  id: MockScenarioId;
  label: string;
  description: string;
};

export const DEFAULT_MOCK_SCENARIO: MockScenarioConfig = { id: 'success', seed: 1337 };

export const MOCK_SCENARIOS: readonly MockScenarioDefinition[] = [
  { id: 'success', label: 'Success', description: 'Normal responses with a short fixed delay.' },
  { id: 'empty', label: 'Empty lists', description: 'Ranking and history return empty pages.' },
  { id: 'multiple-pages', label: 'Multiple pages', description: 'Uses the complete fixture set to exercise pagination.' },
  { id: 'slow', label: 'Slow network', description: 'Every request takes 2.5 seconds.' },
  { id: 'variable-latency', label: 'Variable latency', description: 'Seeded latency varies reproducibly per request.' },
  { id: 'out-of-order', label: 'Out of order', description: 'Alternates slow and fast responses so newer requests can finish first.' },
  { id: 'timeout', label: 'Timeout', description: 'Responses exceed the HTTP client timeout.' },
  { id: 'network-error', label: 'Connection failure', description: 'All record API calls fail at the network layer.' },
  { id: 'http-4xx', label: 'HTTP 4xx', description: 'All record API calls return 429.' },
  { id: 'http-5xx', label: 'HTTP 5xx', description: 'All record API calls return 503.' },
  { id: 'ranking-error', label: 'Ranking failure', description: 'Only ranking requests return 503.' },
  { id: 'history-error', label: 'History failure', description: 'Only history requests return 503.' },
  { id: 'post-commit-timeout', label: 'Timeout after save', description: 'The first submission is saved, but its response arrives after timeout.' },
  { id: 'offline-at-finish', label: 'Offline at finish', description: 'Match submissions fail until another scenario is selected.' },
] as const;

const scenarioIds = new Set<MockScenarioId>(MOCK_SCENARIOS.map(({ id }) => id));
let memoryConfig: MockScenarioConfig = { ...DEFAULT_MOCK_SCENARIO };
let requestSequence = 0;

const availableStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isConfig = (value: unknown): value is MockScenarioConfig => {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<MockScenarioConfig>;
  return typeof config.id === 'string'
    && scenarioIds.has(config.id as MockScenarioId)
    && typeof config.seed === 'number'
    && Number.isSafeInteger(config.seed);
};

export const getMockScenario = (): MockScenarioConfig => {
  const storage = availableStorage();
  if (!storage) return { ...memoryConfig };
  try {
    const value = JSON.parse(storage.getItem(MOCK_SCENARIO_STORAGE_KEY) ?? 'null') as unknown;
    return isConfig(value) ? value : { ...DEFAULT_MOCK_SCENARIO };
  } catch {
    return { ...DEFAULT_MOCK_SCENARIO };
  }
};

export const setMockScenario = (config: MockScenarioConfig) => {
  memoryConfig = isConfig(config) ? { ...config } : { ...DEFAULT_MOCK_SCENARIO };
  requestSequence = 0;
  try { availableStorage()?.setItem(MOCK_SCENARIO_STORAGE_KEY, JSON.stringify(memoryConfig)); } catch { /* memory fallback */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MOCK_SCENARIO_CHANGE_EVENT));
};

export const resetMockScenario = () => {
  try { availableStorage()?.removeItem(MOCK_SCENARIO_STORAGE_KEY); } catch { /* memory fallback */ }
  memoryConfig = { ...DEFAULT_MOCK_SCENARIO };
  requestSequence = 0;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MOCK_SCENARIO_CHANGE_EVENT));
};

export const nextRequestSequence = () => requestSequence++;

export const resetScenarioSequence = () => { requestSequence = 0; };

const hashText = (text: string, seed: number) => {
  let hash = seed | 0;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return hash >>> 0;
};

export const seededLatency = (key: string, seed: number, min = 120, max = 1_400) => {
  const ratio = hashText(key, seed) / 0xffffffff;
  return Math.round(min + ratio * (max - min));
};
