import type { GameSimulation } from './simulation';

export type EntityCounts = {
  ships: number;
  enemies: number;
  projectiles: number;
  effects: number;
  total: number;
};

export type FramePerformanceReport = {
  sampleCount: number;
  measuredDurationMs: number;
  averageFps: number;
  averageFrameTimeMs: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  maximumFrameTimeMs: number;
  framesOver16_67Ms: number;
  framesOver33_33Ms: number;
  averageEntities: number;
  maximumEntities: EntityCounts;
  finalEntities: EntityCounts;
};

export type PerformanceBridge = {
  reset: () => void;
  protectPlayer: () => void;
  getReport: () => FramePerformanceReport;
};

declare global {
  interface Window {
    __PIRATE_BATTLE_PERFORMANCE__?: PerformanceBridge;
  }
}

export const isPerformanceMode = () => new URLSearchParams(window.location.search).get('profile') === '1';

const emptyCounts = (): EntityCounts => ({ ships: 0, enemies: 0, projectiles: 0, effects: 0, total: 0 });

const countEntities = (simulation: GameSimulation): EntityCounts => {
  const ships = 1 + simulation.enemies.length;
  const enemies = simulation.enemies.length;
  const projectiles = simulation.projectiles.length;
  const effects = simulation.effects.length;
  return { ships, enemies, projectiles, effects, total: ships + projectiles + effects };
};

export const installPerformanceBridge = (simulation: GameSimulation) => {
  const frameTimes: number[] = [];
  let duration = 0;
  let entityTotal = 0;
  let maximum = emptyCounts();
  let final = emptyCounts();

  const reset = () => {
    frameTimes.length = 0;
    duration = 0;
    entityTotal = 0;
    maximum = emptyCounts();
    final = countEntities(simulation);
  };
  const record = (elapsedMs: number) => {
    if (simulation.paused || simulation.gameOver || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
    const entities = countEntities(simulation);
    frameTimes.push(elapsedMs);
    duration += elapsedMs;
    entityTotal += entities.total;
    final = entities;
    maximum = {
      ships: Math.max(maximum.ships, entities.ships),
      enemies: Math.max(maximum.enemies, entities.enemies),
      projectiles: Math.max(maximum.projectiles, entities.projectiles),
      effects: Math.max(maximum.effects, entities.effects),
      total: Math.max(maximum.total, entities.total),
    };
  };
  const percentile = (sorted: number[], ratio: number) => {
    if (sorted.length === 0) return 0;
    return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
  };
  const getReport = (): FramePerformanceReport => {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const sampleCount = frameTimes.length;
    const averageFrameTimeMs = sampleCount === 0 ? 0 : duration / sampleCount;
    return {
      sampleCount,
      measuredDurationMs: duration,
      averageFps: duration === 0 ? 0 : sampleCount * 1_000 / duration,
      averageFrameTimeMs,
      p95FrameTimeMs: percentile(sorted, 0.95),
      p99FrameTimeMs: percentile(sorted, 0.99),
      maximumFrameTimeMs: sorted.at(-1) ?? 0,
      framesOver16_67Ms: frameTimes.filter((value) => value > 16.67).length,
      framesOver33_33Ms: frameTimes.filter((value) => value > 33.33).length,
      averageEntities: sampleCount === 0 ? 0 : entityTotal / sampleCount,
      maximumEntities: { ...maximum },
      finalEntities: { ...final },
    };
  };

  window.__PIRATE_BATTLE_PERFORMANCE__ = {
    reset,
    protectPlayer: () => {
      simulation.player.maxHealth = 1_000_000;
      simulation.player.health = 1_000_000;
    },
    getReport,
  };
  reset();
  return {
    record,
    remove: () => { delete window.__PIRATE_BATTLE_PERFORMANCE__; },
  };
};
