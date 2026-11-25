import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Component } from 'react';

/**
 * Top-level React Error Boundary so an unexpected client render exception
 * displays a branded recovery card instead of a blank screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[Colombo Tours UI Error]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="app-error-boundary"
          className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-page)] px-4 py-12 text-center text-[var(--text-primary)]"
        >
          <div className="card-luxury w-full max-w-md rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                Something went wrong
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                We encountered an unexpected display error. Reload the page or
                return to our fleet homepage to continue browsing.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                data-testid="error-boundary-reload"
                className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reload Page</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="pill-gold-outline inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs sm:text-sm cursor-pointer"
              >
                <Home className="h-4 w-4 text-[var(--gold-accent)]" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
