import type { GameOptions } from './game/config';
import type { MatchRecord, PendingMatch, PlayerIdentity } from './data/contracts';

const PENDING_MATCHES_KEY = 'pirate-battle-pending-matches-v1';
const LAST_MATCH_KEY = 'pirate-battle-last-match-v1';
const LEGACY_MATCHES_KEY = 'pirate-battle-completed-matches-v1';
const MAX_PENDING_MATCHES = 100;
export const PENDING_MATCHES_CHANGE_EVENT = 'pirate-battle:pending-matches-change';

const notifyPendingMatchesChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PENDING_MATCHES_CHANGE_EVENT));
};

const isGameOptions = (value: unknown): value is GameOptions => {
  if (!value || typeof value !== 'object') return false;
  const options = value as Partial<GameOptions>;
  return typeof options.sessionDuration === 'number' && typeof options.spawnInterval === 'number';
};

export const isMatchRecord = (value: unknown): value is MatchRecord => {
  if (!value || typeof value !== 'object') return false;
  const match = value as Partial<MatchRecord>;
  return typeof match.matchId === 'string'
    && typeof match.playerId === 'string'
    && typeof match.playerName === 'string'
    && typeof match.playedAt === 'string'
    && typeof match.score === 'number'
    && Number.isFinite(match.score)
    && typeof match.durationSeconds === 'number'
    && Number.isFinite(match.durationSeconds)
    && (match.endReason === 'time' || match.endReason === 'sunk')
    && isGameOptions(match.config);
};

const savePending = (pending: PendingMatch[]) => {
  localStorage.setItem(PENDING_MATCHES_KEY, JSON.stringify(pending.slice(0, MAX_PENDING_MATCHES)));
  notifyPendingMatchesChanged();
};

export const loadPendingMatches = (): PendingMatch[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_MATCHES_KEY) ?? '[]') as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is PendingMatch => {
      if (!item || typeof item !== 'object') return false;
      const pending = item as Partial<PendingMatch>;
      return isMatchRecord(pending.match)
        && typeof pending.attempts === 'number'
        && (pending.lastAttemptAt === null || typeof pending.lastAttemptAt === 'string');
    });
  } catch {
    return [];
  }
};

export const enqueuePendingMatch = (match: MatchRecord): boolean => {
  try {
    const pending = loadPendingMatches();
    if (!pending.some((item) => item.match.matchId === match.matchId)) {
      savePending([{ match, attempts: 0, lastAttemptAt: null }, ...pending]);
    }
    return true;
  } catch {
    return false;
  }
};

export const markPendingAttempt = (matchId: string) => {
  try {
    const now = new Date().toISOString();
    savePending(loadPendingMatches().map((item) => item.match.matchId === matchId
      ? { ...item, attempts: item.attempts + 1, lastAttemptAt: now }
      : item));
  } catch {
    // The current mutation still reports its error even if metadata cannot persist.
  }
};

export const removePendingMatch = (matchId: string) => {
  try { savePending(loadPendingMatches().filter((item) => item.match.matchId !== matchId)); } catch { /* noop */ }
};

export const saveLastCompletedMatch = (match: MatchRecord): boolean => {
  try {
    localStorage.setItem(LAST_MATCH_KEY, JSON.stringify(match));
    return true;
  } catch {
    return false;
  }
};

export const resetPendingMatchPersistence = () => {
  try {
    localStorage.removeItem(PENDING_MATCHES_KEY);
    localStorage.removeItem(LAST_MATCH_KEY);
  } catch {
    // Consumers are still notified so their in-memory state can be reset.
  }
  notifyPendingMatchesChanged();
};

type LegacyMatch = {
  id: string;
  playedAt: string;
  points: number;
  durationSeconds: number;
  result: 'time' | 'sunk';
  options: GameOptions;
};

export const migrateLegacyMatches = (player: PlayerIdentity) => {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_MATCHES_KEY) ?? '[]') as LegacyMatch[];
    if (!Array.isArray(legacy)) return;
    for (const item of legacy) {
      if (!item || typeof item.id !== 'string' || !isGameOptions(item.options)) continue;
      enqueuePendingMatch({
        matchId: item.id,
        playerId: player.id,
        playerName: player.name,
        playedAt: item.playedAt,
        score: item.points,
        durationSeconds: item.durationSeconds,
        endReason: item.result,
        config: item.options,
      });
    }
    localStorage.removeItem(LEGACY_MATCHES_KEY);
  } catch {
    // Invalid legacy data is ignored and cannot block startup.
  }
};
