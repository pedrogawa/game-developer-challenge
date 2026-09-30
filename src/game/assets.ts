export const ASSETS = {
  waterSheet: '/tilesheet/tiles_sheet.png',
  islandTiles: [6, 7, 8, 9, 22, 23, 24, 25, 38, 39, 40, 41, 54, 55, 56, 57]
    .map((id) => `/png/default/tiles/tile_${id}.png`),
  islandDecorations: [49, 50, 51, 65, 66, 67, 70, 71, 72]
    .map((id) => `/png/default/tiles/tile_${id}.png`),
  player: '/png/default/ships/ship_11.png',
  chaser: '/png/default/ships/ship_2.png',
  shooter: '/png/default/ships/ship_18.png',
  cannonBall: '/png/default/ship_parts/cannon_ball.png',
  explosion: ['/png/default/effects/explosion_1.png', '/png/default/effects/explosion_2.png', '/png/default/effects/explosion_3.png'],
  fire: ['/png/default/effects/fire_1.png', '/png/default/effects/fire_2.png'],
  enemyHealth: {
    frame: '/png/default/ui/hud/enemy_health_frame.png',
    green: '/png/default/ui/hud/enemy_health_fill_green.png',
    red: '/png/default/ui/hud/enemy_health_fill_red.png',
  },
  sounds: {
    cannon: '/sounds/cannon_fire_1.wav',
    broadside: '/sounds/cannon_broadside.wav',
    hit: '/sounds/ship_wood_hit_1.wav',
    explosion: '/sounds/ship_explosion_1.wav',
    ambience: '/sounds/ocean_ambience_loop.wav',
    gameStart: '/sounds/game_start.wav',
    gameComplete: '/sounds/game_complete.wav',
    gameOver: '/sounds/game_over.wav',
    gamePause: '/sounds/game_pause.wav',
    gameResume: '/sounds/game_resume.wav',
    healthLow: '/sounds/health_low.wav',
    score: '/sounds/score_point.wav',
  },
} as const;

export const ALL_TEXTURES = [
  ASSETS.waterSheet,
  ...ASSETS.islandTiles,
  ...ASSETS.islandDecorations,
  ASSETS.player,
  ASSETS.chaser,
  ASSETS.shooter,
  ASSETS.cannonBall,
  ...ASSETS.explosion,
  ...ASSETS.fire,
  ASSETS.enemyHealth.frame,
  ASSETS.enemyHealth.green,
  ASSETS.enemyHealth.red,
];
