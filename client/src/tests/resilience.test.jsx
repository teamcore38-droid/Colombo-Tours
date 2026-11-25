import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { apiFetch } from '../lib/api';

function ThrowingComponent() {
  throw new Error('Simulated render failure');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Client API Resilience & React ErrorBoundary', () => {
  it('aborts stalled API requests after timeoutMs and surfaces a friendly timeout error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              const abortErr = new Error('Aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          })
      )
    );

    await expect(
      apiFetch('/api/bootstrap', { timeoutMs: 25 })
    ).rejects.toMatchObject({
      isTimeout: true,
      status: 408,
      message: expect.stringMatching(/took too long/i),
    });
  });

  it('normalizes offline network failures and retries once on transient 503 when retries is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );

    await expect(apiFetch('/api/bootstrap')).rejects.toMatchObject({
      isNetworkError: true,
      message: expect.stringMatching(/internet connection/i),
    });

    const flakyFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Temporarily unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', flakyFetch);
    const result = await apiFetch('/api/bootstrap', { retries: 1 });
    expect(result).toEqual({ ok: true });
    expect(flakyFetch).toHaveBeenCalledTimes(2);
  });

  it('renders a branded ErrorBoundary fallback instead of a blank screen when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('app-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-reload')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
