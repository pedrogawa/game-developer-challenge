# Game performance profile

Generated from the optimized Vite build on 2026-09-30T21:39:07.737Z.

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
| Average FPS | 58.48 |
| Average frame time | 17.10 ms |
| Frame time p95 | 24.10 ms |
| Frame time p99 | 25.00 ms |
| Maximum frame time | 91.80 ms |
| Frames above 16.67 ms | 6273 / 10527 |
| Frames above 33.33 ms | 2 / 10527 |
| Measured duration | 180.00 s |
| Average entities | 32.93 |
| Maximum entities | 60 |
| Maximum enemies | 48 |
| Maximum projectiles | 7 |
| Maximum effects | 8 |

60 FPS target status: **met**. The acceptance window requires an average of at least 58 FPS and uses a 25 ms p95 guardrail to allow measured compositor jitter at 60 Hz; frames above 33.33 ms remain reported separately.

## Five lifecycle cycles

Each post-cycle sample is collected after returning to the menu and requesting a full Chromium garbage collection. The first cycle warms the Pixi asset cache; continuous growth is evaluated from cycle 1 through cycle 5.

| Sample | Used JS heap | Total JS heap | DOM nodes | Documents | Canvas elements |
| --- | ---: | ---: | ---: | ---: | ---: |
| Menu baseline | 4.54 MiB | 5.84 MiB | 126 | 2 | 0 |
| After cycle 1 | 7.30 MiB | 8.34 MiB | 158 | 2 | 0 |
| After cycle 2 | 7.61 MiB | 8.84 MiB | 158 | 2 | 0 |
| After cycle 3 | 8.03 MiB | 8.84 MiB | 158 | 2 | 0 |
| After cycle 4 | 8.23 MiB | 9.09 MiB | 158 | 2 | 0 |
| After cycle 5 | 8.52 MiB | 9.09 MiB | 158 | 2 | 0 |

- Heap growth after warmup: 1.22 MiB
- Allowed measurement tolerance: 5.00 MiB
- DOM node growth after warmup: 0
- Lifecycle stability: **stable**

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

- Headed Chromium is required so the reference run uses the machine GPU; headless Chromium used SwiftShader and was retained only as a diagnostic result.
- Forced garbage collection makes lifecycle samples comparable but does not measure GPU-driver allocations directly.
- The player receives profiling-only health protection; spawning, AI, projectiles, collisions, effects, audio, rendering, and the real-time ticker remain active.
- The Playwright process and Vite preview server add background system load, so results should be compared on the same machine.
- The reference display can switch between 60 Hz and 120 Hz; the pass criteria use average FPS plus a 25 ms p95 guardrail so both modes remain comparable.
