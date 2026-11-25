import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

/**
 * Branded, accessible confirmation modal replacing browser-native window.confirm().
 * Focuses Cancel by default so accidental Enter presses never execute destructive actions,
 * locks background scroll while open, and prevents dismissal while a request is in flight.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  itemName = '',
  consequence = '',
  confirmLabel = 'Confirm',
  busyLabel = 'Working...',
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelBtnRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current =
      typeof document !== 'undefined' ? document.activeElement : null;

    const prevOverflow =
      typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }

    const focusFrame = window.requestAnimationFrame(() => {
      cancelBtnRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = prevOverflow;
      }
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function'
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (!busy) {
          e.preventDefault();
          onCancel?.();
        }
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const isWarning = variant === 'warning';
  const iconBoxClass = isWarning
    ? 'border-amber-500/35 bg-amber-500/12 text-amber-500 dark:text-amber-300'
    : 'border-red-500/35 bg-red-500/12 text-red-500 dark:text-red-400';
  const consequenceBoxClass = isWarning
    ? 'border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-200'
    : 'border-red-500/25 bg-red-500/8 text-red-600 dark:text-red-300';
  const confirmBtnClass = isWarning
    ? 'bg-amber-600 text-white hover:bg-amber-500 focus-visible:outline-amber-400'
    : 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-400';

  return (
    <div
      translate="no"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-testid="admin-confirm-dialog"
      className="notranslate fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        aria-hidden="true"
        onClick={() => {
          if (!busy) onCancel?.();
        }}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
      />

      <div
        ref={dialogRef}
        className="animate-modal-in relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-gold)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconBoxClass}`}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id={titleId}
                data-testid="confirm-dialog-title"
                className="text-base sm:text-lg font-semibold leading-snug text-[var(--text-primary)]"
              >
                {title}
              </h2>
              {itemName ? (
                <p className="mt-1 inline-flex max-w-full items-center truncate rounded-lg border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--gold-accent)]">
                  {itemName}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!busy) onCancel?.();
            }}
            aria-label="Close confirmation dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <p
            id={descId}
            className="text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            {description}
          </p>

          {consequence ? (
            <p
              className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${consequenceBoxClass}`}
            >
              {consequence}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] px-5 py-3.5">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={busy}
            onClick={() => {
              if (!busy) onCancel?.();
            }}
            data-testid="confirm-dialog-cancel"
            className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
            className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-semibold shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-65 disabled:cursor-not-allowed cursor-pointer ${confirmBtnClass}`}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{busyLabel}</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
