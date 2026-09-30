# Playwright E2E matrix

The desktop Chromium project runs the complete suite. The mobile Chromium project runs the primary touch flow and all three visual regressions. Every test receives a fresh browser context, clears persistent state once at startup, uses a fixed player and seed, and enables the game clock bridge only through `?e2e=1`.

| README §8 | Coverage |
| --- | --- |
| 1, 2, 9 | `menu-and-assets.spec.ts` |
| 3–5 | `gameplay.spec.ts` |
| 6–9 | `lifecycle.spec.ts` |
| 10–12 | `records.spec.ts` |
| Desktop/mobile visual baselines | `visual.spec.ts` |

Run `npm run test:e2e`. Failures retain Playwright traces, screenshots, and video in `test-results/`. Open the generated report with `npm run test:e2e:report`. Update intentional visual changes with `npm run test:e2e:update`.

## Latest verified run

The full matrix was last verified on 2026-09-30: **27 passed, 1 intentionally skipped**. The skip is the portrait-only mobile orientation case in the desktop project; the same case passes in the mobile project. The current HTML result is versioned at [`../playwright-report/index.html`](../playwright-report/index.html).
