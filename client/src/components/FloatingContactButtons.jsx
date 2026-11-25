import { useSite } from '../context/SiteContext';
import {
  resolveTelegramUrl,
  resolveWeChatAction,
  resolveWhatsAppUrl,
} from '../lib/channels';
import { TelegramIcon, WeChatIcon, WhatsAppIcon } from './ChannelButtons';

/**
 * Stacked floating concierge dock pinned to the bottom-right corner:
 *   Top:    WeChat
 *   Middle: Telegram
 *   Bottom: WhatsApp
 *
 * Each button resolves its active Admin mode (Number/ID vs Direct Link)
 * and enable toggle, automatically disabling when unconfigured or unticked.
 */
export function FloatingContactButtons() {
  const { settings, openWeChatEnquiry } = useSite();
  const message = settings.supportGreeting;

  const waUrl = resolveWhatsAppUrl({
    whatsappNumber: settings.whatsappNumber,
    whatsappLink: settings.whatsappLink,
    whatsappMode: settings.whatsappMode,
    whatsappEnabled: settings.whatsappEnabled,
    message,
  });
  const tgUrl = resolveTelegramUrl({
    telegramHandle: settings.telegramHandle,
    telegramLink: settings.telegramLink,
    telegramMode: settings.telegramMode,
    telegramEnabled: settings.telegramEnabled,
    message,
  });
  const wcAction = resolveWeChatAction({
    wechatId: settings.wechatId,
    wechatLink: settings.wechatLink,
    wechatQrUrl: settings.wechatQrUrl,
    wechatMode: settings.wechatMode,
    wechatEnabled: settings.wechatEnabled,
  });

  const circleBase =
    'inline-flex h-12 w-12 items-center justify-center rounded-full shadow-[0_12px_28px_-6px_rgba(0,0,0,0.68)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] transition-transform active:scale-95';

  const secondaryEnabled =
    'border border-[var(--border-gold-strong)] bg-[var(--bg-surface)]/95 backdrop-blur-md hover:scale-105 hover:border-[#E8CB7D] cursor-pointer';
  const secondaryDisabled =
    'border border-[var(--border-gold)] bg-[var(--bg-surface)]/75 opacity-55 cursor-not-allowed';

  return (
    <div
      data-testid="floating-contact-dock"
      aria-label="Quick concierge messaging channels"
      className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-center gap-2.5"
    >
      {/* Top: WeChat */}
      {wcAction.active && wcAction.mode === 'link' && wcAction.url ? (
        <a
          href={wcAction.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WeChat Support"
          title="Connect with Colombo Tours on WeChat"
          data-testid="floating-wechat-btn"
          className={`${circleBase} ${secondaryEnabled} text-[#07C160]`}
        >
          <WeChatIcon className="h-5 w-5" />
        </a>
      ) : wcAction.active ? (
        <button
          type="button"
          onClick={() =>
            openWeChatEnquiry({
              message,
              subjectLabel: 'General Concierge Support',
              wechatId: wcAction.wechatId,
              wechatQrUrl: wcAction.wechatQrUrl,
              wechatLink: wcAction.wechatLink,
            })
          }
          aria-label="WeChat Support"
          title="Chat with Colombo Tours on WeChat"
          data-testid="floating-wechat-btn"
          className={`${circleBase} ${secondaryEnabled} text-[#07C160]`}
        >
          <WeChatIcon className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="WeChat concierge is currently unavailable."
          title="WeChat concierge is currently unavailable."
          data-testid="floating-wechat-btn"
          className={`${circleBase} ${secondaryDisabled} text-[#07C160]/70`}
        >
          <WeChatIcon className="h-5 w-5" />
        </button>
      )}

      {/* Middle: Telegram */}
      {tgUrl ? (
        <a
          href={tgUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram Support"
          title="Chat with Colombo Tours on Telegram"
          data-testid="floating-telegram-btn"
          className={`${circleBase} ${secondaryEnabled} text-[#2AABEE]`}
        >
          <TelegramIcon className="h-5 w-5" />
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Telegram concierge is currently unavailable."
          title="Telegram concierge is currently unavailable."
          data-testid="floating-telegram-btn"
          className={`${circleBase} ${secondaryDisabled} text-[#2AABEE]/70`}
        >
          <TelegramIcon className="h-5 w-5" />
        </button>
      )}

      {/* Bottom: WhatsApp (Primary brushed champagne-gold) */}
      {waUrl ? (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp Support"
          title="Chat with Colombo Tours on WhatsApp"
          data-testid="floating-whatsapp-btn"
          className={`btn-gold ${circleBase} ring-1 ring-[#F3DC96]/45 hover:scale-105`}
        >
          <WhatsAppIcon className="h-6 w-6" />
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="WhatsApp concierge is currently unavailable."
          title="WhatsApp concierge is currently unavailable."
          data-testid="floating-whatsapp-btn"
          className={`btn-gold ${circleBase} ring-1 ring-[#F3DC96]/30`}
        >
          <WhatsAppIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
