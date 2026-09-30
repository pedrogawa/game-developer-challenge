import type { PlayerIdentity } from './contracts';

const PLAYER_KEY = 'pirate-battle-player-v1';

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
