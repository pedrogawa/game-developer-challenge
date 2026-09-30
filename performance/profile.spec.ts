import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FramePerformanceReport } from '../src/game/performance';

type MemoryPoint = {
  label: string;
  jsHeapUsedBytes: number;
  jsHeapTotalBytes: number;
  domNodes: number;
  documents: number;
  canvases: number;
};

type ProfileEvidence = {
  capturedAt: string;
  environment: {
    platform: string;
    cpu: string;
    logicalCpuCount: number;
    totalMemoryBytes: number;
    browser: string;
    userAgent: string;
    gpu: string;
    viewport: string;
    deviceScaleFactor: number;
  };
  configuration: { sessionDuration: number; spawnInterval: number; seed: number; playerProtection: boolean };
  combat: FramePerformanceReport;
  memory: {
    samples: MemoryPoint[];
    growthAfterWarmupBytes: number;
    nodeGrowthAfterWarmup: number;
    allowedHeapGrowthBytes: number;
    stable: boolean;
  };
  limitations: string[];
};

const root = process.cwd();
const evidenceDirectory = path.join(root, 'performance', 'evidence');

const primeStorage = async (page: Page) => {
  await page.goto('/?profile=1&seed=1337');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('pirate-battle-player-v1', JSON.stringify({ id: 'performance-captain', name: 'Performance Captain' }));
    localStorage.setItem('pirate-battle-options-v1', JSON.stringify({ sessionDuration: 180, spawnInterval: 2 }));
    localStorage.setItem('pirate-battle-mock-scenario-v1', JSON.stringify({ id: 'success', seed: 1337 }));
  });
  await page.reload();
  await expect(page.getByRole('img', { name: 'Pirate Battle' })).toBeVisible();
};

const startGame = async (page: Page) => {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Loading the fleet…' })).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.__PIRATE_BATTLE_PERFORMANCE__))).toBe(true);
};

const memorySample = async (page: Page, label: string): Promise<MemoryPoint> => {
  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(250);
  await session.send('Performance.enable');
  const response = await session.send('Performance.getMetrics');
  await session.detach();
  const metrics = new Map(response.metrics.map((metric) => [metric.name, metric.value]));
  const browserMemory = await page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    return { used: memory?.usedJSHeapSize ?? 0, total: memory?.totalJSHeapSize ?? 0 };
  });
  return {
    label,
    jsHeapUsedBytes: metrics.get('JSHeapUsedSize') ?? browserMemory.used,
    jsHeapTotalBytes: metrics.get('JSHeapTotalSize') ?? browserMemory.total,
    domNodes: metrics.get('Nodes') ?? 0,
    documents: metrics.get('Documents') ?? 0,
    canvases: await page.locator('canvas').count(),
  };
};

const collectEnvironment = async (browser: Browser, page: Page) => {
  const browserEnvironment = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl && extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'Unavailable';
    return { userAgent: navigator.userAgent, gpu, dpr: window.devicePixelRatio };
  });
  return {
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model ?? 'Unknown',
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    browser: `Chromium ${browser.version()}`,
    userAgent: browserEnvironment.userAgent,
    gpu: browserEnvironment.gpu,
    viewport: '1440x900',
    deviceScaleFactor: browserEnvironment.dpr,
  };
};

const formatBytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(2)} MiB`;
const formatNumber = (value: number) => value.toFixed(2);

const renderMarkdown = (evidence: ProfileEvidence) => {
  const framePass = evidence.combat.averageFps >= 58 && evidence.combat.p95FrameTimeMs <= 25;
  const memoryRows = evidence.memory.samples.map((sample) =>
    `| ${sample.label} | ${formatBytes(sample.jsHeapUsedBytes)} | ${formatBytes(sample.jsHeapTotalBytes)} | ${sample.domNodes} | ${sample.documents} | ${sample.canvases} |`,
  ).join('\n');
  return `# Game performance profile

Generated from the optimized Vite build on ${evidence.capturedAt}.

## Reference environment

- Platform: ${evidence.environment.platform}
- CPU: ${evidence.environment.cpu} (${evidence.environment.logicalCpuCount} logical CPUs)
- System memory: ${formatBytes(evidence.environment.totalMemoryBytes)}
- Browser: ${evidence.environment.browser}
- GPU: ${evidence.environment.gpu}
- Resolution: ${evidence.environment.viewport} at DPR ${evidence.environment.deviceScaleFactor}
- Match: ${evidence.configuration.sessionDuration}s, enemy spawn every ${evidence.configuration.spawnInterval}s, seed ${evidence.configuration.seed}
- Profiling protection: ${evidence.configuration.playerProtection ? 'player health increased so the full three-minute combat can complete' : 'disabled'}

## Three-minute combat

| Metric | Result |
| --- | ---: |
| Average FPS | ${formatNumber(evidence.combat.averageFps)} |
| Average frame time | ${formatNumber(evidence.combat.averageFrameTimeMs)} ms |
| Frame time p95 | ${formatNumber(evidence.combat.p95FrameTimeMs)} ms |
| Frame time p99 | ${formatNumber(evidence.combat.p99FrameTimeMs)} ms |
| Maximum frame time | ${formatNumber(evidence.combat.maximumFrameTimeMs)} ms |
| Frames above 16.67 ms | ${evidence.combat.framesOver16_67Ms} / ${evidence.combat.sampleCount} |
| Frames above 33.33 ms | ${evidence.combat.framesOver33_33Ms} / ${evidence.combat.sampleCount} |
| Measured duration | ${formatNumber(evidence.combat.measuredDurationMs / 1_000)} s |
| Average entities | ${formatNumber(evidence.combat.averageEntities)} |
| Maximum entities | ${evidence.combat.maximumEntities.total} |
| Maximum enemies | ${evidence.combat.maximumEntities.enemies} |
| Maximum projectiles | ${evidence.combat.maximumEntities.projectiles} |
| Maximum effects | ${evidence.combat.maximumEntities.effects} |

60 FPS target status: **${framePass ? 'met' : 'not met'}**. The acceptance window requires an average of at least 58 FPS and uses a 25 ms p95 guardrail to allow measured compositor jitter at 60 Hz; frames above 33.33 ms remain reported separately.

## Five lifecycle cycles

Each post-cycle sample is collected after returning to the menu and requesting a full Chromium garbage collection. The first cycle warms the Pixi asset cache; continuous growth is evaluated from cycle 1 through cycle 5.

| Sample | Used JS heap | Total JS heap | DOM nodes | Documents | Canvas elements |
| --- | ---: | ---: | ---: | ---: | ---: |
${memoryRows}

- Heap growth after warmup: ${formatBytes(evidence.memory.growthAfterWarmupBytes)}
- Allowed measurement tolerance: ${formatBytes(evidence.memory.allowedHeapGrowthBytes)}
- DOM node growth after warmup: ${evidence.memory.nodeGrowthAfterWarmup}
- Lifecycle stability: **${evidence.memory.stable ? 'stable' : 'investigation required'}**

## Applied optimizations

- Reuse Pixi projectile, effect, and enemy display objects instead of destroying and reallocating them during combat.
- Reuse live-entity sets rather than allocating three new sets each frame.
- Redraw enemy health masks and switch health textures only when health actually changes.
- Compact simulation arrays in place instead of allocating filtered arrays every update step.
- Reuse a bounded pool of audio elements and release all active and pooled audio during unmount.
- Cache the static tile map on touch devices, render at DPR 1, and avoid mobile antialiasing.
- Prewarm mobile audio, rate-limit repeated sounds, and avoid duplicate contact effects.
- Keep React HUD synchronization throttled and release the Pixi application, ticker, observers, animation frames, display tree, and custom texture on exit.

## Limitations

${evidence.limitations.map((item) => `- ${item}`).join('\n')}
`;
};

test('profiles three-minute combat and five lifecycle cycles', async ({ browser }) => {
  mkdirSync(evidenceDirectory, { recursive: true });

  const memoryContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const memoryPage = await memoryContext.newPage();
  await primeStorage(memoryPage);
  const memorySamples: MemoryPoint[] = [await memorySample(memoryPage, 'Menu baseline')];
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await startGame(memoryPage);
    await memoryPage.evaluate(() => window.__PIRATE_BATTLE_PERFORMANCE__!.protectPlayer());
    await memoryPage.keyboard.down('Space');
    await memoryPage.waitForTimeout(1_000);
    await memoryPage.keyboard.up('Space');
    await memoryPage.getByRole('button', { name: 'Pause game' }).click();
    await memoryPage.getByRole('button', { name: 'Main Menu' }).click();
    await expect(memoryPage.getByRole('img', { name: 'Pirate Battle' })).toBeVisible();
    memorySamples.push(await memorySample(memoryPage, `After cycle ${cycle}`));
  }
  await memoryContext.close();

  const profileContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const profilePage = await profileContext.newPage();
  await primeStorage(profilePage);
  const environment = await collectEnvironment(browser, profilePage);
  await startGame(profilePage);
  await profilePage.evaluate(() => {
    window.__PIRATE_BATTLE_PERFORMANCE__!.protectPlayer();
    window.__PIRATE_BATTLE_PERFORMANCE__!.reset();
  });
  await profilePage.screenshot({ path: path.join(evidenceDirectory, 'three-minute-combat.png') });
  await profilePage.keyboard.down('a');
  await profilePage.keyboard.down('Space');
  await expect(profilePage.getByRole('heading', { name: 'Battle Complete' })).toBeVisible({ timeout: 190_000 });
  await profilePage.keyboard.up('Space');
  await profilePage.keyboard.up('a');
  const combat = await profilePage.evaluate(() => window.__PIRATE_BATTLE_PERFORMANCE__!.getReport());
  await profileContext.close();

  const firstWarm = memorySamples[1];
  const last = memorySamples.at(-1)!;
  const growthAfterWarmupBytes = last.jsHeapUsedBytes - firstWarm.jsHeapUsedBytes;
  const nodeGrowthAfterWarmup = last.domNodes - firstWarm.domNodes;
  const allowedHeapGrowthBytes = Math.max(5 * 1_048_576, firstWarm.jsHeapUsedBytes * 0.15);
  const memoryStable = growthAfterWarmupBytes <= allowedHeapGrowthBytes
    && nodeGrowthAfterWarmup <= 25
    && memorySamples.slice(1).every((sample) => sample.canvases === 0);
  const evidence: ProfileEvidence = {
    capturedAt: new Date().toISOString(),
    environment,
    configuration: { sessionDuration: 180, spawnInterval: 2, seed: 1337, playerProtection: true },
    combat,
    memory: {
      samples: memorySamples,
      growthAfterWarmupBytes,
      nodeGrowthAfterWarmup,
      allowedHeapGrowthBytes,
      stable: memoryStable,
    },
    limitations: [
      'Headed Chromium is required so the reference run uses the machine GPU; headless Chromium used SwiftShader and was retained only as a diagnostic result.',
      'Forced garbage collection makes lifecycle samples comparable but does not measure GPU-driver allocations directly.',
      'The player receives profiling-only health protection; spawning, AI, projectiles, collisions, effects, audio, rendering, and the real-time ticker remain active.',
      'The Playwright process and Vite preview server add background system load, so results should be compared on the same machine.',
      'The reference display can switch between 60 Hz and 120 Hz; the pass criteria use average FPS plus a 25 ms p95 guardrail so both modes remain comparable.',
    ],
  };
  writeFileSync(path.join(evidenceDirectory, 'latest.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(path.join(root, 'performance', 'REPORT.md'), renderMarkdown(evidence));

  expect(combat.measuredDurationMs).toBeGreaterThan(175_000);
  expect(combat.averageFps).toBeGreaterThanOrEqual(58);
  expect(combat.p95FrameTimeMs).toBeLessThanOrEqual(25);
  expect(memoryStable).toBe(true);
});
