# Headless software-rendering diagnostic

The first optimized-build run on 2026-09-30 used Playwright's headless Chromium 153.0.8010.12. WebGL reported `ANGLE / Vulkan / SwiftShader`, so rendering ran on the CPU instead of the Apple M1 Pro GPU.

- Average FPS: 24.39
- Average frame time: 41.00 ms
- Frame-time p95: 50.10 ms
- Frame-time p99: 83.30 ms
- Maximum entities: 64
- Heap growth after the first lifecycle warmup: 1.06 MiB
- DOM-node growth after warmup: 0
- Canvas elements left after each exit: 0

This run is retained to document the environment limitation and must not be compared with hardware-accelerated browser results. The reference profile uses headed Chromium with GPU acceleration.
