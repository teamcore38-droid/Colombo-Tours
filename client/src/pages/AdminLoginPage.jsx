import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useAdminPageMeta } from '../hooks/useAdminPageMeta';
import { apiFetch } from '../lib/api';

export function AdminLoginPage() {
  useAdminPageMeta('Staff Portal — Colombo Tours');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(() => {
        if (active) navigate('/admin', { replace: true });
      })
      .catch(() => {
        // Not signed in yet
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      translate="no"
      className="notranslate flex min-h-screen flex-col items-center justify-center bg-[var(--bg-page)] px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link to="/" aria-label="Return to Colombo Tours storefront">
            <BrandLogo variant="full" className="h-24" />
          </Link>
        </div>

        <div className="card-luxury rounded-2xl p-6 sm:p-7">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Staff Admin Portal
            </h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Sign in with your authorized Colombo Tours staff account to manage
              vehicles, photos, categories, and WhatsApp settings.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              data-testid="admin-login-error"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Staff Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your staff email"
                  data-testid="admin-email-input"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  data-testid="admin-password-input"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="admin-login-submit"
              className="btn-gold w-full rounded-full py-2.5 text-sm cursor-pointer"
            >
              {submitting ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--gold-accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Colombo Tours Storefront</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
