import { useOptionalSite } from '../context/SiteContext';
import { buildTelegramUrl, isWeChatConfigured } from '../lib/channels';
import { WhatsAppButton, WhatsAppIcon } from './WhatsAppButton';

export { WhatsAppButton, WhatsAppIcon };

export function TelegramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M21.94 4.35a1.5 1.5 0 0 0-1.64-.24L2.63 11.15a1.36 1.36 0 0 0 .08 2.55l4.38 1.46 1.69 5.29a1.1 1.1 0 0 0 1.84.42l2.63-2.58 4.46 3.29a1.5 1.5 0 0 0 2.35-.89l2.44-14.92a1.5 1.5 0 0 0-.58-1.42Zm-4.18 3.92-7.55 6.8a.75.75 0 0 0-.23.43l-.34 2.53-.98-3.07 9.1-6.69Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WeChatIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9.5 3.5C4.8 3.5 1 6.72 1 10.69c0 2.24 1.21 4.24 3.12 5.56l-.78 2.35 2.72-1.36c1.05.33 2.21.51 3.44.51.34 0 .68-.02 1.01-.05a6.5 6.5 0 0 1-.27-1.85c0-3.78 3.54-6.85 7.91-6.85.27 0 .54.01.8.04C18.18 5.83 14.23 3.5 9.5 3.5Zm-2.85 5.6a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Zm5.7 0a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3Z"
        fill="currentColor"
      />
      <path
        d="M17.25 10.35c-3.73 0-6.75 2.48-6.75 5.55 0 3.06 3.02 5.55 6.75 5.55.86 0 1.69-.13 2.45-.38l2.2.98-.58-1.92c1.61-1.01 2.68-2.54 2.68-4.23 0-3.07-3.02-5.55-6.75-5.55Zm-2.2 4.65a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9Zm4.4 0a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

const SIZE_STYLES = {
  xs: 'px-2.5 py-2 text-[11px] gap-1',
  sm: 'px-3 py-2 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm sm:text-base gap-2',
};

const VARIANT_STYLES = {
  gold: 'btn-gold rounded-full',
  outline:
    'rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] transition-colors',
};

/**
 * Centralized Telegram enquiry button.
 * Opens https://t.me/<handle>?text=<message> and automatically disables when
 * no valid Telegram username/number is configured in Admin.
 */
export function TelegramButton({
  telegramHandle,
  message,
  children = 'Telegram',
  variant = 'outline',
  size = 'sm',
  disabled = false,
  className = '',
  ariaLabel,
  onClick,
  showIcon = true,
  dataTestId,
}) {
  const site = useOptionalSite();
  const effectiveHandle =
    telegramHandle !== undefined
      ? telegramHandle
      : site?.settings?.telegramHandle || '';
  const url = buildTelegramUrl(effectiveHandle, message);
  const isDisabled = disabled || !url;

  const baseClass = `inline-flex items-center justify-center font-medium leading-none select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] ${SIZE_STYLES[size] || SIZE_STYLES.sm} ${VARIANT_STYLES[variant] || VARIANT_STYLES.outline} ${className}`;

  if (isDisabled) {
    const disabledReason = !url
      ? 'Telegram enquiry is unavailable until a valid Telegram username or number is configured in Admin.'
      : 'Please correct the form details before sending your Telegram enquiry.';
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={ariaLabel || disabledReason}
        title={disabledReason}
        data-testid={dataTestId}
        className={`${baseClass} ${
          variant === 'outline'
            ? 'opacity-50 cursor-not-allowed hover:bg-[var(--bg-pill)] hover:border-[var(--border-gold)]'
            : ''
        }`}
      >
        {showIcon ? (
          <TelegramIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#2AABEE]" />
        ) : null}
        <span translate="no" className="notranslate">
          {children}
        </span>
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel || `Book via Telegram`}
      onClick={onClick}
      data-testid={dataTestId}
      className={`${baseClass} cursor-pointer`}
    >
      {showIcon ? (
        <TelegramIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#2AABEE]" />
      ) : null}
      <span translate="no" className="notranslate">
        {children}
      </span>
    </a>
  );
}

/**
 * Centralized WeChat enquiry button.
 * Opens the luxury WeChat Concierge modal with pre-filled English message,
 * copyable WeChat ID, optional scannable QR code, and mobile app deep link.
 * Automatically disables until a valid WeChat ID or QR code is configured in Admin.
 */
export function WeChatButton({
  wechatId,
  wechatQrUrl,
  message,
  subjectLabel = '',
  children = 'WeChat',
  variant = 'outline',
  size = 'sm',
  disabled = false,
  className = '',
  ariaLabel,
  onClick,
  showIcon = true,
  dataTestId,
}) {
  const site = useOptionalSite();
  const effectiveId =
    wechatId !== undefined ? wechatId : site?.settings?.wechatId || '';
  const effectiveQr =
    wechatQrUrl !== undefined ? wechatQrUrl : site?.settings?.wechatQrUrl || '';
  const configured = isWeChatConfigured(effectiveId, effectiveQr);
  const isDisabled = disabled || !configured;

  const baseClass = `inline-flex items-center justify-center font-medium leading-none select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] ${SIZE_STYLES[size] || SIZE_STYLES.sm} ${VARIANT_STYLES[variant] || VARIANT_STYLES.outline} ${className}`;

  if (isDisabled) {
    const disabledReason = !configured
      ? 'WeChat enquiry is unavailable until a valid WeChat ID or QR code is configured in Admin.'
      : 'Please correct the form details before sending your WeChat enquiry.';
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={ariaLabel || disabledReason}
        title={disabledReason}
        data-testid={dataTestId}
        className={`${baseClass} ${
          variant === 'outline'
            ? 'opacity-50 cursor-not-allowed hover:bg-[var(--bg-pill)] hover:border-[var(--border-gold)]'
            : ''
        }`}
      >
        {showIcon ? (
          <WeChatIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#07C160]" />
        ) : null}
        <span translate="no" className="notranslate">
          {children}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel || 'Book via WeChat'}
      data-testid={dataTestId}
      onClick={(e) => {
        onClick?.(e);
        site?.openWeChatEnquiry?.({
          message: String(message || '').trim(),
          subjectLabel,
          wechatId: effectiveId,
          wechatQrUrl: effectiveQr,
        });
      }}
      className={`${baseClass} cursor-pointer`}
    >
      {showIcon ? (
        <WeChatIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-[#07C160]" />
      ) : null}
      <span translate="no" className="notranslate">
        {children}
      </span>
    </button>
  );
}

/**
 * Cohesive 3-channel booking group: WhatsApp (primary gold), Telegram, and WeChat.
 * Used across Vehicle Cards, Hero Banner, Quick Enquiry, Vehicle Specs Modal,
 * Services Cards, Mobile Drawer, and Footer.
 */
export function BookingChannelGroup({
  message,
  subjectLabel = '',
  whatsappNumber,
  telegramHandle,
  wechatId,
  wechatQrUrl,
  disabled = false,
  size = 'xs',
  layout = 'grid',
  whatsappTestId,
  telegramTestId,
  wechatTestId,
  className = '',
  onChannelClick,
}) {
  const site = useOptionalSite();
  const resolvedWa =
    whatsappNumber !== undefined
      ? whatsappNumber
      : site?.settings?.whatsappNumber || '';
  const resolvedTg =
    telegramHandle !== undefined
      ? telegramHandle
      : site?.settings?.telegramHandle || '';
  const resolvedWcId =
    wechatId !== undefined ? wechatId : site?.settings?.wechatId || '';
  const resolvedWcQr =
    wechatQrUrl !== undefined ? wechatQrUrl : site?.settings?.wechatQrUrl || '';

  const containerClass =
    layout === 'row'
      ? `flex flex-wrap items-center gap-2 ${className}`
      : `grid grid-cols-3 gap-1.5 sm:gap-2 ${className}`;

  const btnWidthClass = layout === 'row' ? '' : 'w-full min-w-0';

  return (
    <div className={containerClass} role="group" aria-label="Booking channels">
      <WhatsAppButton
        whatsappNumber={resolvedWa}
        message={message}
        disabled={disabled}
        variant="gold"
        size={size === 'xs' ? 'sm' : size}
        dataTestId={whatsappTestId}
        onClick={onChannelClick}
        className={`${btnWidthClass} ${
          size === 'xs' ? 'px-2 py-2.5 text-[11px] sm:text-xs font-semibold' : ''
        }`}
      >
        <span translate="no" className="notranslate">
          WhatsApp
        </span>
      </WhatsAppButton>

      <TelegramButton
        telegramHandle={resolvedTg}
        message={message}
        disabled={disabled}
        variant="outline"
        size={size}
        dataTestId={telegramTestId}
        onClick={onChannelClick}
        className={`${btnWidthClass} ${
          size === 'xs' ? 'px-2 py-2.5 text-[11px] sm:text-xs font-medium' : ''
        }`}
      >
        Telegram
      </TelegramButton>

      <WeChatButton
        wechatId={resolvedWcId}
        wechatQrUrl={resolvedWcQr}
        message={message}
        subjectLabel={subjectLabel}
        disabled={disabled}
        variant="outline"
        size={size}
        dataTestId={wechatTestId}
        onClick={onChannelClick}
        className={`${btnWidthClass} ${
          size === 'xs' ? 'px-2 py-2.5 text-[11px] sm:text-xs font-medium' : ''
        }`}
      >
        WeChat
      </WeChatButton>
    </div>
  );
}
