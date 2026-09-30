import type { PlayerIdentity } from './contracts';

const PLAYER_KEY = 'pirate-battle-player-v1';
export const PLAYER_NAME_LIMITS = { min: 2, max: 20 } as const;

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/g, ' ');

const createId = () => typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getOrCreatePlayer = (): PlayerIdentity => {
  try {
    const stored = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Partial<PlayerIdentity> | null;
    if (stored && typeof stored.id === 'string' && typeof stored.name === 'string') {
      return { id: stored.id, name: stored.name };
    }
  } catch {
    // Fall through to a fresh in-memory identity when storage is unavailable.
  }

  const id = createId();
  const player = { id, name: `Captain ${id.slice(0, 4).toUpperCase()}` };
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); } catch { /* Gameplay remains available. */ }
  return player;
};

export const savePlayerName = (player: PlayerIdentity, name: string): PlayerIdentity => {
  const normalized = normalizePlayerName(name);
  if (normalized.length < PLAYER_NAME_LIMITS.min || normalized.length > PLAYER_NAME_LIMITS.max) {
    throw new RangeError(`Captain name must contain ${PLAYER_NAME_LIMITS.min} to ${PLAYER_NAME_LIMITS.max} characters.`);
  }
  const updated = { ...player, name: normalized };
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(updated)); } catch { /* The in-memory identity remains usable. */ }
  return updated;
};
