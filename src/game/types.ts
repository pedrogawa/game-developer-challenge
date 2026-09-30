export type Vec = { x: number; y: number };
export type EnemyKind = 'chaser' | 'shooter';
export type ProjectileOwner = 'player' | 'enemy';

export type ShipState = Vec & {
  id: number;
  angle: number;
  health: number;
  maxHealth: number;
  radius: number;
  kind: 'player' | EnemyKind;
  fireCooldown: number;
  fireCooldownDuration: number;
  alive: boolean;
};

export type ProjectileState = Vec & {
  id: number;
  vx: number;
  vy: number;
  owner: ProjectileOwner;
  damage: number;
  lifetime: number;
};

export type EffectState = Vec & {
  id: number;
  age: number;
  duration: number;
  kind: 'muzzle' | 'explosion' | 'hit';
  sound?: 'cannon' | 'broadside';
};

export type GameSnapshot = {
  health: number;
  maxHealth: number;
  fireCooldown: number;
  fireCooldownDuration: number;
  score: number;
  timeRemaining: number;
  paused: boolean;
  gameOver: boolean;
  endReason: 'sunk' | 'time' | null;
};

export type InputAction = 'forward' | 'left' | 'right' | 'fireFront' | 'fireLeft' | 'fireRight';
