import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DEFAULT_DURATION_MS = {
  success: 4500,
  info: 4500,
  error: 8000,
};

function AdminToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const duration =
    toast.duration !== undefined
      ? toast.duration
      : DEFAULT_DURATION_MS[toast.type] || 4500;

  useEffect(() => {
    if (paused || duration <= 0) return undefined;
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, duration, paused, onDismiss]);

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  const containerTone = isError
    ? 'border-red-500/45 bg-[var(--bg-surface)]/98 text-red-600 dark:text-red-300'
    : isInfo
      ? 'border-[var(--border-gold-strong)] bg-[var(--bg-surface)]/98 text-[var(--gold-accent)]'
      : 'border-emerald-500/45 bg-[var(--bg-surface)]/98 text-emerald-600 dark:text-emerald-300';

  const accentStrip = isError
    ? 'bg-red-500'
    : isInfo
      ? 'bg-[var(--gold-bright)]'
      : 'bg-emerald-500';

  const Icon = isError ? AlertCircle : isInfo ? Info : CheckCircle2;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      data-testid={isError ? 'admin-error-banner' : 'admin-toast-notice'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border p-3.5 pl-4 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.65)] backdrop-blur-md ${containerTone}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${accentStrip}`}
      />
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-xs sm:text-sm leading-snug text-[var(--text-primary)]">
        {toast.title ? (
          <p className="font-semibold text-current">{toast.title}</p>
        ) : null}
        <p className={toast.title ? 'mt-0.5 text-[var(--text-secondary)]' : ''}>
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        data-testid="admin-toast-dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--gold-soft-bg)] hover:text-[var(--text-primary)] cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Floating viewport-anchored toast stack for Admin feedback.
 * Always visible regardless of scroll position and auto-dismisses cleanly.
 */
export function AdminToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      translate="no"
      aria-label="Admin notifications"
      data-testid="admin-toast-stack"
      className="notranslate pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-2.5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[390px]"
    >
      {toasts.map((toast) => (
        <AdminToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
