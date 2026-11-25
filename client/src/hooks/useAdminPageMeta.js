import { useEffect } from 'react';

/**
 * Ensures private staff portal routes are never indexed by search engines
 * and display a clean contextual browser tab title.
 */
export function useAdminPageMeta(title) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }

    let meta = document.querySelector('meta[name="robots"]');
    const created = !meta;
    const prevContent = meta ? meta.getAttribute('content') : null;

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow, noarchive');

    return () => {
      document.title = prevTitle;
      if (created && meta.parentNode) {
        meta.parentNode.removeChild(meta);
      } else if (meta && prevContent !== null) {
        meta.setAttribute('content', prevContent);
      } else if (meta && prevContent === null) {
        meta.removeAttribute('content');
      }
    };
  }, [title]);
}
