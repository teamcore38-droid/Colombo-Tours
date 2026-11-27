import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;

function getUtf8ByteLength(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return str.length;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function AdminSecurityCard({
  admin,
  onAdminUpdated,
  onRequestConfirm,
  onSignedOutAll,
  onSessionExpired,
  showToast,
  showError,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const rules = useMemo(() => {
    const byteLen = getUtf8ByteLength(newPassword);
    return {
      length:
        newPassword.length >= MIN_PASSWORD_LENGTH &&
        byteLen <= MAX_PASSWORD_BYTES,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      digit: /\d/.test(newPassword),
      symbol: /[^A-Za-z0-9]/.test(newPassword),
      matches: Boolean(newPassword) && newPassword === confirmPassword,
    };
  }, [newPassword, confirmPassword]);

  const allRulesSatisfied =
    Boolean(currentPassword) &&
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.digit &&
    rules.symbol &&
    rules.matches;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    if (!currentPassword) {
      setFormError('Please enter your current password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
      return;
    }
    if (getUtf8ByteLength(newPassword) > MAX_PASSWORD_BYTES) {
      setFormError(`New password must not exceed ${MAX_PASSWORD_BYTES} bytes.`);
      return;
    }
    if (!rules.upper || !rules.lower || !rules.digit || !rules.symbol) {
      setFormError(
        'New password must include uppercase, lowercase, a number, and a special character.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setFormError('New password must be different from your current password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword,
          newPassword,
          confirmPassword,
        },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      if (res?.admin) {
        onAdminUpdated?.(res.admin);
      }
      showToast(
        res?.message ||
          'Password updated. All other sessions have been signed out.'
      );
    } catch (err) {
      if (
        err?.status === 401 &&
        err?.data?.code !== 'INVALID_CURRENT_PASSWORD'
      ) {
        onSessionExpired?.();
        return;
      }
      const message =
        err?.message || 'Could not update password. Please try again.';
      setFormError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestLogoutAll = () => {
    onRequestConfirm?.({
      title: 'Sign Out All Devices?',
      itemName: admin?.email || 'Staff Admin Account',
      description:
        'This will immediately revoke every active staff session across all browsers and phones.',
      consequence:
        'You will also be signed out on this device and redirected to the sign-in screen.',
      confirmLabel: 'Sign Out Everywhere',
      busyLabel: 'Signing out...',
      variant: 'warning',
      onConfirm: async () => {
        await apiFetch('/api/auth/logout-all', { method: 'POST' });
        onSignedOutAll?.();
      },
    });
  };

  const passwordChangedText = formatDateTime(admin?.passwordChangedAt);
  const lastLoginText = formatDateTime(admin?.lastLoginAt);

  return (
    <div
      data-testid="admin-security-card"
      className="card-luxury rounded-2xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <KeyRound className="h-4.5 w-4.5 text-[var(--gold-accent)]" />
            <span>Account Security &amp; Password</span>
          </h2>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Update the password for{' '}
            <span className="font-medium text-[var(--text-secondary)]">
              {admin?.email || 'your staff account'}
            </span>
            . Changing your password immediately invalidates all other active
            sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRequestLogoutAll}
          data-testid="admin-logout-all-btn"
          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out All Devices</span>
        </button>
      </div>

      {passwordChangedText || lastLoginText ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-[var(--border-gold)]/50 bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
            <span>
              Password last updated:{' '}
              <strong className="font-medium text-[var(--text-primary)]">
                {passwordChangedText || 'Initial setup'}
              </strong>
            </span>
          </span>
          {lastLoginText ? (
            <span>
              Last sign-in:{' '}
              <strong className="font-medium text-[var(--text-primary)]">
                {lastLoginText}
              </strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          data-testid="admin-change-password-error"
          className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="admin-current-password"
              className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="admin-current-password"
                type={showCurrent ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="admin-current-password-input"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={
                  showCurrent ? 'Hide current password' : 'Show current password'
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-new-password"
              className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="admin-new-password"
                type={showNew ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 12 characters"
                data-testid="admin-new-password-input"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                aria-label={
                  showNew ? 'Hide new password' : 'Show new password'
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-confirm-password"
              className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="admin-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                data-testid="admin-confirm-password-input"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={
                  showConfirm
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Password Policy Checklist */}
        <div
          aria-label="Password requirements"
          className="flex flex-wrap gap-2 text-[11px]"
        >
          {[
            { ok: rules.length, label: '12–72 chars' },
            { ok: rules.upper, label: 'Uppercase' },
            { ok: rules.lower, label: 'Lowercase' },
            { ok: rules.digit, label: 'Number' },
            { ok: rules.symbol, label: 'Symbol' },
            { ok: rules.matches, label: 'Passwords match' },
          ].map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 transition-colors ${
                item.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-pill)] text-[var(--text-muted)]'
              }`}
            >
              <Check className="h-3 w-3" />
              <span>{item.label}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-[11px] text-[var(--text-muted)]">
            Need emergency recovery without the current password? Run{' '}
            <code className="rounded bg-[var(--bg-pill)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              npm run reset-password
            </code>{' '}
            from your server environment.
          </p>

          <button
            type="submit"
            disabled={submitting || !allRulesSatisfied}
            data-testid="admin-change-password-submit"
            className="btn-gold inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
