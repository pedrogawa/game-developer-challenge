import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Props = {
  open: boolean;
  labelledBy: string;
  describedBy?: string;
  panelClassName: string;
  overlayClassName?: string;
  role?: 'dialog' | 'alertdialog';
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose?: () => void;
  closeOnEscape?: boolean;
  children: ReactNode;
};

export function AccessibleDialog({
  open,
  labelledBy,
  describedBy,
  panelClassName,
  overlayClassName = 'options-overlay',
  role = 'dialog',
  initialFocusRef,
  onClose,
  closeOnEscape = true,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusDialog = requestAnimationFrame(() => {
      (initialFocusRef?.current ?? dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape && onClose) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusDialog);
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [closeOnEscape, initialFocusRef, onClose, open]);

  if (!open) return null;

  return (
    <div className={overlayClassName}>
      <div
        ref={dialogRef}
        className={panelClassName}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
