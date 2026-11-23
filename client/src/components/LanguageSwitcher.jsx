import { Check, ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export function LanguageSwitcher({ className = '' }) {
  const { language, currentLanguage, languages, translating, setLanguage } =
    useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (code) => {
    setOpen(false);
    setLanguage(code);
  };

  return (
    <div
      ref={containerRef}
      translate="no"
      className={`notranslate relative ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change language (current: ${currentLanguage.label})`}
        title="Change website language"
        data-testid="language-switcher-btn"
        className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-2.5 sm:px-3 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] cursor-pointer"
      >
        <Globe
          className={`h-3.5 w-3.5 shrink-0 text-[var(--gold-accent)] ${
            translating ? 'animate-spin' : ''
          }`}
          aria-hidden="true"
        />
        <span className="leading-none">{currentLanguage.shortLabel}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select language"
          data-testid="language-switcher-menu"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--border-gold)] bg-[var(--bg-surface)] p-1.5 shadow-2xl z-50"
        >
          {languages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid={`language-option-${lang.code}`}
                onClick={() => handleSelect(lang.code)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--gold-soft-bg)] font-semibold text-[var(--gold-accent)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)]/60'
                }`}
              >
                <span className="flex flex-col">
                  <span>{lang.nativeLabel}</span>
                  {lang.nativeLabel !== lang.label ? (
                    <span className="text-[10px] font-normal text-[var(--text-muted)]">
                      {lang.label}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--gold-accent)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
