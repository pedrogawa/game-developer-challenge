type Props = {
  onPlay: () => void;
  onOptions: () => void;
  onRanking: () => void;
  onHistory: () => void;
  onNetworkScenarios: () => void;
  pendingCount?: number;
  onRetryPending?: () => void;
};

export function MainMenu({ onPlay, onOptions, onRanking, onHistory, onNetworkScenarios, pendingCount = 0, onRetryPending }: Props) {
  return (
    <main className="main-menu-screen">
      <div className="menu-backdrop" aria-hidden="true" />
      <section className="main-menu-panel" aria-labelledby="game-title">
        <img
          id="game-title"
          className="menu-title"
          src="/png/default/ui/menu/title_pirate_battle.png"
          alt="Pirate Battle"
        />
        <p className="menu-kicker">Set sail. Take command.</p>

        <div className="menu-primary-actions">
          <button className="menu-button menu-button-primary" onClick={onPlay}>
            <span>Play</span>
          </button>
          <button className="menu-button menu-button-primary" type="button" onClick={onOptions}>
            <span>Options</span>
          </button>
        </div>

        <div className="menu-flavour">
          <img src="/png/default/ships/ship_6.png" alt="" aria-hidden="true" />
          <div className="menu-controls-guide" aria-label="Game controls">
            <h2>Controls</h2>
            <p><span><kbd>W</kbd><kbd>A</kbd><kbd>D</kbd></span> Sail &amp; turn</p>
            <p><span><kbd>Space</kbd></span> Front cannon</p>
            <p><span><kbd>Q</kbd><kbd>E</kbd></span> Broadsides</p>
            <small>Touch controls appear during battle.</small>
          </div>
        </div>

        <nav className="menu-secondary-actions" aria-label="Game records">
          <button className="menu-button menu-button-secondary" type="button" onClick={onRanking}>
            <span>Ranking</span>
          </button>
          <button className="menu-button menu-button-secondary" type="button" onClick={onHistory}>
            <span>Match History</span>
          </button>
        </nav>
        <button className="network-lab-link" type="button" onClick={onNetworkScenarios}>Network scenarios</button>
        {pendingCount > 0 && (
          <div className="pending-sync" role="status">
            <span>{pendingCount} match {pendingCount === 1 ? 'is' : 'are'} waiting to sync</span>
            <button type="button" onClick={onRetryPending}>Retry sync</button>
          </div>
        )}
      </section>
      <img className="jungle-logo" src="/logo_jungle_gaming.svg" alt="Jungle Gaming" />
    </main>
  );
}
