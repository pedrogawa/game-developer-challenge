import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { MainMenu } from './MainMenu';
import { CaptainsLog } from './CaptainsLog';
import { OptionsModal } from './OptionsModal';
import { NetworkScenarioModal } from './NetworkScenarioModal';
import { PixiGame } from './game/PixiGame';
import { DEFAULT_GAME_OPTIONS, GAME_OPTION_LIMITS } from './game/config';
import type { GameOptions } from './game/config';
import type { GameSnapshot, InputAction } from './game/types';
import type { MatchRecord } from './data/contracts';
import { getOrCreatePlayer } from './data/player';
import { getErrorMessage } from './data/http';
import { useHistoryQuery, useRankingQuery } from './data/queries';
import { useMatchRegistration } from './data/useMatchRegistration';
import { queryClient } from './data/queryClient';
import { resetMockData, selectMockScenario } from './mocks/controls';
import type { MockScenarioConfig } from './mocks/scenarios';

const OPTIONS_STORAGE_KEY = 'pirate-battle-options-v1';
const LOG_PAGE_SIZE = 5;
const queryParameters = new URLSearchParams(window.location.search);
const networkLabEnabled = import.meta.env.DEV
  || queryParameters.get('debug') === 'network'
  || queryParameters.get('e2e') === '1';
const portraitQuery = '(orientation: portrait)';
const isTouchDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
const isTouchPortrait = () => isTouchDevice()
  && (window.matchMedia(portraitQuery).matches || window.innerHeight > window.innerWidth);

const initialSnapshot = (sessionDuration: number): GameSnapshot => ({
  health: 100, maxHealth: 100, score: 0, timeRemaining: sessionDuration, paused: false, gameOver: false, endReason: null,
});

const validStep = (value: unknown, limits: { min: number; max: number; step: number }) =>
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= limits.min
  && value <= limits.max
  && (value - limits.min) % limits.step === 0;

const loadOptions = (): GameOptions => {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? 'null') as Partial<GameOptions> | null;
    if (
      saved
      && validStep(saved.sessionDuration, GAME_OPTION_LIMITS.sessionDuration)
      && validStep(saved.spawnInterval, GAME_OPTION_LIMITS.spawnInterval)
    ) return { sessionDuration: saved.sessionDuration!, spawnInterval: saved.spawnInterval! };
  } catch {
    // Invalid or unavailable storage falls back to the documented defaults.
  }
  return { ...DEFAULT_GAME_OPTIONS };
};

const keyboardMap: Record<string, InputAction | undefined> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'fireFront', KeyQ: 'fireLeft', KeyE: 'fireRight',
};

export function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'ranking' | 'history'>('menu');
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const [matchOptions, setMatchOptions] = useState<GameOptions>(() => ({ ...DEFAULT_GAME_OPTIONS }));
  const [player] = useState(getOrCreatePlayer);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [networkScenariosOpen, setNetworkScenariosOpen] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [snapshot, setSnapshot] = useState(() => initialSnapshot(DEFAULT_GAME_OPTIONS.sessionDuration));
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameAnnouncement, setGameAnnouncement] = useState('');
  const [restartToken, setRestartToken] = useState(0);
  const [pauseRequest, setPauseRequest] = useState(0);
  const [touchPortrait, setTouchPortrait] = useState(isTouchPortrait);
  const inputRef = useRef<Set<InputAction>>(new Set());
  const matchIdRef = useRef<string | null>(null);
  const recordedMatchIdRef = useRef<string | null>(null);
  const pauseResumeRef = useRef<HTMLButtonElement>(null);
  const resultPrimaryRef = useRef<HTMLButtonElement>(null);
  const retryAssetsRef = useRef<HTMLButtonElement>(null);
  const orientationExitRef = useRef<HTMLButtonElement>(null);
  const announcedSnapshotRef = useRef({ health: 100, score: 0, paused: false, gameOver: false });
  const orientationBlocked = screen === 'game' && touchPortrait && !optionsOpen && !snapshot.gameOver;
  const pauseHotkeyEnabled = screen === 'game'
    && !loading
    && !loadError
    && !snapshot.gameOver
    && !orientationBlocked
    && !optionsOpen;
  const gameplayInteractive = pauseHotkeyEnabled && !snapshot.paused;

  const rankingQuery = useRankingQuery({
    page: logPage,
    pageSize: LOG_PAGE_SIZE,
    config: options,
    enabled: screen === 'ranking',
  });
  const historyQuery = useHistoryQuery({
    page: logPage,
    pageSize: LOG_PAGE_SIZE,
    playerId: player.id,
    enabled: screen === 'history',
  });
  const registration = useMatchRegistration(player);
  const registerCompletedMatch = registration.registerCompletedMatch;

  const onSnapshot = useCallback((next: GameSnapshot) => setSnapshot(next), []);
  const onLoadProgress = useCallback((progress: number) => setLoadProgress(progress), []);
  const onLoaded = useCallback(() => { setLoadProgress(1); setLoading(false); setLoadError(null); }, []);
  const onLoadError = useCallback((message: string) => { setLoading(false); setLoadError(message); }, []);
  const closeOptions = useCallback(() => setOptionsOpen(false), []);
  const closeNetworkScenarios = useCallback(() => setNetworkScenariosOpen(false), []);
  const togglePause = useCallback(() => setPauseRequest((value) => value + 1), []);
  const saveOptions = useCallback((next: GameOptions) => {
    setOptions(next);
    try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(next)); } catch { /* The game remains usable without storage. */ }
    setOptionsOpen(false);
  }, []);
  const applyNetworkScenario = useCallback((config: MockScenarioConfig) => {
    selectMockScenario(config);
    queryClient.clear();
    setLogPage(1);
    setNetworkScenariosOpen(false);
  }, []);
  const resetNetworkMocks = useCallback(() => {
    resetMockData();
    queryClient.clear();
    setLogPage(1);
    setNetworkScenariosOpen(false);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(portraitQuery);
    const updateOrientation = () => setTouchPortrait(isTouchPortrait());
    updateOrientation();
    mediaQuery.addEventListener('change', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      mediaQuery.removeEventListener('change', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code === 'Escape' || event.code === 'KeyP') && pauseHotkeyEnabled) {
        if (!event.repeat) togglePause();
        inputRef.current.clear();
        event.preventDefault();
        return;
      }
      const action = keyboardMap[event.code];
      if (action && gameplayInteractive) {
        inputRef.current.add(action);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = keyboardMap[event.code];
      if (action) inputRef.current.delete(action);
    };
    const pauseForFocusLoss = () => {
      inputRef.current.clear();
      if (gameplayInteractive) togglePause();
    };
    const onVisibility = () => { if (document.hidden) pauseForFocusLoss(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pauseForFocusLoss);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pauseForFocusLoss);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [gameplayInteractive, pauseHotkeyEnabled, togglePause]);

  useEffect(() => {
    if (!gameplayInteractive) inputRef.current.clear();
  }, [gameplayInteractive]);

  useEffect(() => {
    if (screen !== 'game') return;
    const health = Math.ceil(snapshot.health);
    const previous = announcedSnapshotRef.current;
    let announcement = '';
    if (snapshot.gameOver && !previous.gameOver) {
      announcement = snapshot.endReason === 'sunk'
        ? `Battle complete. Your ship sank with ${snapshot.score} points.`
        : `Battle complete. Time is up with ${snapshot.score} points.`;
    } else if (snapshot.paused !== previous.paused) {
      announcement = snapshot.paused ? 'Battle paused.' : 'Battle resumed.';
    } else if (snapshot.score > previous.score) {
      announcement = `Enemy destroyed. Score ${snapshot.score}.`;
    } else if (health < previous.health) {
      announcement = `Ship damaged. Health ${health} of ${snapshot.maxHealth}.`;
    }
    announcedSnapshotRef.current = { health, score: snapshot.score, paused: snapshot.paused, gameOver: snapshot.gameOver };
    if (announcement) setGameAnnouncement(announcement);
  }, [screen, snapshot.endReason, snapshot.gameOver, snapshot.health, snapshot.maxHealth, snapshot.paused, snapshot.score]);

  useEffect(() => {
    const matchId = matchIdRef.current;
    if (!snapshot.gameOver || !snapshot.endReason || !matchId || recordedMatchIdRef.current === matchId) return;
    recordedMatchIdRef.current = matchId;
    const record: MatchRecord = {
      matchId,
      playerId: player.id,
      playerName: player.name,
      playedAt: new Date().toISOString(),
      score: snapshot.score,
      durationSeconds: Math.floor(Math.max(0, matchOptions.sessionDuration - snapshot.timeRemaining)),
      endReason: snapshot.endReason,
      config: { ...matchOptions },
    };
    registerCompletedMatch(record);
  }, [matchOptions, player, registerCompletedMatch, snapshot.endReason, snapshot.gameOver, snapshot.score, snapshot.timeRemaining]);

  const setInput = (action: InputAction, pressed: boolean) => {
    if (pressed && gameplayInteractive) inputRef.current.add(action);
    else inputRef.current.delete(action);
  };

  const restart = () => {
    inputRef.current.clear();
    setSnapshot(initialSnapshot(matchOptions.sessionDuration));
    setLoading(true);
    setLoadProgress(0);
    setLoadError(null);
    setRestartToken((value) => value + 1);
  };

  const startGame = () => {
    const nextMatchOptions = { ...options };
    inputRef.current.clear();
    setMatchOptions(nextMatchOptions);
    setSnapshot(initialSnapshot(nextMatchOptions.sessionDuration));
    setLoading(true);
    setLoadProgress(0);
    setLoadError(null);
    setRestartToken((value) => value + 1);
    matchIdRef.current = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    recordedMatchIdRef.current = null;
    announcedSnapshotRef.current = { health: 100, score: 0, paused: false, gameOver: false };
    setGameAnnouncement('Battle started.');
    registration.resetStatus();
    setScreen('game');
  };

  const returnToMenu = () => {
    inputRef.current.clear();
    setScreen('menu');
  };

  if (screen === 'menu') return (
    <>
      <div
        aria-hidden={optionsOpen || networkScenariosOpen || undefined}
        inert={optionsOpen || networkScenariosOpen ? true : undefined}
      >
        <MainMenu
          onPlay={startGame}
          onOptions={() => setOptionsOpen(true)}
          onRanking={() => { setLogPage(1); setScreen('ranking'); }}
          onHistory={() => { setLogPage(1); setScreen('history'); }}
          onNetworkScenarios={networkLabEnabled ? () => setNetworkScenariosOpen(true) : undefined}
          pendingCount={registration.pendingCount}
          onRetryPending={() => { void registration.flushPending(); }}
        />
      </div>
      <OptionsModal open={optionsOpen} options={options} onSave={saveOptions} onClose={closeOptions} />
      <NetworkScenarioModal
        open={networkScenariosOpen}
        onApply={applyNetworkScenario}
        onReset={resetNetworkMocks}
        onClose={closeNetworkScenarios}
      />
    </>
  );

  if (screen === 'ranking' || screen === 'history') {
    const activeQuery = screen === 'ranking' ? rankingQuery : historyQuery;
    const queryErrorMessage = activeQuery.error ? getErrorMessage(activeQuery.error) : null;
    const hasRemoteData = activeQuery.data !== undefined;
    const rankingEntries = (rankingQuery.data?.items ?? []).map((match) => ({
      id: match.matchId,
      rank: match.rank,
      captain: match.playerName,
      points: match.score,
      playedAt: match.playedAt,
      isCurrentPlayer: match.playerId === player.id,
    }));
    const historyEntries = (historyQuery.data?.items ?? []).map((match) => ({
      id: match.matchId,
      playedAt: match.playedAt,
      points: match.score,
      durationSeconds: match.durationSeconds,
      result: match.endReason,
    }));

    return (
      <CaptainsLog
        activeTab={screen}
        options={options}
        rankingEntries={rankingEntries}
        historyEntries={historyEntries}
        page={activeQuery.data?.page ?? logPage}
        totalPages={activeQuery.data?.totalPages ?? 1}
        isLoading={activeQuery.isPending}
        isFetching={activeQuery.isFetching}
        errorMessage={!hasRemoteData ? queryErrorMessage : null}
        refreshErrorMessage={hasRemoteData ? queryErrorMessage : null}
        pendingCount={registration.pendingCount}
        onRetry={() => { void activeQuery.refetch(); }}
        onRetryPending={() => { void registration.flushPending(); }}
        onPageChange={setLogPage}
        onTabChange={(tab) => { setLogPage(1); setScreen(tab); }}
        onMainMenu={() => setScreen('menu')}
      />
    );
  }

  const time = Math.ceil(snapshot.timeRemaining);
  const timeLabel = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
  const elapsed = Math.floor(Math.max(0, matchOptions.sessionDuration - snapshot.timeRemaining));
  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const healthRatio = snapshot.health / snapshot.maxHealth;
  const gameOverlayOpen = loading || Boolean(loadError) || optionsOpen || orientationBlocked || snapshot.paused || snapshot.gameOver;
  const loadPercentage = Math.round(loadProgress * 100);

  return (
    <>
      <main
        className="game-shell"
        aria-hidden={gameOverlayOpen || undefined}
        inert={gameOverlayOpen ? true : undefined}
      >
        <section className="arena-frame" aria-label="Pirate Battle gameplay" aria-busy={loading}>
        <PixiGame
          restartToken={restartToken}
          onSnapshot={onSnapshot}
          onLoadProgress={onLoadProgress}
          onLoaded={onLoaded}
          onLoadError={onLoadError}
          inputRef={inputRef}
          pauseRequest={pauseRequest}
          gameOptions={matchOptions}
          suspended={orientationBlocked || snapshot.paused || snapshot.gameOver || optionsOpen}
        />

        <header className="hud">
          <div className="health-panel" aria-label={`Health ${Math.ceil(snapshot.health)} of ${snapshot.maxHealth}`}>
            <img src="/png/default/ui/hud/icon_heart.png" alt="" />
            <div className="health-track">
              <img className="health-frame" src="/png/default/ui/hud/health_frame.png" alt="" />
              <img
                className="health-fill"
                src={healthRatio < 0.3 ? '/png/default/ui/hud/health_fill_red.png' : healthRatio < 0.6 ? '/png/default/ui/hud/health_fill_amber.png' : '/png/default/ui/hud/health_fill_green.png'}
                alt=""
                style={{ clipPath: `inset(0 ${100 - healthRatio * 100}% 0 0)` }}
              />
              <b>{Math.ceil(snapshot.health)} / {snapshot.maxHealth}</b>
            </div>
          </div>
          <div className="hud-right">
            <div className="counter" aria-label={`Score ${snapshot.score}`}><img src="/png/default/ui/hud/icon_score.png" alt="" /><strong>{snapshot.score}</strong></div>
            <div className="counter" aria-label={`Time remaining ${timeLabel}`}><img src="/png/default/ui/hud/icon_time.png" alt="" /><strong>{timeLabel}</strong></div>
            <button className="round pause" type="button" onClick={togglePause} aria-label={snapshot.paused ? 'Resume game' : 'Pause game'}>
              <img src={snapshot.paused ? '/png/default/ui/controls/icon_play.png' : '/png/default/ui/controls/icon_pause.png'} alt="" />
            </button>
          </div>
        </header>

        <TouchControls setInput={setInput} disabled={!gameplayInteractive} />

        <aside className="keyboard-help" aria-label="Keyboard controls">
          <span><kbd>W</kbd> sail</span><span><kbd>A</kbd><kbd>D</kbd> turn</span><span><kbd>Space</kbd> front</span><span><kbd>Q</kbd><kbd>E</kbd> broadsides</span><span><kbd>P</kbd> pause</span>
        </aside>

        <section className="sr-only" aria-label="Current battle status">
          <dl>
            <dt>Health</dt><dd>{Math.ceil(snapshot.health)} of {snapshot.maxHealth}</dd>
            <dt>Score</dt><dd>{snapshot.score}</dd>
            <dt>Time remaining</dt><dd>{timeLabel}</dd>
            <dt>State</dt><dd>{snapshot.gameOver ? 'Battle complete' : snapshot.paused ? 'Paused' : 'In progress'}</dd>
          </dl>
        </section>
        </section>
      </main>
      <AccessibleDialog
        open={orientationBlocked}
        labelledBy="orientation-title"
        describedBy="orientation-description"
        panelClassName="panel orientation-panel"
        overlayClassName="modal orientation-lock"
        role="alertdialog"
        initialFocusRef={orientationExitRef}
        closeOnEscape={false}
      >
        <img className="orientation-icon" src="/png/default/ui/controls/icon_turn_right.png" alt="" />
        <h1 id="orientation-title">Rotate to play</h1>
        <p id="orientation-description">Pirate Battle requires landscape orientation on touch devices.</p>
        <button ref={orientationExitRef} className="primary" type="button" onClick={returnToMenu}>Main Menu</button>
      </AccessibleDialog>
      <AccessibleDialog
        open={loading && !loadError && !orientationBlocked}
        labelledBy="loading-title"
        describedBy="loading-description"
        panelClassName="panel"
        overlayClassName="modal"
        closeOnEscape={false}
      >
        <div role="status" aria-live="polite" aria-atomic="true">
          <div className="spinner" aria-hidden="true" />
          <h1 id="loading-title">Loading the fleet…</h1>
          <p id="loading-description">Preparing ships, islands, and cannons. {loadPercentage}%</p>
        </div>
      </AccessibleDialog>
      <AccessibleDialog
        open={Boolean(loadError) && !orientationBlocked}
        labelledBy="load-error-title"
        describedBy="load-error-description"
        panelClassName="panel"
        overlayClassName="modal"
        role="alertdialog"
        initialFocusRef={retryAssetsRef}
        closeOnEscape={false}
      >
        <h1 id="load-error-title">Assets lost at sea</h1>
        <p id="load-error-description">{loadError}</p>
        <button ref={retryAssetsRef} className="primary" type="button" onClick={restart}>Try again</button>
      </AccessibleDialog>
      <AccessibleDialog
        open={snapshot.paused && !snapshot.gameOver && !optionsOpen && !orientationBlocked}
        labelledBy="pause-title"
        describedBy="pause-description"
        panelClassName="battle-menu-panel"
        overlayClassName="modal battle-modal"
        initialFocusRef={pauseResumeRef}
        onClose={togglePause}
      >
        <h1 id="pause-title">Paused</h1>
        <p id="pause-description">Ready when you are.</p>
        <div className="battle-menu-actions">
          <button ref={pauseResumeRef} className="menu-button menu-button-primary" type="button" onClick={togglePause}><span>Resume</span></button>
          <button className="menu-button menu-button-primary" type="button" onClick={() => setOptionsOpen(true)}><span>Options</span></button>
          <button className="menu-button menu-button-primary" type="button" onClick={returnToMenu}><span>Main Menu</span></button>
        </div>
      </AccessibleDialog>
      <AccessibleDialog
        open={snapshot.gameOver}
        labelledBy="result-title"
        panelClassName="battle-menu-panel result-panel"
        overlayClassName="modal battle-modal"
        initialFocusRef={resultPrimaryRef}
        closeOnEscape={false}
      >
        <h1 id="result-title">Battle Complete</h1>
        <strong className="result-score" aria-label={`${snapshot.score} points`}>{snapshot.score}</strong>
        <p className="result-details">
          <span>Points</span><b aria-hidden="true">·</b><span>{elapsedLabel}</span><b aria-hidden="true">·</b>
          <span>{snapshot.endReason === 'sunk' ? 'Ship Sunk' : 'Time Up'}</span>
        </p>
        <p className={`result-registration ${registration.status}`} aria-live="polite">
          {registration.status === 'saving' && 'Saving match…'}
          {registration.status === 'saved' && 'Match saved'}
          {registration.status === 'failed' && 'Match pending — retry available'}
        </p>
        {registration.status === 'failed' && (
          <button className="secondary-text result-retry" type="button" onClick={registration.retryCurrent}>Retry save</button>
        )}
        <div className="battle-menu-actions">
          <button ref={resultPrimaryRef} className="menu-button menu-button-primary" type="button" onClick={startGame}><span>Play Again</span></button>
          <button className="menu-button menu-button-primary" type="button" onClick={returnToMenu}><span>Main Menu</span></button>
        </div>
      </AccessibleDialog>
      <OptionsModal
        open={optionsOpen}
        options={options}
        onSave={saveOptions}
        onClose={closeOptions}
        saveLabel="Save & Back"
      />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{gameAnnouncement}</div>
    </>
  );
}

function TouchControls({ setInput, disabled }: { setInput: (action: InputAction, pressed: boolean) => void; disabled: boolean }) {
  const bind = (action: InputAction) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); setInput(action, true); },
    onPointerUp: () => setInput(action, false),
    onPointerCancel: () => setInput(action, false),
    onLostPointerCapture: () => setInput(action, false),
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => { if (event.buttons === 0) setInput(action, false); },
  });
  return (
    <div className="touch-controls" role="group" aria-label="Touch controls" aria-hidden={disabled || undefined}>
      <div className="movement-controls" role="group" aria-label="Movement controls">
        <button className="round" type="button" disabled={disabled} {...bind('left')} aria-label="Turn left"><img src="/png/default/ui/controls/icon_turn_left.png" alt="" /></button>
        <button className="round forward" type="button" disabled={disabled} {...bind('forward')} aria-label="Sail forward"><img src="/png/default/ui/controls/icon_forward.png" alt="" /></button>
        <button className="round" type="button" disabled={disabled} {...bind('right')} aria-label="Turn right"><img src="/png/default/ui/controls/icon_turn_right.png" alt="" /></button>
      </div>
      <div className="attack-controls" role="group" aria-label="Attack controls">
        <button className="round" type="button" disabled={disabled} {...bind('fireLeft')} aria-label="Fire left broadside"><img src="/png/default/ui/controls/icon_fire_left.png" alt="" /></button>
        <button className="round front-fire" type="button" disabled={disabled} {...bind('fireFront')} aria-label="Fire front cannon"><img src="/png/default/ui/controls/icon_fire_front.png" alt="" /></button>
        <button className="round" type="button" disabled={disabled} {...bind('fireRight')} aria-label="Fire right broadside"><img src="/png/default/ui/controls/icon_fire_right.png" alt="" /></button>
      </div>
    </div>
  );
}
