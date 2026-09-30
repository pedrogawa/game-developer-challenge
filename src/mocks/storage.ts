import type { MatchRecord } from '../data/contracts';
import { isMatchRecord } from '../matchRecords';

export const CONFIRMED_MATCHES_KEY = 'pirate-battle-api-matches-v1';
let memoryMatches: MatchRecord[] = [];

const availableStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const loadConfirmedMatches = (): MatchRecord[] => {
  const storage = availableStorage();
  if (!storage) return [...memoryMatches];
  try {
    const stored = JSON.parse(storage.getItem(CONFIRMED_MATCHES_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter(isMatchRecord) : [];
  } catch {
    return [];
  }
};

export const saveConfirmedMatches = (matches: MatchRecord[]) => {
  memoryMatches = [...matches];
  const storage = availableStorage();
  if (storage) storage.setItem(CONFIRMED_MATCHES_KEY, JSON.stringify(matches));
};

export const resetConfirmedMatches = () => {
  memoryMatches = [];
  try { availableStorage()?.removeItem(CONFIRMED_MATCHES_KEY); } catch { /* memory state was still reset */ }
};
