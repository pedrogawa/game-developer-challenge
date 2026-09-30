import { useEffect, useRef, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { MOCK_SCENARIOS, getMockScenario } from './mocks/scenarios';
import type { MockScenarioConfig, MockScenarioId } from './mocks/scenarios';

type Props = {
  open: boolean;
  onApply: (config: MockScenarioConfig) => void;
  onReset: () => void;
  onClose: () => void;
};

export function NetworkScenarioModal({ open, onApply, onReset, onClose }: Props) {
  const [draft, setDraft] = useState<MockScenarioConfig>(getMockScenario);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeDefinition = MOCK_SCENARIOS.find(({ id }) => id === draft.id) ?? MOCK_SCENARIOS[0];

  useEffect(() => {
    if (!open) return;
    setDraft(getMockScenario());
  }, [open]);

  return (
    <AccessibleDialog
      open={open}
      labelledBy="network-title"
      panelClassName="options-panel network-panel"
      initialFocusRef={closeButtonRef}
      onClose={onClose}
    >
        <button ref={closeButtonRef} className="options-close round" type="button" onClick={onClose} aria-label="Close network scenarios">
          <img src="/png/default/ui/controls/icon_close.png" alt="" />
        </button>
        <h1 id="network-title">Network Lab</h1>
        <label className="network-field">
          <span>Scenario</span>
          <select
            value={draft.id}
            onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value as MockScenarioId }))}
          >
            {MOCK_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}
          </select>
        </label>
        <p className="network-description">{activeDefinition.description}</p>
        <label className="network-field">
          <span>Deterministic seed</span>
          <input
            type="number"
            step="1"
            value={draft.seed}
            onChange={(event) => {
              const seed = Number(event.target.value);
              setDraft((current) => ({ ...current, seed: Number.isSafeInteger(seed) ? seed : 0 }));
            }}
          />
        </label>
        <div className="network-actions">
          <button className="menu-button menu-button-primary" type="button" onClick={() => onApply(draft)}><span>Apply</span></button>
          <button className="secondary-text" type="button" onClick={onReset}>Reset mock data</button>
        </div>
    </AccessibleDialog>
  );
}
