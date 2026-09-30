import { DEFAULT_GAME_OPTIONS, GAME_CONFIG, ISLANDS } from './config';
import type { GameOptions } from './config';
import type { EffectState, EnemyKind, InputAction, ProjectileState, ShipState } from './types';

const { arena, effects, enemy: enemyConfig, player: playerConfig, projectile, simulation, spawn, weapons } = GAME_CONFIG;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distanceSq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export class GameSimulation {
  player: ShipState;
  enemies: ShipState[] = [];
  projectiles: ProjectileState[] = [];
  effects: EffectState[] = [];
  score: number = 0;
  timeRemaining: number;
  spawnCooldown: number;
  paused = false;
  gameOver = false;
  endReason: 'sunk' | 'time' | null = null;
  private nextId = 1;
  private spawnSequenceIndex = 0;
  private readonly random: () => number;

  private readonly spawnInterval: number;

  constructor(options: GameOptions = DEFAULT_GAME_OPTIONS, random: () => number = Math.random) {
    this.random = random;
    this.timeRemaining = options.sessionDuration;
    this.spawnInterval = options.spawnInterval;
    this.spawnCooldown = Math.min(spawn.initialDelay, options.spawnInterval);
    this.player = this.makeShip('player', playerConfig.start.x, playerConfig.start.y, playerConfig.start.angle);
    for (const enemy of spawn.initialEnemies) this.spawnEnemy(enemy.kind, enemy.x, enemy.y, enemy.angle);
  }

  update(dt: number, input: ReadonlySet<InputAction>) {
    if (this.paused || this.gameOver || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = dt;
    while (remaining > 0 && !this.gameOver) {
      const step = Math.min(remaining, simulation.maxDelta);
      this.updateStep(step, input);
      remaining -= step;
    }
  }

  private updateStep(step: number, input: ReadonlySet<InputAction>) {
    this.timeRemaining = Math.max(0, this.timeRemaining - step);
    if (this.timeRemaining === 0) this.finish('time');
    if (this.gameOver) return;

    this.updatePlayer(step, input);
    this.updateEnemies(step);
    this.updateProjectiles(step);
    this.updateEffects(step);
    this.spawnCooldown -= step;
    if (this.spawnCooldown <= 0) {
      this.spawnRandomEnemy();
      this.spawnCooldown = this.spawnInterval;
    }
  }

  togglePause(force?: boolean) {
    if (!this.gameOver) this.paused = force ?? !this.paused;
  }

  private makeShip(kind: ShipState['kind'], x: number, y: number, angle: number): ShipState {
    const player = kind === 'player';
    return {
      id: this.nextId++, kind, x, y, angle, alive: true, fireCooldown: 0,
      health: player ? playerConfig.maxHealth : enemyConfig.maxHealth,
      maxHealth: player ? playerConfig.maxHealth : enemyConfig.maxHealth,
      radius: player ? playerConfig.radius : enemyConfig.radius,
      fireCooldownDuration: 0,
    };
  }

  private updatePlayer(dt: number, input: ReadonlySet<InputAction>) {
    const ship = this.player;
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
    if (input.has('left')) ship.angle -= playerConfig.rotationSpeed * dt;
    if (input.has('right')) ship.angle += playerConfig.rotationSpeed * dt;
    if (input.has('forward')) this.moveShip(ship, playerConfig.speed * dt);

    if (ship.fireCooldown <= 0) {
      if (input.has('fireFront')) this.fireFront(ship, 'player');
      else if (input.has('fireLeft')) this.fireBroadside(ship, -1);
      else if (input.has('fireRight')) this.fireBroadside(ship, 1);
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dx, -dy);
      const difference = normalizeAngle(targetAngle - enemy.angle);
      enemy.angle += clamp(difference, -enemyConfig.rotationSpeed * dt, enemyConfig.rotationSpeed * dt);

      if (enemy.kind === 'chaser' || distance > enemyConfig.shooterKeepAway) {
        this.moveShip(enemy, enemyConfig.speed * dt);
      }
      if (enemy.kind === 'shooter' && distance < enemyConfig.shooterRange && enemy.fireCooldown <= 0) {
        this.fireFront(enemy, 'enemy');
        enemy.fireCooldown = enemyConfig.fireCooldown;
      }
      if (distance < enemy.radius + this.player.radius) {
        if (enemy.kind === 'chaser') {
          this.damage(this.player, enemyConfig.contactDamage, false, false);
          this.destroyEnemy(enemy, false);
        } else {
          this.separate(enemy, this.player);
        }
      }
    }
    let enemyWriteIndex = 0;
    for (const enemy of this.enemies) if (enemy.alive) this.enemies[enemyWriteIndex++] = enemy;
    this.enemies.length = enemyWriteIndex;
  }

  private updateProjectiles(dt: number) {
    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.lifetime -= dt;
      if (shot.x < 0 || shot.x > arena.width || shot.y < 0 || shot.y > arena.height || this.pointInIsland(shot.x, shot.y)) {
        shot.lifetime = 0;
        this.addEffect('hit', shot.x, shot.y, effects.obstacleHit);
        continue;
      }
      if (shot.owner === 'player') {
        const target = this.enemies.find((enemy) => enemy.alive && distanceSq(shot, enemy) < (enemy.radius + projectile.radius) ** 2);
        if (target) {
          this.damage(target, shot.damage, true);
          shot.lifetime = 0;
        }
      } else if (distanceSq(shot, this.player) < (this.player.radius + projectile.radius) ** 2) {
        this.damage(this.player, shot.damage, false);
        shot.lifetime = 0;
      }
    }
    let projectileWriteIndex = 0;
    for (const shot of this.projectiles) if (shot.lifetime > 0) this.projectiles[projectileWriteIndex++] = shot;
    this.projectiles.length = projectileWriteIndex;
  }

  private updateEffects(dt: number) {
    for (const effect of this.effects) effect.age += dt;
    let effectWriteIndex = 0;
    for (const effect of this.effects) if (effect.age < effect.duration) this.effects[effectWriteIndex++] = effect;
    this.effects.length = effectWriteIndex;
  }

  private fireFront(ship: ShipState, owner: 'player' | 'enemy') {
    const direction = { x: Math.sin(ship.angle), y: -Math.cos(ship.angle) };
    this.createProjectile(
      ship.x + direction.x * projectile.frontLaunchOffset,
      ship.y + direction.y * projectile.frontLaunchOffset,
      direction,
      owner,
    );
    this.addEffect(
      'muzzle',
      ship.x + direction.x * weapons.frontEffectOffset,
      ship.y + direction.y * weapons.frontEffectOffset,
      effects.frontMuzzle,
      'cannon',
    );
    ship.fireCooldown = owner === 'player' ? weapons.frontCooldown : enemyConfig.fireCooldown;
    ship.fireCooldownDuration = ship.fireCooldown;
  }

  private fireBroadside(ship: ShipState, side: -1 | 1) {
    const direction = { x: Math.cos(ship.angle) * side, y: Math.sin(ship.angle) * side };
    const forward = { x: Math.sin(ship.angle), y: -Math.cos(ship.angle) };
    for (const offset of [-weapons.broadsideSpacing, 0, weapons.broadsideSpacing]) {
      this.createProjectile(
        ship.x + direction.x * projectile.broadsideLaunchOffset + forward.x * offset,
        ship.y + direction.y * projectile.broadsideLaunchOffset + forward.y * offset,
        direction,
        'player',
      );
    }
    this.addEffect(
      'muzzle',
      ship.x + direction.x * weapons.broadsideEffectOffset,
      ship.y + direction.y * weapons.broadsideEffectOffset,
      effects.broadsideMuzzle,
      'broadside',
    );
    ship.fireCooldown = weapons.broadsideCooldown;
    ship.fireCooldownDuration = ship.fireCooldown;
  }

  private createProjectile(x: number, y: number, direction: { x: number; y: number }, owner: 'player' | 'enemy') {
    this.projectiles.push({
      id: this.nextId++, x, y, vx: direction.x * projectile.speed, vy: direction.y * projectile.speed,
      owner, damage: owner === 'player' ? projectile.playerDamage : projectile.enemyDamage,
      lifetime: projectile.lifetime,
    });
  }

  private moveShip(ship: ShipState, amount: number) {
    const previousX = ship.x;
    const previousY = ship.y;
    ship.x = clamp(ship.x + Math.sin(ship.angle) * amount, arena.padding, arena.width - arena.padding);
    ship.y = clamp(ship.y - Math.cos(ship.angle) * amount, arena.padding, arena.height - arena.padding);
    if (this.circleHitsIsland(ship.x, ship.y, ship.radius)) {
      ship.x = previousX;
      ship.y = previousY;
    }
  }

  private circleHitsIsland(x: number, y: number, radius: number) {
    return ISLANDS.some((island) => {
      const closestX = clamp(x, island.x, island.x + island.width);
      const closestY = clamp(y, island.y, island.y + island.height);
      return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
    });
  }

  private pointInIsland(x: number, y: number) {
    return ISLANDS.some((island) => x > island.x && x < island.x + island.width && y > island.y && y < island.y + island.height);
  }

  private separate(ship: ShipState, target: ShipState) {
    const angle = Math.atan2(ship.y - target.y, ship.x - target.x);
    ship.x += Math.cos(angle) * enemyConfig.separationDistance;
    ship.y += Math.sin(angle) * enemyConfig.separationDistance;
  }

  private damage(ship: ShipState, amount: number, awardsPoint: boolean, showHitEffect = true) {
    if (!ship.alive || this.gameOver) return;
    ship.health = Math.max(0, ship.health - amount);
    if (showHitEffect) this.addEffect('hit', ship.x, ship.y, effects.hit);
    if (ship.health === 0) {
      if (ship.kind === 'player') {
        ship.alive = false;
        this.addEffect('explosion', ship.x, ship.y, effects.explosion);
        this.finish('sunk');
      } else {
        this.destroyEnemy(ship, awardsPoint);
      }
    }
  }

  private destroyEnemy(enemy: ShipState, awardsPoint: boolean) {
    if (!enemy.alive) return;
    enemy.alive = false;
    if (awardsPoint) this.score += 1;
    this.addEffect('explosion', enemy.x, enemy.y, effects.explosion);
  }

  private addEffect(kind: EffectState['kind'], x: number, y: number, duration: number, sound?: EffectState['sound']) {
    this.effects.push({ id: this.nextId++, kind, x, y, age: 0, duration, sound });
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, angle = spawn.defaultEnemyAngle) {
    this.enemies.push(this.makeShip(kind, x, y, angle));
  }

  private spawnRandomEnemy() {
    const points = spawn.points.filter((point) =>
      distanceSq(point, this.player) > spawn.minimumPlayerDistance ** 2
      && !this.pointInIsland(point.x, point.y));
    const point = points[Math.floor(this.random() * points.length)] ?? spawn.fallbackPoint;
    const kind: EnemyKind = spawn.enemySequence[this.spawnSequenceIndex % spawn.enemySequence.length];
    this.spawnSequenceIndex += 1;
    this.spawnEnemy(kind, point.x, point.y);
  }

  private finish(reason: 'sunk' | 'time') {
    this.gameOver = true;
    this.endReason = reason;
    this.projectiles = [];
  }
}
