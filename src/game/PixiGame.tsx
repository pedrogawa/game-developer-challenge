import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { ALL_TEXTURES, ASSETS } from './assets';
import { GAME_CONFIG, ISLANDS } from './config';
import type { GameOptions } from './config';
import { GameSimulation } from './simulation';
import { createSeededRandom, installGameTestBridge, isE2EMode } from './testing';
import { installPerformanceBridge, isPerformanceMode } from './performance';
import type { EffectState, GameSnapshot, InputAction, ProjectileState, ShipState } from './types';

type Props = {
  restartToken: number;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onLoadProgress: (progress: number) => void;
  onLoaded: () => void;
  onLoadError: (message: string) => void;
  inputRef: React.MutableRefObject<Set<InputAction>>;
  pauseRequest: number;
  gameOptions: GameOptions;
  suspended: boolean;
};

type ShipView = {
  root: Container;
  sprite: Sprite;
  health: Container | null;
  healthFill: Sprite | null;
  healthMask: Graphics | null;
  fire: Sprite;
  lastHealthRatio: number;
  lastHealthTone: 'green' | 'red' | null;
};

const shipTexture = (ship: ShipState) =>
  ship.kind === 'player' ? ASSETS.player : ship.kind === 'chaser' ? ASSETS.chaser : ASSETS.shooter;

export function PixiGame({ restartToken, onSnapshot, onLoadProgress, onLoaded, onLoadError, inputRef, pauseRequest, gameOptions, suspended }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<GameSimulation | null>(null);
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  useEffect(() => {
    const simulation = simulationRef.current;
    if (simulation && pauseRequest > 0) {
      simulation.togglePause();
      inputRef.current.clear();
      onSnapshot({
        health: simulation.player.health,
        maxHealth: simulation.player.maxHealth,
        fireCooldown: simulation.player.fireCooldown,
        fireCooldownDuration: simulation.player.fireCooldownDuration,
        score: simulation.score,
        timeRemaining: simulation.timeRemaining,
        paused: simulation.paused,
        gameOver: simulation.gameOver,
        endReason: simulation.endReason,
      });
    }
  }, [pauseRequest, inputRef, onSnapshot]);

  useEffect(() => {
    let disposed = false;
    let app: Application | null = null;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let tickHandler: ((ticker: Ticker) => void) | null = null;
    let waterTexture: Texture | null = null;
    let cachedMapLayer: Container | null = null;
    let snapshotAccumulator = 0;
    let finalSnapshotSent = false;
    let removeTestBridge: (() => void) | null = null;
    let removePerformanceBridge: (() => void) | null = null;
    let recordPerformanceFrame: ((elapsedMs: number) => void) | null = null;
    const shipViews = new Map<number, ShipView>();
    const projectileViews = new Map<number, Sprite>();
    const effectViews = new Map<number, Sprite>();
    const enemyViewPool: ShipView[] = [];
    const projectileViewPool: Sprite[] = [];
    const effectViewPool: Sprite[] = [];
    const liveShipIds = new Set<number>();
    const liveProjectileIds = new Set<number>();
    const liveEffectIds = new Set<number>();
    const activeAudio = new Set<HTMLAudioElement>();
    const audioPool = new Map<string, HTMLAudioElement[]>();
    const inputState = inputRef.current;
    const e2eMode = isE2EMode();
    const performanceMode = isPerformanceMode();
    const mobileRenderer = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const snapshotInterval = mobileRenderer ? 0.2 : 0.1;
    const soundCooldowns = new Map<string, number>();
    const requestedSeed = Number(new URLSearchParams(window.location.search).get('seed') ?? 1337);
    const simulation = new GameSimulation(gameOptions, e2eMode || performanceMode ? createSeededRandom(requestedSeed) : Math.random);
    simulationRef.current = simulation;
    let previousPaused = false;
    let previousGameOver = false;
    let previousHealth = simulation.player.health;
    let previousScore = simulation.score;

    const playSound = (source: string, volume: number, loop = false) => {
      if (e2eMode) return null;
      const now = performance.now();
      if (mobileRenderer && !loop && now - (soundCooldowns.get(source) ?? -Infinity) < 90) return null;
      if (mobileRenderer && !loop && activeAudio.size >= 6) return null;
      soundCooldowns.set(source, now);
      const pooled = audioPool.get(source);
      const audio = pooled?.pop() ?? new Audio(source);
      audio.preload = 'auto';
      audio.volume = volume;
      audio.loop = loop;
      try { audio.currentTime = 0; } catch { /* Metadata may still be loading on iOS. */ }
      activeAudio.add(audio);
      const releaseAudio = () => {
        if (!activeAudio.delete(audio) || loop) return;
        audio.onended = null;
        audio.onerror = null;
        const sourcePool = audioPool.get(source) ?? [];
        if (sourcePool.length < 8) sourcePool.push(audio);
        audioPool.set(source, sourcePool);
      };
      if (!loop) audio.onended = releaseAudio;
      audio.onerror = releaseAudio;
      void audio.play().catch(releaseAudio);
      return audio;
    };

    const primeAudioPool = () => {
      if (e2eMode) return;
      for (const source of new Set(Object.values(ASSETS.sounds))) {
        const audio = new Audio(source);
        audio.preload = 'auto';
        audio.load();
        audioPool.set(source, [audio]);
      }
    };

    const start = async () => {
      try {
        primeAudioPool();
        app = new Application();
        await app.init({
          width: GAME_CONFIG.arena.width,
          height: GAME_CONFIG.arena.height,
          resizeTo: hostRef.current ?? window,
          background: '#28afd0',
          antialias: !mobileRenderer,
          autoDensity: true,
          resolution: mobileRenderer ? 1 : Math.min(window.devicePixelRatio, 2),
          preference: 'webgl',
          powerPreference: 'high-performance',
        });
        app.stage.eventMode = 'none';
        app.ticker.maxFPS = 60;
        app.ticker.minFPS = 30;
        initialized = true;
        if (disposed || !hostRef.current) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        app.canvas.setAttribute('aria-label', 'Pirate battle arena');
        app.canvas.setAttribute('role', 'img');
        hostRef.current.appendChild(app.canvas);

        if (e2eMode && sessionStorage.getItem('pirate-battle-e2e-fail-assets-once') === '1') {
          sessionStorage.removeItem('pirate-battle-e2e-fail-assets-once');
          throw new Error('Simulated asset loading failure.');
        }
        await Assets.load(ALL_TEXTURES, (progress) => {
          if (!disposed) onLoadProgress(progress);
        });
        if (disposed || !app) return;

        const world = new Container();
        app.stage.addChild(world);
        const mapLayer = new Container();
        world.addChild(mapLayer);
        waterTexture = buildMap(mapLayer);
        if (mobileRenderer) {
          mapLayer.cacheAsTexture({ resolution: 1, antialias: false });
          cachedMapLayer = mapLayer;
        }
        const entityLayer = new Container();
        world.addChild(entityLayer);
        let worldScale = 1;
        const fitWorldToViewport = () => {
          if (!app) return;
          worldScale = Math.max(
            app.screen.width / GAME_CONFIG.arena.width,
            app.screen.height / GAME_CONFIG.arena.height,
          );
          world.scale.set(worldScale);
        };
        const updateCamera = () => {
          if (!app) return;
          const visibleWidth = app.screen.width / worldScale;
          const visibleHeight = app.screen.height / worldScale;
          const halfWidth = visibleWidth / 2;
          const halfHeight = visibleHeight / 2;
          const cameraX = visibleWidth >= GAME_CONFIG.arena.width
            ? GAME_CONFIG.arena.width / 2
            : Math.max(halfWidth, Math.min(GAME_CONFIG.arena.width - halfWidth, simulation.player.x));
          const cameraY = visibleHeight >= GAME_CONFIG.arena.height
            ? GAME_CONFIG.arena.height / 2
            : Math.max(halfHeight, Math.min(GAME_CONFIG.arena.height - halfHeight, simulation.player.y));
          world.position.set(
            app.screen.width / 2 - cameraX * worldScale,
            app.screen.height / 2 - cameraY * worldScale,
          );
        };
        fitWorldToViewport();
        updateCamera();
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = null;
            if (disposed) return;
            fitWorldToViewport();
            updateCamera();
          });
        });
        resizeObserver.observe(hostRef.current);
        playSound(ASSETS.sounds.ambience, 0.1, true);
        playSound(ASSETS.sounds.gameStart, 0.24);
        onLoaded();

        const syncShip = (ship: ShipState) => {
          let view = shipViews.get(ship.id);
          if (!view) {
            view = ship.kind === 'player' ? undefined : enemyViewPool.pop();
            if (view) {
              view.sprite.texture = Texture.from(shipTexture(ship));
              view.root.visible = true;
              if (view.health) view.health.visible = true;
              view.lastHealthRatio = -1;
              view.lastHealthTone = null;
            } else {
              const root = new Container();
              const sprite = Sprite.from(shipTexture(ship));
              sprite.anchor.set(0.5);
              const maxSize = ship.kind === 'player' ? 75 : 69;
              sprite.scale.set(maxSize / Math.max(sprite.texture.width, sprite.texture.height));
              const fire = Sprite.from(ASSETS.fire[0]);
              fire.anchor.set(0.5);
              fire.scale.set(0.42);
              fire.y = 8;
              fire.visible = false;
              let health: Container | null = null;
              let healthFill: Sprite | null = null;
              let healthMask: Graphics | null = null;
              root.addChild(sprite, fire);
              entityLayer.addChild(root);
              if (ship.kind !== 'player') {
                health = new Container();
                healthFill = Sprite.from(ASSETS.enemyHealth.green);
                healthFill.anchor.set(0.5);
                healthFill.scale.set(0.35);
                const healthFrame = Sprite.from(ASSETS.enemyHealth.frame);
                healthFrame.anchor.set(0.5);
                healthFrame.scale.set(0.35);
                healthMask = new Graphics();
                healthFill.mask = healthMask;
                health.addChild(healthFrame, healthFill, healthMask);
                entityLayer.addChild(health);
              }
              view = { root, sprite, fire, health, healthFill, healthMask, lastHealthRatio: -1, lastHealthTone: null };
            }
            shipViews.set(ship.id, view);
          }
          view.root.position.set(ship.x, ship.y);
          view.root.rotation = ship.angle;
          view.sprite.alpha = ship.alive ? 1 : 0;
          view.fire.visible = ship.alive && ship.health / ship.maxHealth < 0.45;
          view.fire.rotation = -ship.angle;
          if (view.health && view.healthFill && view.healthMask) {
            view.health.position.set(ship.x, ship.y - 42);
            view.health.visible = ship.alive;
            const ratio = ship.health / ship.maxHealth;
            const tone = ratio > 0.35 ? 'green' : 'red';
            if (view.lastHealthTone !== tone) {
              view.healthFill.texture = Texture.from(tone === 'green' ? ASSETS.enemyHealth.green : ASSETS.enemyHealth.red);
              view.lastHealthTone = tone;
            }
            if (view.lastHealthRatio !== ratio) {
              view.healthMask.clear().rect(-28, -7, 56 * ratio, 14).fill(0xffffff);
              view.lastHealthRatio = ratio;
            }
          }
        };

        const syncProjectile = (shot: ProjectileState) => {
          let sprite = projectileViews.get(shot.id);
          if (!sprite) {
            sprite = projectileViewPool.pop() ?? Sprite.from(ASSETS.cannonBall);
            if (sprite.anchor.x !== 0.5) sprite.anchor.set(0.5);
            if (sprite.scale.x !== 0.44) sprite.scale.set(0.44);
            sprite.visible = true;
            sprite.tint = shot.owner === 'player' ? 0xffffff : 0xff9b62;
            projectileViews.set(shot.id, sprite);
            entityLayer.addChild(sprite);
          }
          sprite.position.set(shot.x, shot.y);
        };

        const syncEffect = (effect: EffectState) => {
          let sprite = effectViews.get(effect.id);
          if (!sprite) {
            const texture = effect.kind === 'explosion' ? ASSETS.explosion[0] : effect.kind === 'muzzle' ? ASSETS.fire[1] : ASSETS.explosion[2];
            sprite = effectViewPool.pop() ?? Sprite.from(texture);
            sprite.texture = Texture.from(texture);
            if (sprite.anchor.x !== 0.5) sprite.anchor.set(0.5);
            sprite.visible = true;
            sprite.rotation = 0;
            sprite.scale.set(effect.kind === 'explosion' ? 0.62 : 0.23);
            effectViews.set(effect.id, sprite);
            const sound = effect.kind === 'explosion'
              ? ASSETS.sounds.explosion
              : effect.kind === 'muzzle'
                ? ASSETS.sounds[effect.sound ?? 'cannon']
                : ASSETS.sounds.hit;
            playSound(sound, effect.kind === 'hit' ? 0.18 : 0.28);
          }
          sprite.position.set(effect.x, effect.y);
          sprite.rotation += 0.08;
          sprite.alpha = 1 - effect.age / effect.duration;
          sprite.scale.set((effect.kind === 'explosion' ? 0.62 : 0.23) * (0.7 + effect.age / effect.duration * 0.5));
        };

        const emitSnapshot = () => onSnapshot({
          health: simulation.player.health,
          maxHealth: simulation.player.maxHealth,
          fireCooldown: simulation.player.fireCooldown,
          fireCooldownDuration: simulation.player.fireCooldownDuration,
          score: simulation.score,
          timeRemaining: simulation.timeRemaining,
          paused: simulation.paused,
          gameOver: simulation.gameOver,
          endReason: simulation.endReason,
        });

        const renderFrame = (forceSnapshot = false, dt = 0) => {
          if (simulation.paused !== previousPaused) {
            playSound(simulation.paused ? ASSETS.sounds.gamePause : ASSETS.sounds.gameResume, 0.24);
            previousPaused = simulation.paused;
          }
          if (simulation.score > previousScore) {
            playSound(ASSETS.sounds.score, 0.22);
            previousScore = simulation.score;
          }
          if (simulation.player.health <= simulation.player.maxHealth * 0.3
            && previousHealth > simulation.player.maxHealth * 0.3) {
            playSound(ASSETS.sounds.healthLow, 0.24);
          }
          previousHealth = simulation.player.health;
          if (simulation.gameOver && !previousGameOver) {
            playSound(simulation.endReason === 'sunk' ? ASSETS.sounds.gameOver : ASSETS.sounds.gameComplete, 0.3);
            previousGameOver = true;
          }
          updateCamera();
          syncShip(simulation.player);
          simulation.enemies.forEach(syncShip);
          simulation.projectiles.forEach(syncProjectile);
          simulation.effects.forEach(syncEffect);

          liveShipIds.clear();
          liveShipIds.add(simulation.player.id);
          for (const enemy of simulation.enemies) liveShipIds.add(enemy.id);
          for (const [id, view] of shipViews) if (!liveShipIds.has(id) && id !== simulation.player.id) {
            view.root.visible = false;
            if (view.health) view.health.visible = false;
            enemyViewPool.push(view);
            shipViews.delete(id);
          }
          liveProjectileIds.clear();
          for (const shot of simulation.projectiles) liveProjectileIds.add(shot.id);
          for (const [id, sprite] of projectileViews) if (!liveProjectileIds.has(id)) {
            sprite.visible = false;
            projectileViewPool.push(sprite);
            projectileViews.delete(id);
          }
          liveEffectIds.clear();
          for (const effect of simulation.effects) liveEffectIds.add(effect.id);
          for (const [id, sprite] of effectViews) if (!liveEffectIds.has(id)) {
            sprite.visible = false;
            effectViewPool.push(sprite);
            effectViews.delete(id);
          }

          snapshotAccumulator += dt;
          if (simulation.gameOver && !finalSnapshotSent) {
            finalSnapshotSent = true;
            snapshotAccumulator = 0;
            emitSnapshot();
          } else if (forceSnapshot || (!simulation.gameOver && snapshotAccumulator >= snapshotInterval)) {
            snapshotAccumulator = 0;
            emitSnapshot();
          }
        };
        if (e2eMode) removeTestBridge = installGameTestBridge(simulation, inputState, renderFrame);
        if (performanceMode) {
          const performanceBridge = installPerformanceBridge(simulation);
          recordPerformanceFrame = performanceBridge.record;
          removePerformanceBridge = performanceBridge.remove;
        }
        tickHandler = (ticker: Ticker) => {
          if (!app) return;
          app.stage.visible = !suspendedRef.current;
          if (suspendedRef.current) return;
          const dt = e2eMode ? 0 : ticker.deltaMS / 1000;
          simulation.update(dt, inputState);
          renderFrame(false, dt);
          recordPerformanceFrame?.(ticker.elapsedMS);
        };
        app.ticker.add(tickHandler);
      } catch (error) {
        if (!disposed) onLoadError(error instanceof Error ? error.message : 'Unable to load game assets.');
      }
    };

    void start();
    return () => {
      disposed = true;
      simulationRef.current = null;
      removeTestBridge?.();
      removePerformanceBridge?.();
      inputState.clear();
      resizeObserver?.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      for (const audio of activeAudio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      activeAudio.clear();
      for (const pool of audioPool.values()) for (const audio of pool) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      audioPool.clear();
      if (tickHandler && app) app.ticker.remove(tickHandler);
      cachedMapLayer?.cacheAsTexture(false);
      if (initialized) app?.destroy({ removeView: true }, { children: true });
      waterTexture?.destroy(false);
    };
  }, [restartToken, inputRef, onLoadError, onLoadProgress, onLoaded, onSnapshot, gameOptions]);

  return <div className="pixi-host" ref={hostRef} />;
}

function buildMap(stage: Container): Texture {
  const { width, height } = GAME_CONFIG.arena;
  // The water texture occupies column 9, row 5 of the supplied 64px tilesheet.
  const sheet = Texture.from(ASSETS.waterSheet);
  const waterTexture = new Texture({ source: sheet.source, frame: new Rectangle(512, 256, 64, 64) });
  for (let y = 0; y < height; y += 64) {
    for (let x = 0; x < width; x += 64) {
      const tile = new Sprite(waterTexture);
      tile.position.set(x, y);
      stage.addChild(tile);
    }
  }

  for (const [islandIndex, island] of ISLANDS.entries()) {
    const cols = 4;
    const rows = 4;
    const scaleX = island.width / (cols * 64);
    const scaleY = island.height / (rows * 64);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = Sprite.from(ASSETS.islandTiles[row * cols + col]);
        tile.position.set(island.x + col * 64 * scaleX, island.y + row * 64 * scaleY);
        tile.scale.set(scaleX, scaleY);
        stage.addChild(tile);
      }
    }
    addIslandDecorations(stage, island, islandIndex);
  }

  const label = new Text({
    text: 'PIRATE WATERS',
    style: { fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 4, dropShadow: { color: 0x063f57, distance: 2, blur: 2 } },
  });
  label.position.set(518, 635);
  label.alpha = 0.55;
  stage.addChild(label);
  return waterTexture;
}

function addIslandDecorations(
  stage: Container,
  island: (typeof ISLANDS)[number],
  islandIndex: number,
) {
  // Seeded variety keeps screenshots and tests stable while making each coast feel different.
  let seed = 7301 + islandIndex * 1297;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const decorationCount = island.visual === 'strip' ? 3 : 5;
  let placed = 0;
  let attempts = 0;

  while (placed < decorationCount && attempts < decorationCount * 12) {
    attempts += 1;
    const edge = Math.floor(random() * 4);
    const alongEdge = 0.2 + random() * 0.6;
    const sandInset = 0.1 + random() * 0.07;
    let x = island.x + island.width * alongEdge;
    let y = island.y + island.height * alongEdge;

    if (edge === 0) y = island.y + island.height * sandInset;
    if (edge === 1) x = island.x + island.width * (1 - sandInset);
    if (edge === 2) y = island.y + island.height * (1 - sandInset);
    if (edge === 3) x = island.x + island.width * sandInset;
    if (x < 24 || x > GAME_CONFIG.arena.width - 24 || y < 24 || y > GAME_CONFIG.arena.height - 24) {
      continue;
    }

    const decorationIndex = placed % 2 === 0
      ? 6 + Math.floor(random() * 3)
      : Math.floor(random() * 6);

    const decoration = Sprite.from(ASSETS.islandDecorations[decorationIndex]);
    decoration.anchor.set(0.5);
    decoration.position.set(x, y);
    decoration.rotation = (random() - 0.5) * 0.35;
    decoration.scale.set(0.55 + random() * 0.28);
    stage.addChild(decoration);
    placed += 1;
  }
}
