# Pirate Battle architecture

## React and PixiJS integration

React owns application state and document UI: the main menu, Options, Ranking, Match History, loading and error states, the HUD, keyboard and touch input, orientation blocking, pause, and the result dialog. `PixiGame` is mounted only for an active match and owns the PixiJS `Application`, stage, camera, map, ships, projectiles, effects, and audio.

The boundary between both layers is deliberately small:

- React passes an immutable `GameOptions` snapshot, a semantic `Set<InputAction>`, pause/restart requests, and whether rendering is suspended.
- `PixiGame` owns `GameSimulation` and sends React a throttled `GameSnapshot` containing health, score, remaining time, pause/result state, and weapon cooldown. A terminal snapshot is emitted once.
- Gameplay input is expressed as actions rather than screen coordinates, so keyboard, touch, camera movement, and viewport resizing all use the same rules.
- React HUD updates are kept outside live regions. A separate semantic status announces only meaningful events such as damage, scoring, pause, and match completion.

Desktop renders with antialiasing and at most 2× device density. Touch devices use a 1× non-antialiased WebGL framebuffer and cache the static tile map as one texture. A cover transform fills the viewport while the player-following camera remains clamped to the arena. Touch gameplay is landscape-only; portrait mode makes the arena inert, suspends the ticker work, and presents an accessible rotation prompt without recreating the match.

## Simulation lifecycle

`GameSimulation` is independent of React and Pixi display objects. Every ticker update receives elapsed seconds and the current input snapshot. It consumes the complete elapsed interval in substeps of at most 50 ms, which keeps movement and collision checks stable after a slow frame without discarding match time.

Each substep performs, in order:

1. Reduce the match timer and every active weapon cooldown.
2. Apply player rotation, forward movement, and requested fire actions.
3. Update Chaser and Shooter AI, including steering, separation, and enemy fire.
4. Move projectiles and expire those outside their lifetime or arena.
5. Resolve ship, island, projectile, and contact collisions.
6. Advance effects, compact dead entities in place, and schedule deterministic spawns.
7. End the match once time reaches zero or the player ship is destroyed.

Pause, focus loss, portrait blocking, menus, and completed matches suspend both simulation and dynamic scene work. Resuming does not replay elapsed time or retain pressed controls. A new match creates a new immutable option snapshot and simulation instance.

## Collision model

Moving ships and projectiles use circular bounds; islands use axis-aligned rectangles derived from the tile map. Ship movement is accepted only when the candidate position stays inside the arena and does not intersect an island. Projectiles are removed on their first ship hit, obstacle hit, lifetime expiry, or arena exit, preventing duplicate damage and unbounded entity growth.

Chasers damage the player on contact and destroy themselves without awarding a point. The contact produces one explosion instead of stacking a hit effect at the same coordinates. Shooters separate on contact, maintain range, rotate toward the player, and fire with their own cooldown. Player-owned projectiles can score a destroyed enemy only once.

## Resource management

All visual and audio paths come from the supplied `assets/` directory. The arena uses the supplied 64×64 water and full 4×4 coast tile set: sand forms every island edge, grass stays inside, and seeded rocks/plants decorate sand without making visual tests nondeterministic. HUD panels, controls, icons, and enemy health bars use the supplied UI exports.

Enemy, projectile, effect, and audio views are pooled and reused. Live-ID sets are cleared and reused per frame, health masks change only when health changes, and simulation arrays compact in place. On touch devices audio is prewarmed, rate-limited per sound, and capped at six simultaneous instances. The shared weapon cooldown is exposed to React as a ratio; touch fire buttons draw a receding overlay and reject taps during cooldown before pointer capture.

Unmount/restart disposes the ticker callback, Pixi application and display tree, generated water texture, cached map texture, resize observer, pending animation frame, active and pooled audio, keyboard listeners, test/profiling bridges, and input state. Async initialization checks a disposal guard before attaching loaded resources, including during React Strict Mode's development lifecycle.

## Local persistence

The solution needs no account, secret, database, or private service. It persists demonstration data in browser `localStorage`:

| Key | Contents |
| --- | --- |
| `pirate-battle-player-v1` | Stable player ID and validated 2–20 character captain name |
| `pirate-battle-options-v1` | Session duration and spawn interval |
| `pirate-battle-last-match-v1` | Last player-confirmed completed match |
| `pirate-battle-pending-matches-v1` | Bounded outbox of up to 100 pending registrations |
| `pirate-battle-api-matches-v1` | Matches confirmed by the local MSW API |
| `pirate-battle-mock-scenario-v1` | Selected deterministic network scenario and seed |

Stored values are parsed defensively and invalid values fall back to safe defaults. Starting a match copies options so later edits cannot mutate an active battle. A completed simulation first produces an immutable result draft; it is persisted and submitted only after the player confirms the captain name. Abandoned and unconfirmed matches are not recorded.

## Ranking and Match History

The REST-shaped data model is declared in `src/data/contracts.ts`:

- `PlayerIdentity` identifies the local player.
- `MatchRecord` contains match/player IDs, captain name, timestamp, score, effective duration, end reason, and the exact `GameOptions` snapshot.
- `RankingRecord` adds the calculated rank.
- `PaginatedResponse<T>`, `RankingParams`, and `HistoryParams` define pagination and filters.
- `RegisterMatchRequest`/`RegisterMatchResponse` define idempotent registration; `PendingMatch` records outbox attempts.

Axios uses a scoped `/api` client with a six-second timeout and forwards cancellation signals. MSW implements that API in development and the public production build, while `setupServer` exposes the same handlers to Vitest. Registration is idempotent by `matchId`: a retry returns the existing record with `created: false` and cannot duplicate Ranking or History entries. Ranking filters by the exact duration/spawn configuration and orders by score, effective duration, timestamp, and match ID. History is scoped to the persistent player ID. Both endpoints paginate at the API boundary.

TanStack Query keys isolate Ranking by page, page size, and gameplay configuration, and History by player, page, and page size. Pagination retains prior data only within the compatible query family. Queries are stale on revisit, forward abort signals, and are invalidated after successful registration. Request tracking prevents a slower older request from overwriting newer data.

Before every POST, the completed match is placed in the persistent outbox and its attempt metadata is updated. Success removes it and invalidates Ranking and History caches. Transient failure leaves it available through **Retry save** on the result or **Retry sync** elsewhere. Recovery also runs on application startup and the browser `online` event, with a single-flight guard preventing concurrent flushes. Legacy completed-match storage is migrated into the same outbox. Deterministic MSW scenarios cover offline registration, timeout after server commit, out-of-order responses, network errors, HTTP errors, slowness, empty data, and multiple pages.

## Testing and profiling reports

The reproducible commands and versioned evidence are:

- `npm run validate`: strict TypeScript, ESLint, Vitest, production build, and the full Playwright matrix.
- `npm run test:e2e`: desktop Chromium coverage plus the primary mobile flow and desktop/mobile visual regressions. The coverage map is in [`e2e/README.md`](e2e/README.md), and the generated HTML report is versioned at [`playwright-report/index.html`](playwright-report/index.html).
- `npm run test:performance`: an optimized-build, headed-Chromium three-minute combat profile and five start/play/exit lifecycle cycles. The readable report is [`performance/REPORT.md`](performance/REPORT.md), raw evidence is [`performance/evidence/latest.json`](performance/evidence/latest.json), and the HTML report is [`performance/playwright-report/index.html`](performance/playwright-report/index.html).
- Visual baselines are versioned under `e2e/visual.spec.ts-snapshots/`; profiling evidence includes `performance/evidence/three-minute-combat.png`.

The repository includes `package-lock.json`, uses `npm ci`, requires Node.js 22.12 or newer, and defines the Vite build/output in `vercel.json`. A clean checkout can install, test, build, and run without environment variables or private services. The production deployment uses the same local MSW API and browser storage as local development.

## Balance decisions

- The default match lasts 90 seconds and spawns an enemy every six seconds. Options safely expose 60–180 seconds in 30-second steps and 2–15 second spawns in one-second steps.
- A 50 ms maximum simulation step consumes all elapsed time while preventing large collision jumps.
- Chasers trade ranged damage for higher contact pressure. Shooters keep distance and use a longer weapon cooldown.
- Front fire is faster and precise; a broadside trades a longer cooldown for three parallel projectiles. The three controls share the player ship's cooldown.
- Spawn types follow a deterministic distribution. Candidate positions must be outside islands and a safe distance from the player to avoid unavoidable immediate damage.
- Short projectile lifetimes and immediate removal after collision bound the entity count at the documented maximum spawn rate.
- Circle/rectangle collision shapes favor deterministic, readable, inexpensive gameplay over pixel-perfect hull geometry.

## Known limitations

- Ranking, History, player identity, and the mocked API database are local to one browser profile and are not shared between devices.
- There is no authentication or remote backend; this is intentional so the challenge remains self-contained and deployable without secrets.
- Refreshing during an unconfirmed result loses that draft; confirmed pending matches survive refresh through the outbox.
- Touch rendering deliberately uses 1× density without antialiasing to keep iOS fill rate and GPU memory bounded; it can look softer than desktop.
- Performance evidence is hardware/browser/viewport-specific. Headless Chromium used SwiftShader on the reference Mac, so the official GPU profile uses headed Chromium.
- Forced garbage collection improves lifecycle comparison but does not measure allocations retained inside the GPU driver.
- Profiling raises player health only to guarantee the entire three-minute sample; spawning, AI, collisions, projectiles, effects, audio, ticker, and rendering remain active.
