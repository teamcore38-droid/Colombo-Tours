const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 45_000;
const DEFAULT_RETRY_DELAY_MS = import.meta.env.MODE === 'test' ? 10 : 450;

export function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.isTimeout || err.isNetworkError) return true;
  return err.status === 502 || err.status === 503 || err.status === 504;
}

export async function apiFetch(path, options = {}) {
  const {
    body,
    headers = {},
    timeoutMs,
    retries = 0,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    signal: externalSignal,
    ...rest
  } = options;
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;
  const effectiveTimeout =
    timeoutMs !== undefined
      ? timeoutMs
      : isFormData
        ? UPLOAD_TIMEOUT_MS
        : DEFAULT_TIMEOUT_MS;

  const url = resolveApiUrl(path);
  const maxAttempts = Math.max(1, 1 + Number(retries || 0));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    let didTimeout = false;
    let timeoutId = null;

    const handleExternalAbort = () => {
      controller?.abort();
    };

    if (controller && externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', handleExternalAbort, {
          once: true,
        });
      }
    }

    if (controller && effectiveTimeout > 0) {
      timeoutId = window.setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, effectiveTimeout);
    }

    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: isFormData
          ? body
          : body !== undefined && typeof body !== 'string'
            ? JSON.stringify(body)
            : body,
        ...(controller ? { signal: controller.signal } : {}),
        ...rest,
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        const error = new Error(
          data?.error || `Request failed with status ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      let normalized = err;

      if (didTimeout) {
        normalized = new Error(
          'The server took too long to respond. Please check your connection and try again.'
        );
        normalized.status = 408;
        normalized.isTimeout = true;
      } else if (err?.name === 'AbortError') {
        throw err;
      } else if (err instanceof TypeError) {
        normalized = new Error(
          'Unable to connect right now. Please check your internet connection and try again.'
        );
        normalized.status = 0;
        normalized.isNetworkError = true;
      }

      if (attempt < maxAttempts && isRetryableError(normalized)) {
        await sleep(retryDelayMs);
        continue;
      }
      throw normalized;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (externalSignal) {
        externalSignal.removeEventListener('abort', handleExternalAbort);
      }
    }
  }
}
