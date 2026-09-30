# Game performance profile

Generated from the optimized Vite build on 2026-09-30T11:18:24.876Z.

## Reference environment

- Platform: darwin 24.5.0 (arm64)
- CPU: Apple M1 Pro (8 logical CPUs)
- System memory: 16384.00 MiB
- Browser: Chromium 153.0.8010.12
- GPU: ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)
- Resolution: 1440x900 at DPR 1
- Match: 180s, enemy spawn every 2s, seed 1337
- Profiling protection: player health increased so the full three-minute combat can complete

## Three-minute combat

| Metric | Result |
| --- | ---: |
| Average FPS | 119.94 |
| Average frame time | 8.34 ms |
| Frame time p95 | 9.20 ms |
| Frame time p99 | 9.30 ms |
| Maximum frame time | 108.60 ms |
| Frames above 16.67 ms | 1 / 21572 |
| Frames above 33.33 ms | 1 / 21572 |
| Measured duration | 179.86 s |
| Average entities | 33.15 |
| Maximum entities | 62 |
| Maximum enemies | 46 |
| Maximum projectiles | 8 |
| Maximum effects | 10 |

60 FPS target status: **met**. The acceptance window treats an average of at least 58 FPS and p95 at or below 20 ms as stable 60 Hz delivery.

## Five lifecycle cycles

Each post-cycle sample is collected after returning to the menu and requesting a full Chromium garbage collection. The first cycle warms the Pixi asset cache; continuous growth is evaluated from cycle 1 through cycle 5.

| Sample | Used JS heap | Total JS heap | DOM nodes | Documents | Canvas elements |
| --- | ---: | ---: | ---: | ---: | ---: |
| Menu baseline | 4.52 MiB | 5.09 MiB | 125 | 2 | 0 |
| After cycle 1 | 7.24 MiB | 8.09 MiB | 157 | 2 | 0 |
| After cycle 2 | 7.52 MiB | 8.59 MiB | 157 | 2 | 0 |
| After cycle 3 | 7.75 MiB | 8.59 MiB | 157 | 2 | 0 |
| After cycle 4 | 7.95 MiB | 8.59 MiB | 157 | 2 | 0 |
| After cycle 5 | 8.19 MiB | 8.84 MiB | 157 | 2 | 0 |

- Heap growth after warmup: 0.95 MiB
- Allowed measurement tolerance: 5.00 MiB
- DOM node growth after warmup: 0
- Lifecycle stability: **stable**

## Applied optimizations

- Reuse Pixi projectile, effect, and enemy display objects instead of destroying and reallocating them during combat.
- Reuse live-entity sets rather than allocating three new sets each frame.
- Redraw enemy health masks and switch health textures only when health actually changes.
- Compact simulation arrays in place instead of allocating filtered arrays every update step.
- Reuse a bounded pool of audio elements and release all active and pooled audio during unmount.
- Keep React HUD synchronization throttled and release the Pixi application, ticker, observers, animation frames, display tree, and custom texture on exit.

## Limitations

- Headed Chromium is required so the reference run uses the machine GPU; headless Chromium used SwiftShader and was retained only as a diagnostic result.
- Forced garbage collection makes lifecycle samples comparable but does not measure GPU-driver allocations directly.
- The player receives profiling-only health protection; spawning, AI, projectiles, collisions, effects, audio, rendering, and the real-time ticker remain active.
- The Playwright process and Vite preview server add background system load, so results should be compared on the same machine.
