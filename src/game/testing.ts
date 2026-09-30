import { GAME_CONFIG } from './config';
import type { GameSimulation } from './simulation';
import type { EffectState, InputAction, ProjectileState, ShipState } from './types';

export type GameTestState = {
  player: ShipState;
  enemies: ShipState[];
  projectiles: ProjectileState[];
  effects: EffectState[];
  score: number;
  timeRemaining: number;
  spawnCooldown: number;
  paused: boolean;
  gameOver: boolean;
  endReason: 'sunk' | 'time' | null;
};

export type GameTestSetup = {
  player?: Partial<ShipState>;
  enemies?: Array<Partial<ShipState> & Pick<ShipState, 'kind' | 'x' | 'y'>>;
  projectiles?: Array<Partial<ProjectileState> & Pick<ProjectileState, 'x' | 'y' | 'vx' | 'vy' | 'owner'>>;
  score?: number;
  timeRemaining?: number;
  spawnCooldown?: number;
};

export type GameTestBridge = {
  advance: (milliseconds: number) => GameTestState;
  configure: (setup: GameTestSetup) => GameTestState;
  getState: () => GameTestState;
};

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: GameTestBridge;
  }
}

export const isE2EMode = () => new URLSearchParams(window.location.search).get('e2e') === '1';

export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const cloneState = (simulation: GameSimulation): GameTestState => ({
  player: { ...simulation.player },
  enemies: simulation.enemies.map((enemy) => ({ ...enemy })),
  projectiles: simulation.projectiles.map((shot) => ({ ...shot })),
  effects: simulation.effects.map((effect) => ({ ...effect })),
  score: simulation.score,
  timeRemaining: simulation.timeRemaining,
  spawnCooldown: simulation.spawnCooldown,
  paused: simulation.paused,
  gameOver: simulation.gameOver,
  endReason: simulation.endReason,
});

export const installGameTestBridge = (
  simulation: GameSimulation,
  input: ReadonlySet<InputAction>,
  render: (forceSnapshot?: boolean) => void,
) => {
  let nextFixtureId = 10_000;
  const state = () => cloneState(simulation);
  const configure = (setup: GameTestSetup) => {
    if (setup.player) Object.assign(simulation.player, setup.player);
    if (setup.enemies) {
      simulation.enemies = setup.enemies.map((enemy) => ({
        id: nextFixtureId++,
        angle: 0,
        health: GAME_CONFIG.enemy.maxHealth,
        maxHealth: GAME_CONFIG.enemy.maxHealth,
        radius: GAME_CONFIG.enemy.radius,
        fireCooldown: 0,
        fireCooldownDuration: 0,
        alive: true,
        ...enemy,
      }));
    }
    if (setup.projectiles) {
      simulation.projectiles = setup.projectiles.map((shot) => ({
        id: nextFixtureId++,
        damage: shot.owner === 'player' ? GAME_CONFIG.projectile.playerDamage : GAME_CONFIG.projectile.enemyDamage,
        lifetime: GAME_CONFIG.projectile.lifetime,
        ...shot,
      }));
    }
    if (setup.score !== undefined) simulation.score = setup.score;
    if (setup.timeRemaining !== undefined) simulation.timeRemaining = setup.timeRemaining;
    if (setup.spawnCooldown !== undefined) simulation.spawnCooldown = setup.spawnCooldown;
    render(true);
    return state();
  };
  window.__PIRATE_BATTLE_TEST__ = {
    getState: state,
    configure,
    advance: (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('advance expects non-negative milliseconds');
      simulation.update(milliseconds / 1_000, input);
      render(true);
      return state();
    },
  };
  return () => {
    delete window.__PIRATE_BATTLE_TEST__;
  };
};
