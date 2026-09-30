# Desafio React & Pixi JS — Pirate Battle

## Solution guide

Pirate Battle is a browser-based, single-player naval shooter implemented with React, strict TypeScript, and PixiJS. It includes keyboard and touch combat, configurable matches, accessible responsive menus, local Ranking and Match History APIs mocked through MSW, deterministic failure scenarios, Playwright coverage, and a reproducible performance profile.

### Public deployment

The production URL will be added here after the repository is linked and deployed to Vercel. The published build uses the same in-browser MSW handlers and requires no private service.

### Requirements and setup

- Node.js 22.12 or newer
- npm 10 or newer
- Chromium installed through Playwright for E2E tests

No environment variables, secrets, private APIs, databases, or external services are required.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. For a production-equivalent local run:

```bash
npm run build
npm run preview
```

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `Arrow Up` | Forward arrow |
| Turn left | `A` or `Arrow Left` | Left arrow |
| Turn right | `D` or `Arrow Right` | Right arrow |
| Front cannon | `Space` | Front-fire button |
| Left broadside | `Q` | Left-fire button |
| Right broadside | `E` | Right-fire button |
| Pause or resume | `P` or `Escape` | Pause button |

Keyboard and touch actions can be combined. Losing focus or hiding the tab pauses the active match automatically.

### Gameplay configuration

Open **Options** from the main menu to configure:

- Game session time: 60–180 seconds, in 30-second increments.
- Enemy spawn time: 2–15 seconds, in 1-second increments.

Options persist in local storage. Each new match receives an immutable snapshot of the current options. All other balance values—including health, speed, rotation, damage, cooldowns, projectile lifetime, Shooter range, and spawn positions—are centralized in [`src/game/config.ts`](src/game/config.ts).

### Network scenarios and failure reproduction

Open **Network scenarios** on the main menu, select a scenario and deterministic seed, then choose **Apply**. The selection survives refreshes and clears cached Ranking and Match History queries.

Available scenarios cover success, empty data, multiple pages, slow or variable latency, out-of-order responses, timeout, connection failure, HTTP 429/503, isolated Ranking or History errors, timeout after a committed match, and an unavailable registration endpoint at match completion.

To reproduce registration recovery:

1. Select **Offline at finish** or **Timeout after save**.
2. Complete a match.
3. Return to **Network scenarios** and select **Success**.
4. Use **Retry save** or **Retry sync**.
5. Open Ranking and Match History to confirm the match appears once.

Use **Reset mock data** to restore the Success scenario and seed `1337`, clear confirmed and pending matches, clear the last result, and reset request ordering. Player identity and gameplay options are intentionally preserved.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the optimized build |
| `npm run preview` | Serve the optimized build locally |
| `npm run typecheck` | Run strict TypeScript validation |
| `npm run lint` | Run ESLint |
| `npm test` | Run MSW integration tests with Vitest |
| `npm run test:e2e` | Run Playwright desktop/mobile and visual tests |
| `npm run test:e2e:update` | Update intentional visual baselines |
| `npm run test:e2e:report` | Open the Playwright HTML report |
| `npm run test:performance` | Build and run the three-minute hardware-accelerated profile |
| `npm run test:performance:report` | Open the performance Playwright report |
| `npm run validate` | Run types, lint, unit tests, build, and the complete E2E suite |

E2E failures retain traces, screenshots, and video under `test-results/`. Versioned reports are available in [`playwright-report/`](playwright-report/) and [`performance/playwright-report/`](performance/playwright-report/). Performance evidence is documented in [`performance/REPORT.md`](performance/REPORT.md) and [`performance/evidence/latest.json`](performance/evidence/latest.json).

### Project structure

- `src/game/`: simulation, PixiJS renderer, gameplay configuration, test clock, and profiling bridge.
- `src/data/`: typed API contracts, Axios client, TanStack Query hooks, and registration mutation.
- `src/mocks/`: shared MSW handlers, fixtures, scenarios, browser worker, and Node test server.
- `e2e/`: isolated Playwright gameplay, lifecycle, data, touch, and visual tests.
- `performance/`: optimized-build profiling test and captured evidence.
- `assets/`: all supplied visual and audio resources plus the MSW worker.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for design decisions and [`CREDITS.md`](CREDITS.md) for asset provenance.

## Original challenge specification

Desenvolva um **shooter naval 2D com visão superior** usando React, TypeScript e PixiJS. O jogador deve navegar entre ilhas, enfrentar navios inimigos e acumular pontos até o fim da partida.

O desafio avalia gameplay, domínio de PixiJS, arquitetura, integração de dados, experiência de uso e qualidade da entrega. Informe sua estimativa de prazo antes de iniciar.

## 1. Stack obrigatória

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface e menus | React |
| Linguagem | TypeScript em modo estrito |
| Renderização do jogo | PixiJS |
| Estado remoto do ranking e do histórico | TanStack Query |
| Cliente HTTP do ranking e do histórico | Axios |
| Mocking das APIs de ranking e histórico | MSW |
| Testes E2E e regressão visual | Playwright |

Todas as tecnologias devem participar efetivamente da solução. A ferramenta de build, a estilização e as bibliotecas complementares ficam a critério do candidato.

O jogo é single-player e deve funcionar integralmente no navegador. Gameplay e configurações são locais. Ranking e histórico de partidas usam APIs REST simuladas com MSW, consumidas por Axios e TanStack Query.

## 2. Gameplay

### Jogador

- Movimentação para a frente e rotação para os dois lados.
- Disparo frontal com um projétil.
- Disparo lateral com três projéteis paralelos, com comandos para o lado esquerdo e o direito do navio.
- Vida limitada, reduzida por projéteis inimigos e pelo impacto de um Chaser.
- Movimentação restrita à arena visível, sem atravessar ilhas.

Defina controles de teclado e controles de toque para movimento, rotação e ataques. Permita movimentar e disparar simultaneamente. Apresente os comandos na interface.

### Inimigos

| Tipo | Comportamento |
| --- | --- |
| **Chaser** | Persegue o jogador, causa dano ao colidir com seu navio e explode no impacto |
| **Shooter** | Aproxima-se do jogador e dispara quando estiver dentro do alcance de ataque |

Ambos devem avançar, rotacionar, receber dano e respeitar as colisões com ilhas. Os dois tipos precisam aparecer durante uma partida padrão.

Inimigos surgem a cada intervalo configurado até o encerramento da partida. Os pontos de spawn devem estar livres de obstáculos e suficientemente afastados do jogador para evitar dano imediato inevitável.

### Arena, colisões e combate

- A arena deve conter água e pelo menos uma ilha que bloqueie navios e projéteis.
- Projéteis devem respeitar direção, velocidade, dano e alcance ou tempo de vida.
- Disparos do jogador atingem inimigos; disparos inimigos atingem o jogador.
- Cada projétil deve aplicar dano uma única vez e ser removido ao atingir um alvo ou obstáculo, expirar ou sair da arena.
- Cada arma deve respeitar seu intervalo entre disparos.
- Inimigos destruídos deixam de causar dano, disparar e participar das colisões.

### Regras da partida

- Duração configurável entre **60 e 180 segundos** de jogo ativo.
- Cada inimigo destruído pelos ataques do jogador vale **1 ponto**. A autodestruição de um Chaser contra o jogador não pontua.
- A partida termina quando o tempo acaba ou a vida do jogador chega a zero.
- O encerramento interrompe movimento, ataques, dano, spawns e contagem de pontos.
- Reiniciar deve criar uma nova partida, com vida, pontuação, cronômetro e entidades restaurados.

Exiba vida acima do navio do jogador e de cada inimigo. O HUD deve apresentar também pontuação e tempo restante.

Implemente pausa manual e automática ao perder o foco ou ocultar a aba. Durante a pausa, cronômetro, cooldowns e simulação ficam suspensos. A retomada exige uma ação do jogador e não pode acumular movimento ou disparos do período pausado.

### Animações e feedback

Implemente efeitos de disparo, explosão de destruição e deterioração visual dos navios conforme a vida restante. Ataques, impactos e dano devem ter feedback perceptível, mantendo a leitura da arena.

## 3. Telas e configurações

| Tela | Requisitos |
| --- | --- |
| Menu principal | Ações **Play** e **Options**, instruções de controle e abas **Ranking** e **Match History** |
| Options | **Game session time** e **Enemy spawn time**, com validação, salvamento e persistência após refresh |
| Partida | Arena PixiJS, HUD, controles e pausa |
| Resultado | Pontuação total, tempo jogado, motivo do encerramento, situação do registro da partida e ações **Play Again** e **Main Menu** |
| Ranking | Classificação, identificação dos jogadores, pontuação e paginação |
| Match History | Histórico do jogador, com data, pontuação, duração, motivo do encerramento e paginação |

Centralize os parâmetros de gameplay em uma configuração tipada e ajustável: duração, intervalo e distribuição dos spawns, vida, velocidades de movimento e rotação, dano, alcance, velocidade e duração dos projéteis, cooldowns e alcance do Shooter. Mudanças de balanceamento não devem exigir alterações na lógica dos sistemas.

A tela Options deve expor os dois parâmetros indicados. O intervalo de spawn deve ser positivo e ter limites documentados. Cada partida utiliza um snapshot da configuração vigente ao iniciar; alterações posteriores valem para novas partidas.

Recarregar a página ou sair da tela de combate encerra a partida em andamento. Persista localmente as opções do jogador e o resultado da última partida concluída. Uma partida abandonada não é registrada no ranking nem no histórico.

Interface, identificadores de código e documentação da solução devem estar em inglês. A identidade visual dos menus fica a seu critério e deve ser coerente com os assets do jogo.

## 4. PixiJS e arquitetura

Use PixiJS para arena, navios, projéteis, efeitos e indicadores sobre os navios. Use React nos menus, formulários, painéis e diálogos.

A solução deve demonstrar:

- separação entre regras do jogo, renderização, input e estado da interface;
- simulação baseada em tempo, com movimento, dano e spawns independentes da taxa de quadros;
- sincronização da interface com o jogo sem renderizações React a cada frame;
- carregamento e reutilização de texturas, com tratamento de falhas antes de iniciar o combate;
- ajuste do canvas à tela e à densidade de pixels, preservando proporções, coordenadas de input e limites da arena;
- liberação de listeners, ticker, timers, entidades e recursos ao sair ou reiniciar;
- inicialização e desmontagem corretas também com React Strict Mode.

O estado contínuo do combate deve permanecer na simulação. A estratégia de gerenciamento de estado e de sincronização com a interface fica a critério do candidato.

As regras de movimentação, combate, colisões e comportamento dos inimigos devem ser implementadas pelo candidato. A organização interna é livre; descreva as principais decisões em `ARCHITECTURE.md`.

## 5. Ranking e histórico de partidas

Implemente as abas **Ranking** e **Match History** no menu principal, com contratos tipados para os seguintes recursos:

| Recurso | Operações mínimas |
| --- | --- |
| Ranking | Consultar classificação paginada, ordenada por pontuação |
| Histórico | Registrar uma partida concluída e consultar o histórico paginado do jogador |

Cada registro deve conter identificação da partida e do jogador, data, pontuação, duração efetiva, motivo do encerramento e configuração usada. Compare no ranking partidas com a mesma configuração e adote um critério determinístico de desempate. Outros jogadores são representados por fixtures.

Use **Axios** nas chamadas HTTP e **TanStack Query** nas consultas e no registro de partidas. Gerencie carregamento, vazio, erro, atualização em segundo plano, cache, invalidação e retries. Atualize as duas abas após registrar uma partida e ao voltar a exibi-las. Respostas atrasadas não devem sobrescrever dados mais recentes.

Uma partida concluída deve gerar um único registro no histórico e uma única entrada no ranking. Reenvios e cliques repetidos devem recuperar o registro existente, sem duplicação. Preserve registros pendentes após falhas ou refresh e permita tentar novamente. O jogador deve conseguir iniciar outra partida enquanto houver um registro pendente.

Falhas nessas APIs não devem bloquear o acesso ao jogo, às configurações ou interromper o combate. Essas integrações se limitam ao ranking e ao histórico de partidas.

## 6. Mocking com MSW

Implemente os mocks das APIs de ranking e histórico na camada de rede, compartilhando contratos, fixtures e handlers entre desenvolvimento, testes e demonstração. Registros confirmados devem aparecer nas consultas seguintes, com estado consistente entre as duas abas.

### Simulating Network Conditions and Failures

Disponibilize cenários configuráveis e reproduzíveis para:

- sucesso, listas vazias e múltiplas páginas;
- lentidão, latência variável e respostas fora de ordem;
- timeout, falhas de conexão e respostas HTTP 4xx/5xx;
- falha ao consultar ranking ou histórico;
- timeout depois de registrar uma partida, com recuperação sem duplicação;
- indisponibilidade no encerramento da partida e registro após recuperação.

Inclua uma forma de selecionar os cenários e restaurar o estado inicial. Controle aleatoriedade e latência nos testes. Os mocks devem funcionar no build publicado. Use persistência local para manter os registros confirmados e os envios pendentes após refresh.

## 7. Interface, assets e acessibilidade

Os arquivos estão disponíveis em [assets/](assets/): navios, partes de navios, projéteis, efeitos, tiles, sprites de HUD e menus, spritesheets e imagens de referência. Os atlas de interface estão em [ui_sheet.json](assets/spritesheet/ui_sheet.json) e [ui_sheet_retina.json](assets/spritesheet/ui_sheet_retina.json), com recortes, alinhamento e caminhos dos PNGs individuais. Os campos `ui` contêm metadados complementares; suas medidas e as bordas usam unidades lógicas (1×), relativas ao canto superior esquerdo do sprite. Os efeitos sonoros e loops de ambiente estão em [assets/sounds/](assets/sounds/), no formato WAV.

Utilize os assets fornecidos como base visual. Conversão de atlas, otimização de imagens e recursos complementares são permitidos; inclua as fontes e licenças correspondentes na entrega.

A interface e o jogo devem funcionar em desktop e mobile, com controles de toque utilizáveis e sem cortes na arena ou no HUD. Defina a orientação suportada no mobile e adapte o layout à mudança de tamanho sem alterar as regras da partida.

O carregamento dos assets da partida deve ter progresso ou estado de carregamento visível.

Garanta navegação por teclado nos menus, foco visível, controle de foco em diálogos, labels, contraste adequado e mensagens de erro acessíveis. Disponibilize pontuação, tempo e estado da partida também em uma interface semântica; evite anúncios a cada frame. As teclas do jogo só devem ser capturadas enquanto o contexto de gameplay estiver ativo.

## 8. Testes com Playwright

Entregue testes E2E cobrindo:

1. Navegação, validação e persistência das opções.
2. Carregamento dos assets, falhas e nova tentativa.
3. Início de partida, movimento, rotação, limites da arena e colisão com ilhas.
4. Disparos frontal e lateral, dano, cooldown e pontuação sem duplicação.
5. Comportamentos de Chaser e Shooter e intervalo de spawn.
6. Encerramento por tempo e por morte, interrupção da simulação e reinício limpo.
7. Pausa, perda de foco e retomada sem avanço indevido do cronômetro.
8. Exibição do resultado e sua persistência após refresh.
9. Abandono da partida, navegação repetida entre telas e controles de toque.
10. Consulta e paginação das abas Ranking e Match History, incluindo carregamento, vazio e erro.
11. Registro da partida, atualização das duas abas e recuperação de envio pendente após refresh.
12. Reenvio após timeout sem duplicação e respostas atrasadas sem sobrescrever dados recentes.

Execute os fluxos principais em Chromium, em desktop e mobile. Inclua regressão visual do menu, da arena em um estado estável e da tela de resultado, com baselines versionadas.

Use cenários com seed e controle do tempo da simulação para tornar os testes reproduzíveis. A instrumentação de teste pode observar o estado e controlar o relógio, preservando a execução real das regras, inputs, colisões e renderização. Os testes de combate devem acionar controles do jogo e verificar seus efeitos.

Cada teste deve partir de um estado isolado. Entregue relatório HTML e traces das falhas.

### Section 8 implementation notes

- `npm run test:e2e` runs the complete Chromium desktop/mobile matrix.
- `npm run test:e2e:update` updates the versioned menu, arena, and result baselines.
- `npm run test:e2e:report` opens the generated HTML report in `playwright-report/`.
- Failures retain traces, screenshots, and video in `test-results/`.
- A fixed seed and a bridge enabled only through `?e2e=1` observe state and control the clock while preserving real inputs, rules, collisions, AI, and rendering.
- The mapping between the twelve requirements and test files is documented in `e2e/README.md`.

## 9. Performance do jogo

Avalie a performance do combate em build otimizado, com **60 FPS como alvo** no ambiente de referência documentado. Registre taxa de quadros, percentil 95 do tempo entre frames e quantidade de entidades em uma partida de três minutos.

Verifique o uso de memória após cinco ciclos de iniciar, jogar e sair, investigando crescimento contínuo de recursos. Entregue evidências de profiling com hardware, navegador, resolução, configuração da partida e limitações observadas.

### Section 9 implementation notes

- `npm run test:performance` creates the optimized build, launches hardware-accelerated Chromium, runs five lifecycle cycles, and measures a real three-minute match.
- The reference scenario uses seed `1337`, a 180-second match, two-second spawns, a 1440×900 viewport, and DPR 1. Profiling-only player protection prevents an early death; rules, AI, collisions, projectiles, effects, audio, ticker, and rendering remain active.
- The Apple M1 Pro/Chromium 153 Metal run recorded 119.94 average FPS, a 9.20 ms p95, one sample above 16.67 ms, and at most 62 entities.
- After cache warmup, five cycles produced 0.95 MiB of heap growth, no DOM-node growth, and no canvas left on the menu.
- Full evidence is available in `performance/REPORT.md`, `performance/evidence/latest.json`, `performance/evidence/three-minute-combat.png`, and `performance/playwright-report/`.
- `performance/HEADLESS_DIAGNOSTIC.md` separately documents the headless Chromium limitation that selected SwiftShader instead of the machine GPU.

## 10. Critérios de avaliação

| Critério | Pontos |
| --- | ---: |
| Gameplay, regras, colisões e comportamento dos inimigos | 35 |
| PixiJS, arquitetura e ciclo de vida dos recursos | 20 |
| Interface, feedback, responsividade e acessibilidade | 15 |
| TanStack Query, Axios e consistência do ranking e histórico | 10 |
| MSW e cenários de falha | 5 |
| Testes com Playwright | 10 |
| Performance e documentação | 5 |
| **Total** | **100** |

Serão considerados o funcionamento completo da partida, a clareza das responsabilidades, a qualidade do código e a execução reproduzível. O console deve permanecer sem erros não tratados durante os fluxos previstos.

## 11. Entrega

Entregue o repositório com código-fonte, lockfile, assets, mocks, fixtures e testes.

O **deploy é obrigatório**. Envie uma URL pública e funcional do jogo. Recomenda-se [Vercel](https://vercel.com/); [Netlify](https://www.netlify.com/) e [Cloudflare Pages](https://pages.cloudflare.com/) também são aceitos.

A versão publicada deve corresponder ao código entregue, permanecer funcional e acessível durante a avaliação e executar os mocks de ranking e histórico. O jogo deve funcionar ao abrir ou recarregar a URL publicada.

O `README.md` da solução deve incluir setup, variáveis de ambiente, controles, configuração de gameplay, seleção e reset dos cenários de rede, comandos e instruções para reproduzir falhas. Disponibilize comandos para desenvolvimento, build, preview, lint, verificação de tipos e Playwright.

Documente em `ARCHITECTURE.md` a integração React/PixiJS, o ciclo da simulação, colisões, gerenciamento de recursos, persistência local e integração do ranking e histórico, incluindo contratos, cache e recuperação de registros pendentes. Registre limitações e decisões de balanceamento.

Inclua os relatórios de testes e profiling. A solução deve executar a partir de um checkout limpo, sem depender de serviços privados.

## Mock scenario controls

Open **Network scenarios** on the main menu to select a reproducible MSW mode. The selected mode and deterministic seed survive refreshes. Applying a mode clears the TanStack Query cache so the next Ranking or Match History visit uses the new behavior.

Available modes cover normal success, empty lists, multiple pages, fixed slowness, seeded variable latency, out-of-order responses, client timeout, connection failure, HTTP 429/503, isolated Ranking or History failure, timeout after a successful server-side save, and an unavailable registration endpoint at match completion. For the recovery modes, switch back to **Success** and use **Retry save** or **Retry sync**. Registration is idempotent by `matchId`, so a commit followed by timeout cannot create duplicates.

**Reset mock data** restores the Success scenario and seed `1337`, clears confirmed matches, pending submissions, the last completed result, request counters, and cached record queries. Gameplay options and the persistent player identity are intentionally preserved.

Tests can import `mockServer`, `startMockServer`, `resetMockServer`, and `stopMockServer` from `src/mocks/server.ts`; select scenarios programmatically through `selectMockScenario` from `src/mocks/controls.ts`. Call `resetMockServer()` after each test to restore handlers, storage, seed, and request ordering.

Run the shared MSW integration suite with `npm test`.

## Interface, assets, and accessibility notes

The game supports both portrait and landscape orientation on phones and tablets. Changing orientation or viewport size resizes the PixiJS renderer and camera without restarting or changing the active simulation. HUD and touch controls respect browser safe-area insets, and touch targets keep a minimum 44×44 CSS-pixel hit area.

All visual and audio resources used by the game come from the supplied [`assets/`](assets/) package. The UI uses the individual PNG exports documented by the supplied UI atlases. See [`CREDITS.md`](CREDITS.md) for provenance details; no external fonts, images, or audio resources were added.

Menus and record views use native keyboard controls and visible focus indicators. Options, network, loading, error, pause, and result overlays manage focus as modal dialogs and make their background inert. Gameplay keys and pointer controls are active only while combat is running without an overlay. The visual HUD has a separate semantic health, score, time, and match-state representation; only important combat events are announced to assistive technology. Browser zoom and reduced-motion/high-contrast preferences are supported.

Game textures report a visible loading percentage, and asset failures open an accessible retry dialog. Audio uses the provided WAV effects and ocean ambience and is gracefully skipped when browser autoplay policy prevents playback.
