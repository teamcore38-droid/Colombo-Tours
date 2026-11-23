import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const LANGUAGE_STORAGE_KEY = 'colombo-tours-lang';

/**
 * Supported storefront languages.
 * Add any Google Translate language code here later (e.g. 'fr', 'de', 'ar', 'ru', 'hi')
 * without needing hardcoded translation dictionaries.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල', shortLabel: 'සිං' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', shortLabel: 'தமி' },
  { code: 'zh-CN', label: 'Chinese', nativeLabel: '中文', shortLabel: '中文' },
];

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
const GOOGLE_TRANSLATE_SCRIPT_ID = 'colombo-tours-google-translate-script';
const GOOGLE_TRANSLATE_CONTAINER_ID = 'google_translate_element';
const GOOGLE_TRANSLATE_CALLBACK = 'colomboToursGoogleTranslateInit';

let reactDomPatchInstalled = false;
let scriptLoadPromise = null;

export function isValidLanguageCode(code) {
  return typeof code === 'string' && SUPPORTED_CODES.has(code);
}

/**
 * Defensive DOM guard for React + Google Translate.
 * Google Translate wraps text nodes in <font> tags, which can cause React reconciliation
 * to throw NotFoundError when updating/unmounting dynamic lists (filters, modals).
 * Only installed when a visitor activates a non-English language (0 overhead for English).
 */
function installGoogleTranslateReactGuard() {
  if (reactDomPatchInstalled || typeof Node === 'undefined') return;
  reactDomPatchInstalled = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function patchedRemoveChild(child) {
    if (child && child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function patchedInsertBefore(
    newNode,
    referenceNode
  ) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode);
  };
}

function writeGoogTransCookie(langCode) {
  if (typeof document === 'undefined') return;
  const secureFlag =
    typeof window !== 'undefined' && window.location?.protocol === 'https:'
      ? '; Secure'
      : '';
  const hostname =
    typeof window !== 'undefined' ? window.location?.hostname || '' : '';

  if (!isValidLanguageCode(langCode) || langCode === 'en') {
    document.cookie = `googtrans=; path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
    if (hostname && hostname.includes('.')) {
      document.cookie = `googtrans=; path=/; domain=.${hostname}; Max-Age=0; SameSite=Lax${secureFlag}`;
    }
    return;
  }

  const value = `/en/${langCode}`;
  document.cookie = `googtrans=${value}; path=/; SameSite=Lax${secureFlag}`;
  if (hostname && hostname.includes('.')) {
    document.cookie = `googtrans=${value}; path=/; domain=.${hostname}; SameSite=Lax${secureFlag}`;
  }
}

function ensureTranslateContainer() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(GOOGLE_TRANSLATE_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = GOOGLE_TRANSLATE_CONTAINER_ID;
    el.className = 'notranslate sr-only';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function loadGoogleTranslateEngine() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  // Skip external script injection during unit tests (jsdom)
  if (import.meta.env.MODE === 'test') {
    return Promise.resolve(false);
  }

  if (window.google?.translate?.TranslateElement) {
    return Promise.resolve(true);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  installGoogleTranslateReactGuard();
  ensureTranslateContainer();

  scriptLoadPromise = new Promise((resolve) => {
    const includedLanguages = SUPPORTED_LANGUAGES.map((l) => l.code).join(',');

    window[GOOGLE_TRANSLATE_CALLBACK] = () => {
      try {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages,
              autoDisplay: false,
            },
            GOOGLE_TRANSLATE_CONTAINER_ID
          );
          resolve(true);
          return;
        }
      } catch {
        // Fallback cleanly if third-party script fails to initialize
      }
      resolve(false);
    };

    const existing = document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID);
    if (existing) {
      resolve(Boolean(window.google?.translate?.TranslateElement));
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
    script.src = `https://translate.google.com/translate_a/element.js?cb=${GOOGLE_TRANSLATE_CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      scriptLoadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

function triggerGoogleCombo(langCode, attempt = 0) {
  if (typeof document === 'undefined') return;
  const combo = document.querySelector('.goog-te-combo');
  if (combo) {
    if (combo.value !== langCode) {
      combo.value = langCode;
    }
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (attempt < 20) {
    window.setTimeout(() => triggerGoogleCombo(langCode, attempt + 1), 150);
  }
}

function readInitialLanguage() {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isValidLanguageCode(saved)) {
      return saved;
    }
  } catch {
    // ignore storage access issues
  }
  return 'en';
}

function isAdminPath() {
  if (typeof window === 'undefined') return false;
  return window.location?.pathname?.startsWith('/admin');
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readInitialLanguage);
  const [translating, setTranslating] = useState(false);

  // Keep <html lang="..."> synced and lazily boot Google Translate only when non-English is active on storefront
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }

    if (language === 'en' || isAdminPath()) {
      return;
    }

    let cancelled = false;
    setTranslating(true);
    writeGoogTransCookie(language);

    loadGoogleTranslateEngine().then((ready) => {
      if (cancelled) return;
      if (ready) {
        triggerGoogleCombo(language);
      }
      setTranslating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback(
    async (nextCode) => {
      const safeCode = isValidLanguageCode(nextCode) ? nextCode : 'en';
      const prevCode = language;

      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, safeCode);
      } catch {
        // ignore
      }

      writeGoogTransCookie(safeCode);
      setLanguageState(safeCode);

      if (typeof document !== 'undefined') {
        document.documentElement.lang = safeCode;
      }

      if (isAdminPath() || import.meta.env.MODE === 'test') {
        return;
      }

      if (safeCode === 'en') {
        // Restore original English cleanly if Google Translate had previously translated the DOM
        if (prevCode !== 'en') {
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            combo.value = 'en';
            combo.dispatchEvent(new Event('change', { bubbles: true }));
          }
          // If Google Translate left translated class on <html>, do a fast reload to restore pristine English DOM
          if (
            document.documentElement.classList.contains('translated-ltr') ||
            document.documentElement.classList.contains('translated-rtl')
          ) {
            window.location.reload();
          }
        }
        return;
      }

      setTranslating(true);
      const ready = await loadGoogleTranslateEngine();
      if (ready) {
        triggerGoogleCombo(safeCode);
      }
      setTranslating(false);
    },
    [language]
  );

  const currentLanguage = useMemo(
    () =>
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0],
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      currentLanguage,
      languages: SUPPORTED_LANGUAGES,
      translating,
      setLanguage,
    }),
    [language, currentLanguage, translating, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: 'en',
      currentLanguage: SUPPORTED_LANGUAGES[0],
      languages: SUPPORTED_LANGUAGES,
      translating: false,
      setLanguage: () => {},
    };
  }
  return ctx;
}
