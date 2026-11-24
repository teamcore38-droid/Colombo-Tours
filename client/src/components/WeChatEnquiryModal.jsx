import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSite } from '../context/SiteContext';
import { resolveApiUrl } from '../lib/api';
import { optimizeCloudinaryDeliveryUrl } from '../lib/imageOptimize';
import { WeChatIcon } from './ChannelButtons';

async function copyTextSafe(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function WeChatEnquiryModal() {
  const { settings, wechatEnquiry, closeWeChatEnquiry } = useSite();
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    if (!wechatEnquiry) return undefined;
    setCopiedField('');
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeWeChatEnquiry();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wechatEnquiry, closeWeChatEnquiry]);

  if (!wechatEnquiry) return null;

  const wechatId = wechatEnquiry.wechatId || settings.wechatId || '';
  const rawQrUrl = wechatEnquiry.wechatQrUrl || settings.wechatQrUrl || '';
  const qrSrc = rawQrUrl
    ? optimizeCloudinaryDeliveryUrl(resolveApiUrl(rawQrUrl), 640)
    : '';
  const message = wechatEnquiry.message || settings.supportGreeting || '';
  const subjectLabel = wechatEnquiry.subjectLabel || '';

  const handleCopy = async (field, text) => {
    const ok = await copyTextSafe(text);
    if (ok) {
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((curr) => (curr === field ? '' : curr));
      }, 2400);
    }
  };

  const handleCopyAndOpenWeChat = async () => {
    await copyTextSafe(message);
    setCopiedField('open');
    window.setTimeout(() => {
      setCopiedField((curr) => (curr === 'open' ? '' : curr));
    }, 3500);
    // Attempt WeChat mobile deep link cleanly without leaving current page broken
    try {
      window.location.href = 'weixin://';
    } catch {
      // Desktop browsers safely ignore custom protocol if WeChat desktop isn't registered
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wechat-modal-title"
      data-testid="wechat-enquiry-modal"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        onClick={closeWeChatEnquiry}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[var(--border-gold)] bg-[var(--bg-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#07C160]/35 bg-[#07C160]/12 text-[#07C160]">
              <WeChatIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="wechat-modal-title"
                className="text-base sm:text-lg font-semibold text-[var(--text-primary)]"
              >
                Book via{' '}
                <span translate="no" className="notranslate">
                  WeChat
                </span>
              </h2>
              {subjectLabel ? (
                <p
                  translate="no"
                  className="notranslate truncate text-xs text-[var(--gold-accent)]"
                >
                  {subjectLabel}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Colombo Tours Concierge
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={closeWeChatEnquiry}
            aria-label="Close WeChat booking dialog"
            data-testid="close-wechat-modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* WeChat ID box */}
          {wechatId ? (
            <div className="rounded-xl border border-[var(--border-gold)] bg-[var(--bg-card-elevated)] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Official WeChat ID
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span
                  translate="no"
                  data-testid="wechat-modal-id"
                  className="notranslate font-mono text-sm sm:text-base font-semibold text-[var(--text-primary)] break-all"
                >
                  {wechatId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('id', wechatId)}
                  data-testid="wechat-copy-id-btn"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
                >
                  {copiedField === 'id' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {/* Scannable QR Code (when uploaded in Admin) */}
          {qrSrc ? (
            <div className="flex flex-col items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-4 text-center">
              <div className="overflow-hidden rounded-xl bg-white p-2.5 shadow-sm">
                <img
                  src={qrSrc}
                  alt="Colombo Tours WeChat QR Code"
                  data-testid="wechat-modal-qr"
                  className="h-44 w-44 object-contain"
                />
              </div>
              <p className="mt-2.5 text-xs text-[var(--text-muted)]">
                Scan with WeChat to add our concierge directly
              </p>
            </div>
          ) : null}

          {/* Pre-filled enquiry message */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Pre-filled Booking Message
              </span>
              <button
                type="button"
                onClick={() => handleCopy('message', message)}
                data-testid="wechat-copy-message-btn"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--gold-accent)] hover:underline cursor-pointer"
              >
                {copiedField === 'message' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>
            </div>
            <p
              data-testid="wechat-modal-message"
              className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-[var(--text-primary)] select-all"
            >
              {message}
            </p>
          </div>

          {copiedField === 'open' ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300"
            >
              Enquiry message copied! Paste it in your WeChat chat
              {wechatId ? ` with ${wechatId}` : ''}.
            </p>
          ) : null}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4 space-y-2">
          <button
            type="button"
            onClick={handleCopyAndOpenWeChat}
            data-testid="wechat-copy-open-btn"
            className="btn-gold inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm cursor-pointer"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>Copy Enquiry &amp; Open WeChat</span>
          </button>
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Availability &amp; tailored rates are confirmed directly with our team
          </p>
        </div>
      </div>
    </div>
  );
}
