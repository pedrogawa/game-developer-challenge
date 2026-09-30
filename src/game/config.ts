export const GAME_CONFIG = {
  arena: { width: 1200, height: 675, padding: 34 },
  simulation: { maxDelta: 0.05 },
  player: {
    maxHealth: 100,
    speed: 205,
    rotationSpeed: 2.65,
    radius: 25,
    start: { x: 515, y: 310, angle: Math.PI / 2 },
  },
  enemy: {
    maxHealth: 45,
    speed: 92,
    rotationSpeed: 1.9,
    radius: 24,
    shooterRange: 335,
    shooterKeepAway: 225,
    fireCooldown: 1.8,
    contactDamage: 24,
    separationDistance: 4,
  },
  projectile: {
    speed: 470,
    lifetime: 1.65,
    radius: 5,
    playerDamage: 23,
    enemyDamage: 13,
    frontLaunchOffset: 35,
    broadsideLaunchOffset: 30,
  },
  weapons: {
    frontCooldown: 0.42,
    broadsideCooldown: 1.05,
    broadsideSpacing: 14,
    frontEffectOffset: 33,
    broadsideEffectOffset: 34,
  },
  effects: { obstacleHit: 0.18, hit: 0.2, frontMuzzle: 0.16, broadsideMuzzle: 0.2, explosion: 0.65 },
  spawn: {
    initialDelay: 2.5,
    minimumPlayerDistance: 300,
    defaultEnemyAngle: Math.PI,
    initialEnemies: [
      { kind: 'chaser' as const, x: 1000, y: 130, angle: Math.PI },
      { kind: 'shooter' as const, x: 810, y: 315, angle: Math.PI },
    ],
    points: [
      { x: 620, y: 70 },
      { x: 1080, y: 260 },
      { x: 840, y: 570 },
      { x: 90, y: 480 },
    ],
    fallbackPoint: { x: 1100, y: 320 },
    enemySequence: ['chaser', 'shooter'] as const,
  },
} as const;

export type GameOptions = {
  sessionDuration: number;
  spawnInterval: number;
};

export const GAME_OPTION_LIMITS = {
  sessionDuration: { min: 60, max: 180, step: 30 },
  spawnInterval: { min: 2, max: 15, step: 1 },
} as const;

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  sessionDuration: 90,
  spawnInterval: 6,
};

export const ISLANDS = [
  { x: -48, y: -36, width: 355, height: 250, visual: 'large' as const },
  { x: 925, y: 410, width: 330, height: 300, visual: 'large' as const },
  { x: 420, y: 565, width: 350, height: 160, visual: 'strip' as const },
];
