import type { GameOptions } from './game/config';

export type RankingEntry = {
  id: string;
  rank: number;
  captain: string;
  points: number;
  playedAt: string;
  isCurrentPlayer?: boolean;
};

export type MatchHistoryEntry = {
  id: string;
  playedAt: string;
  points: number;
  durationSeconds: number;
  result: 'time' | 'sunk';
};

type Props = {
  activeTab: 'ranking' | 'history';
  options: GameOptions;
  rankingEntries?: RankingEntry[];
  historyEntries?: MatchHistoryEntry[];
  page?: number;
  totalPages?: number;
  isLoading?: boolean;
  isFetching?: boolean;
  errorMessage?: string | null;
  refreshErrorMessage?: string | null;
  pendingCount?: number;
  onRetry?: () => void;
  onRetryPending?: () => void;
  onTabChange: (tab: 'ranking' | 'history') => void;
  onPageChange?: (page: number) => void;
  onMainMenu: () => void;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date).replace(',', ' ·').toUpperCase();
};

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function CaptainsLog({
  activeTab,
  options,
  rankingEntries = [],
  historyEntries = [],
  page = 1,
  totalPages = 1,
  isLoading = false,
  isFetching = false,
  errorMessage = null,
  refreshErrorMessage = null,
  pendingCount = 0,
  onRetry,
  onRetryPending,
  onTabChange,
  onPageChange,
  onMainMenu,
}: Props) {
  const entries = activeTab === 'ranking' ? rankingEntries : historyEntries;
  const safeTotalPages = Math.max(1, totalPages);
  const changePage = (nextPage: number) => onPageChange?.(Math.max(1, Math.min(safeTotalPages, nextPage)));

  return (
    <main className="log-screen">
      <div className="menu-backdrop" aria-hidden="true" />
      <section className="log-panel" aria-labelledby="log-title" aria-busy={isLoading || isFetching}>
        <h1 id="log-title">Captain&rsquo;s Log</h1>
        <nav className="log-tabs" aria-label="Captain's log sections">
          <button
            className={`menu-button ${activeTab === 'ranking' ? 'menu-button-primary' : 'menu-button-secondary'}`}
            type="button"
            aria-current={activeTab === 'ranking' ? 'page' : undefined}
            onClick={() => onTabChange('ranking')}
          ><span>Ranking</span></button>
          <button
            className={`menu-button ${activeTab === 'history' ? 'menu-button-primary' : 'menu-button-secondary'}`}
            type="button"
            aria-current={activeTab === 'history' ? 'page' : undefined}
            onClick={() => onTabChange('history')}
          ><span>Match History</span></button>
        </nav>

        <p className="log-context">
          {activeTab === 'ranking'
            ? `${options.sessionDuration} second battles · ${options.spawnInterval} second spawn interval`
            : 'Your recent battles'}
        </p>
        <div className="log-sync-status" aria-live="polite">
          {isFetching && !isLoading && <span>Updating…</span>}
          {refreshErrorMessage && <span>Update failed <button type="button" onClick={onRetry}>Retry</button></span>}
          {pendingCount > 0 && (
            <span>
              {pendingCount} pending {pendingCount === 1 ? 'match' : 'matches'}
              <button type="button" onClick={onRetryPending}>Retry sync</button>
            </span>
          )}
        </div>

        <div className="log-table-wrap">
          {activeTab === 'ranking' ? (
            <div className="log-table ranking-table" role="table" aria-label="Ranking">
              <div className="log-table-head" role="row">
                <span role="columnheader">Rank</span><span role="columnheader">Captain</span><span role="columnheader">Points</span><span role="columnheader">Played</span>
              </div>
              {!isLoading && !errorMessage && rankingEntries.map((entry) => (
                <div className={`log-row${entry.isCurrentPlayer ? ' current-player' : ''}`} role="row" key={entry.id}>
                  <span role="cell">{String(entry.rank).padStart(2, '0')}</span>
                  <strong role="cell">{entry.captain}{entry.isCurrentPlayer && <small>You</small>}</strong>
                  <b role="cell">{entry.points}</b>
                  <time role="cell" dateTime={entry.playedAt}>{formatDate(entry.playedAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="log-table history-table" role="table" aria-label="Match history">
              <div className="log-table-head" role="row">
                <span role="columnheader">Date</span><span role="columnheader">Points</span><span role="columnheader">Duration</span><span role="columnheader">Result</span>
              </div>
              {!isLoading && !errorMessage && historyEntries.map((entry) => (
                <div className="log-row" role="row" key={entry.id}>
                  <time role="cell" dateTime={entry.playedAt}>{formatDate(entry.playedAt)}</time>
                  <b role="cell">{entry.points}</b>
                  <span role="cell">{formatDuration(entry.durationSeconds)}</span>
                  <strong className={entry.result === 'time' ? 'result-win' : 'result-loss'} role="cell">
                    {entry.result === 'time' ? 'Time Up' : 'Defeated'}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {isLoading && <div className="log-request-state" role="status"><div className="spinner" aria-hidden="true" /><strong>Reading the captain&rsquo;s log…</strong></div>}
          {errorMessage && (
            <div className="log-request-state error" role="alert">
              <strong>Could not load the captain&rsquo;s log</strong>
              <span>{errorMessage}</span>
              <button className="secondary-text" type="button" onClick={onRetry}>Try again</button>
            </div>
          )}
          {!isLoading && !errorMessage && entries.length === 0 && (
            <div className="log-empty" role="status">
              <img src={activeTab === 'ranking' ? '/png/default/ui/hud/icon_score.png' : '/png/default/ui/hud/icon_time.png'} alt="" />
              <strong>{activeTab === 'ranking' ? 'No captains ranked yet' : 'No battles recorded yet'}</strong>
              <span>{activeTab === 'ranking' ? 'Complete a battle to claim the first spot.' : 'Your completed matches will appear here.'}</span>
            </div>
          )}
        </div>

        <div className="log-pagination" aria-label="Pagination">
          <button className="round" type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Previous page">
            <img src="/png/default/ui/controls/icon_turn_left.png" alt="" />
          </button>
          <span>Page {page} of {safeTotalPages}</span>
          <button className="round" type="button" disabled={page >= safeTotalPages} onClick={() => changePage(page + 1)} aria-label="Next page">
            <img src="/png/default/ui/controls/icon_turn_right.png" alt="" />
          </button>
        </div>

        <button className="menu-button menu-button-primary log-main-menu" type="button" onClick={onMainMenu}>
          <span>Main Menu</span>
        </button>
      </section>
      <img className="jungle-logo" src="/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </main>
  );
}
