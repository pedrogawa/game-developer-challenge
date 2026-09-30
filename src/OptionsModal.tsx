import { useEffect, useId, useRef, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { GAME_OPTION_LIMITS } from './game/config';
import type { GameOptions } from './game/config';

type Props = {
  open: boolean;
  options: GameOptions;
  onSave: (options: GameOptions) => void;
  onClose: () => void;
  saveLabel?: string;
};

type OptionStepperProps = {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function OptionStepper({ label, value, suffix, min, max, step, onChange }: OptionStepperProps) {
  const labelId = useId();
  return (
    <div className="option-field" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="option-label">{label}</span>
      <div className="option-stepper">
        <button
          className="round option-step-button"
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <img src="/png/default/ui/controls/icon_minus.png" alt="" />
        </button>
        <output className="option-value" aria-live="polite">{value} {suffix}</output>
        <button
          className="round option-step-button"
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <img src="/png/default/ui/controls/icon_plus.png" alt="" />
        </button>
      </div>
      <small>{min}–{max} seconds</small>
    </div>
  );
}

export function OptionsModal({ open, options, onSave, onClose, saveLabel = 'Save & Main Menu' }: Props) {
  const [draft, setDraft] = useState(options);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(options);
  }, [open, options]);

  return (
    <AccessibleDialog
      open={open}
      labelledBy="options-title"
      panelClassName="options-panel"
      initialFocusRef={closeButtonRef}
      onClose={onClose}
    >
        <button ref={closeButtonRef} className="options-close round" type="button" onClick={onClose} aria-label="Close options">
          <img src="/png/default/ui/controls/icon_close.png" alt="" />
        </button>
        <h1 id="options-title">Options</h1>
        <OptionStepper
          label="Game session time"
          value={draft.sessionDuration}
          suffix="s"
          {...GAME_OPTION_LIMITS.sessionDuration}
          onChange={(sessionDuration) => setDraft((current) => ({ ...current, sessionDuration }))}
        />
        <OptionStepper
          label="Enemy spawn time"
          value={draft.spawnInterval}
          suffix="s"
          {...GAME_OPTION_LIMITS.spawnInterval}
          onChange={(spawnInterval) => setDraft((current) => ({ ...current, spawnInterval }))}
        />
        <button className="menu-button menu-button-primary options-save" type="button" onClick={() => onSave(draft)}>
          <span>{saveLabel}</span>
        </button>
    </AccessibleDialog>
  );
}
