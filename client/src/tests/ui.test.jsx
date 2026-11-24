import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroBanner } from '../components/HeroBanner';
import {
  isValidLanguageCode,
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
} from '../context/LanguageContext';
import { SiteProvider } from '../context/SiteContext';
import { ThemeProvider } from '../context/ThemeContext';
import { HomePage } from '../pages/HomePage';

function createBootstrapPayload({
  whatsappNumber = '',
  whatsappLink = '',
  whatsappMode = 'number',
  whatsappEnabled = true,
  telegramHandle = '',
  telegramLink = '',
  telegramMode = 'handle',
  telegramEnabled = true,
  wechatId = '',
  wechatLink = '',
  wechatMode = 'id',
  wechatEnabled = true,
  wechatQrUrl = '',
} = {}) {
  const whatsappConfigured =
    whatsappEnabled &&
    (whatsappMode === 'link' ? Boolean(whatsappLink) : Boolean(whatsappNumber));
  const telegramConfigured =
    telegramEnabled &&
    (telegramMode === 'link' ? Boolean(telegramLink) : Boolean(telegramHandle));
  const wechatConfigured =
    wechatEnabled &&
    (wechatMode === 'link'
      ? Boolean(wechatLink)
      : Boolean(wechatId || wechatQrUrl));

  return {
    settings: {
      companyName: 'Colombo Tours',
      tagline: 'Built Trust in Excellence',
      whatsappNumber,
      whatsappDisplay: whatsappNumber ? `+${whatsappNumber}` : '',
      whatsappLink,
      whatsappMode,
      whatsappEnabled,
      whatsappConfigured,
      telegramHandle,
      telegramDisplay: telegramHandle
        ? telegramHandle.startsWith('+')
          ? telegramHandle
          : `@${telegramHandle}`
        : '',
      telegramLink,
      telegramMode,
      telegramEnabled,
      telegramConfigured,
      wechatId,
      wechatDisplay: wechatId,
      wechatLink,
      wechatMode,
      wechatEnabled,
      wechatQrUrl,
      wechatConfigured,
      anyBookingChannelConfigured:
        whatsappConfigured || telegramConfigured || wechatConfigured,
      heroHeadline: 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
      heroSubheadline: 'Premier Sri Lankan chauffeur fleet.',
      supportGreeting: 'Hello Colombo Tours, I’d like to enquire.',
    },
    categories: [
      { _id: 'cat-lux', name: 'Luxury', slug: 'luxury', sortOrder: 1 },
      { _id: 'cat-suv', name: 'SUV', slug: 'suv', sortOrder: 2 },
      { _id: 'cat-wed', name: 'Wedding', slug: 'wedding', sortOrder: 3 },
      { _id: 'cat-chf', name: 'Chauffeur', slug: 'chauffeur', sortOrder: 4 },
    ],
    services: [
      {
        _id: 'srv-air',
        name: 'Airport Transfers (BIA / CMB)',
        slug: 'airport-transfers',
        badge: '24/7 Tracking',
        description: 'Direct BIA transfers.',
        icon: 'plane',
        whatsappLabel: 'Airport Transfer (BIA / CMB) service',
      },
    ],
    vehicles: [
      {
        _id: 'veh-1',
        name: '2024 Mercedes-Benz S-Class',
        model: 'S 500 AMG',
        slug: '2024-mercedes-benz-s-class',
        year: 2024,
        categories: [{ _id: 'cat-lux', name: 'Luxury', slug: 'luxury' }],
        description: 'Executive flagship luxury sedan.',
        specs: {
          seats: 5,
          transmission: 'Automatic',
          luggage: '3 Suitcases',
          chauffeur: 'Chauffeur Included',
          airConditioning: true,
        },
        highlights: ['Uniformed Chauffeur'],
        photos: [
          {
            url: '/vehicles/mercedes-s-class.webp',
            alt: 'Mercedes S-Class',
            isPrimary: true,
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
      {
        _id: 'veh-2',
        name: 'Land Rover Defender 110',
        model: 'Defender HSE',
        slug: 'land-rover-defender-110',
        year: 2024,
        categories: [{ _id: 'cat-suv', name: 'SUV', slug: 'suv' }],
        description: 'All-terrain luxury SUV.',
        specs: {
          seats: 5,
          transmission: 'Automatic',
          luggage: '4 Suitcases',
          chauffeur: 'Chauffeur Available',
          airConditioning: true,
        },
        highlights: [],
        photos: [], // Intentionally missing photo to verify fallback
        isPublished: true,
        isFeatured: false,
      },
    ],
  };
}

function renderStorefront(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => payload,
    })
  );

  return render(
    <ThemeProvider>
      <LanguageProvider>
        <SiteProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </SiteProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.lang = 'en';
  vi.restoreAllMocks();
});

describe('Colombo Tours Storefront UI', () => {
  it('defaults to dark mode, toggles light mode, and persists preference', async () => {
    const user = userEvent.setup();
    renderStorefront(createBootstrapPayload());

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('colombo-tours-theme')).toBe('light');
  });

  it('disables all WhatsApp, Telegram, and WeChat buttons until configured and omits prices/currency', async () => {
    renderStorefront(createBootstrapPayload({ whatsappNumber: '' }));

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    expect(screen.getByTestId('header-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('header-telegram-btn')).toBeDisabled();
    expect(screen.getByTestId('header-wechat-btn')).toBeDisabled();
    expect(screen.getByTestId('floating-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('floating-telegram-btn')).toBeDisabled();
    expect(screen.getByTestId('floating-wechat-btn')).toBeDisabled();
    expect(screen.getByTestId('hero-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('hero-telegram-btn')).toBeDisabled();
    expect(screen.getByTestId('hero-wechat-btn')).toBeDisabled();
    expect(
      screen.getByTestId('vehicle-whatsapp-2024-mercedes-benz-s-class')
    ).toBeDisabled();
    expect(
      screen.getByTestId('vehicle-telegram-2024-mercedes-benz-s-class')
    ).toBeDisabled();
    expect(
      screen.getByTestId('vehicle-wechat-2024-mercedes-benz-s-class')
    ).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-telegram-btn')).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-wechat-btn')).toBeDisabled();
    expect(screen.getByTestId('service-whatsapp-airport-transfers')).toBeDisabled();
    expect(screen.getByTestId('service-telegram-airport-transfers')).toBeDisabled();
    expect(screen.getByTestId('service-wechat-airport-transfers')).toBeDisabled();

    // Ensure no mock pricing or currency toggles leak into DOM
    expect(document.body.textContent).not.toMatch(/Rs\.\s*45,000/i);
    expect(document.body.textContent).not.toMatch(/\bLKR\b/);
    expect(document.body.textContent).not.toMatch(/\bUSD\b/);
  });

  it('builds accurate WhatsApp, Telegram, and WeChat enquiries for vehicles, services, and Quick Enquiry with optional details', async () => {
    const user = userEvent.setup();
    renderStorefront(
      createBootstrapPayload({
        whatsappNumber: '94771234567',
        telegramHandle: 'ColomboTours',
        wechatId: 'ColomboToursLK',
        wechatQrUrl: 'https://res.cloudinary.com/demo/image/upload/v1/qr.webp',
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    const mercBtn = screen.getByTestId(
      'vehicle-whatsapp-2024-mercedes-benz-s-class'
    );
    expect(mercBtn.tagName).toBe('A');
    expect(mercBtn.getAttribute('href')).toContain('https://wa.me/94771234567?text=');
    expect(decodeURIComponent(mercBtn.getAttribute('href'))).toContain(
      '2024 Mercedes-Benz S-Class'
    );

    // Telegram direct vehicle enquiry link
    const mercTgBtn = screen.getByTestId(
      'vehicle-telegram-2024-mercedes-benz-s-class'
    );
    expect(mercTgBtn.tagName).toBe('A');
    expect(mercTgBtn.getAttribute('href')).toContain(
      'https://t.me/ColomboTours?text='
    );
    expect(decodeURIComponent(mercTgBtn.getAttribute('href'))).toContain(
      '2024 Mercedes-Benz S-Class'
    );

    // WeChat button opens concierge modal with WeChat ID, QR code, and pre-filled message
    await user.click(
      screen.getByTestId('vehicle-wechat-2024-mercedes-benz-s-class')
    );
    const wcModal = screen.getByTestId('wechat-enquiry-modal');
    expect(wcModal).toBeInTheDocument();
    expect(within(wcModal).getByTestId('wechat-modal-id')).toHaveTextContent(
      'ColomboToursLK'
    );
    expect(within(wcModal).getByTestId('wechat-modal-qr')).toBeInTheDocument();
    expect(within(wcModal).getByTestId('wechat-modal-message')).toHaveTextContent(
      '2024 Mercedes-Benz S-Class'
    );
    await user.click(screen.getByTestId('close-wechat-modal'));
    expect(screen.queryByTestId('wechat-enquiry-modal')).not.toBeInTheDocument();

    const srvBtn = screen.getByTestId('service-whatsapp-airport-transfers');
    expect(srvBtn.getAttribute('href')).toContain('https://wa.me/94771234567?text=');
    expect(decodeURIComponent(srvBtn.getAttribute('href'))).toContain(
      'Airport Transfer (BIA / CMB) service'
    );

    const srvTgBtn = screen.getByTestId('service-telegram-airport-transfers');
    expect(srvTgBtn.getAttribute('href')).toContain(
      'https://t.me/ColomboTours?text='
    );
    expect(decodeURIComponent(srvTgBtn.getAttribute('href'))).toContain(
      'Airport Transfer (BIA / CMB) service'
    );

    // Quick enquiry with pickup location & valid dates
    await user.selectOptions(
      screen.getByTestId('quick-enquiry-target'),
      'vehicle:Land Rover Defender 110'
    );
    await user.type(
      screen.getByTestId('quick-enquiry-location'),
      'Colombo City'
    );
    await user.type(screen.getByTestId('quick-enquiry-pickup-date'), '2099-05-10');
    await user.type(screen.getByTestId('quick-enquiry-return-date'), '2099-05-14');

    const qeBtn = screen.getByTestId('quick-enquiry-whatsapp-btn');
    expect(qeBtn.tagName).toBe('A');
    const decodedQe = decodeURIComponent(qeBtn.getAttribute('href'));
    expect(decodedQe).toContain('Land Rover Defender 110');
    expect(decodedQe).toContain('Pickup location: Colombo City');
    expect(decodedQe).toContain('Pickup date: 2099-05-10');
    expect(decodedQe).toContain('Return date: 2099-05-14');

    const qeTgBtn = screen.getByTestId('quick-enquiry-telegram-btn');
    expect(qeTgBtn.tagName).toBe('A');
    const decodedQeTg = decodeURIComponent(qeTgBtn.getAttribute('href'));
    expect(decodedQeTg).toContain('Land Rover Defender 110');
    expect(decodedQeTg).toContain('Pickup location: Colombo City');

    // Quick enquiry WeChat modal carries pickup location & dates
    await user.click(screen.getByTestId('quick-enquiry-wechat-btn'));
    const qeWcModal = screen.getByTestId('wechat-enquiry-modal');
    expect(
      within(qeWcModal).getByTestId('wechat-modal-message')
    ).toHaveTextContent('Pickup location: Colombo City');
    await user.click(screen.getByTestId('close-wechat-modal'));

    // Invalid date range disables ALL 3 Quick Enquiry channels and shows error
    await user.clear(screen.getByTestId('quick-enquiry-return-date'));
    await user.type(screen.getByTestId('quick-enquiry-return-date'), '2099-05-05');
    expect(screen.getByTestId('quick-enquiry-date-error')).toHaveTextContent(
      /earlier than the pickup date/i
    );
    expect(screen.getByTestId('quick-enquiry-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-telegram-btn')).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-wechat-btn')).toBeDisabled();
  });

  it('supports search, category filtering, empty state recovery, missing photo fallback, and specs modal', async () => {
    const user = userEvent.setup();
    renderStorefront(createBootstrapPayload({ whatsappNumber: '94771234567' }));

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    // Missing photo fallback shown for Defender
    expect(screen.getByTestId('missing-photo-fallback')).toBeInTheDocument();

    // Open Vehicle Specs modal
    await user.click(
      screen.getByTestId('vehicle-specs-2024-mercedes-benz-s-class')
    );
    const modal = screen.getByTestId('vehicle-specs-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('3 Suitcases')).toBeInTheDocument();
    expect(within(modal).getByText('Uniformed Chauffeur')).toBeInTheDocument();
    await user.click(screen.getByTestId('close-specs-modal'));
    expect(screen.queryByTestId('vehicle-specs-modal')).not.toBeInTheDocument();

    // Category filter
    await user.click(screen.getByTestId('category-pill-suv'));
    expect(
      screen.queryByTestId('vehicle-card-2024-mercedes-benz-s-class')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('vehicle-card-land-rover-defender-110')
    ).toBeInTheDocument();

    // Empty search state + reset
    const searchInputs = screen.getAllByTestId('fleet-search-input');
    await user.type(searchInputs[0], 'Ferrari');
    expect(screen.getByTestId('empty-fleet-state')).toBeInTheDocument();

    await user.click(screen.getByTestId('reset-filters-btn'));
    expect(
      screen.getByTestId('vehicle-card-2024-mercedes-benz-s-class')
    ).toBeInTheDocument();
  });

  it('renders responsive hero banner for mobile and desktop with working auto-carousel', async () => {
    vi.useFakeTimers();
    try {
      const payload = createBootstrapPayload({ whatsappNumber: '94771234567' });
      render(
        <HeroBanner
          featuredVehicles={payload.vehicles}
          settings={payload.settings}
          autoPlayMs={3000}
        />
      );

      const banner = screen.getByTestId('hero-banner');
      expect(banner.className).not.toContain('hidden');
      expect(screen.getByTestId('hero-active-vehicle-badge')).toHaveTextContent(
        '2024 Mercedes-Benz S-Class'
      );

      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(screen.getByTestId('hero-active-vehicle-badge')).toHaveTextContent(
        'Land Rover Defender 110'
      );
      expect(
        decodeURIComponent(
          screen.getByTestId('hero-whatsapp-btn').getAttribute('href')
        )
      ).toContain('Land Rover Defender 110');
    } finally {
      vi.useRealTimers();
    }
  });

  it('provides header language switcher (EN default, Sinhala, Tamil, Chinese) and stacked floating WeChat, Telegram & WhatsApp buttons', async () => {
    const user = userEvent.setup();
    renderStorefront(
      createBootstrapPayload({
        whatsappNumber: '94771234567',
        telegramHandle: 'ColomboTours',
        wechatId: 'ColomboToursLK',
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    // Header chat buttons wrapper is hidden on mobile (shown on md+)
    const headerWa = screen.getByTestId('header-whatsapp-btn');
    expect(headerWa.parentElement.className).toContain('hidden');
    expect(headerWa.parentElement.className).toContain('md:flex');

    // Floating dock stacks WeChat (top) -> Telegram (middle) -> WhatsApp (bottom)
    const floatingDock = screen.getByTestId('floating-contact-dock');
    expect(floatingDock.className).toContain('fixed');
    const dockButtons = Array.from(floatingDock.children).map((el) =>
      el.getAttribute('data-testid')
    );
    expect(dockButtons).toEqual([
      'floating-wechat-btn',
      'floating-telegram-btn',
      'floating-whatsapp-btn',
    ]);

    const floatingWa = screen.getByTestId('floating-whatsapp-btn');
    expect(floatingWa.tagName).toBe('A');
    expect(floatingWa.getAttribute('href')).toContain(
      'https://wa.me/94771234567?text='
    );

    const floatingTg = screen.getByTestId('floating-telegram-btn');
    expect(floatingTg.tagName).toBe('A');
    expect(floatingTg.getAttribute('href')).toContain(
      'https://t.me/ColomboTours?text='
    );

    // Language switcher defaults to English and lists EN, Sinhala, Tamil, Chinese
    const langBtn = screen.getByTestId('language-switcher-btn');
    expect(langBtn).toHaveTextContent('EN');
    expect(document.documentElement.lang).toBe('en');

    await user.click(langBtn);
    const menu = screen.getByTestId('language-switcher-menu');
    expect(within(menu).getByTestId('language-option-en')).toBeInTheDocument();
    expect(within(menu).getByTestId('language-option-si')).toBeInTheDocument();
    expect(within(menu).getByTestId('language-option-ta')).toBeInTheDocument();
    expect(within(menu).getByTestId('language-option-zh-CN')).toBeInTheDocument();

    // Switch to Sinhala and verify persistence + html lang update
    await user.click(within(menu).getByTestId('language-option-si'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('si');
    expect(document.documentElement.lang).toBe('si');
    expect(screen.getByTestId('language-switcher-btn')).toHaveTextContent('සිං');

    // Switch to Chinese
    await user.click(screen.getByTestId('language-switcher-btn'));
    await user.click(screen.getByTestId('language-option-zh-CN'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');

    // Allowlist safeguard rejects invalid/injected language codes
    expect(isValidLanguageCode('si')).toBe(true);
    expect(isValidLanguageCode('ta')).toBe(true);
    expect(isValidLanguageCode('zh-CN')).toBe(true);
    expect(isValidLanguageCode('en; evil=1')).toBe(false);
    expect(isValidLanguageCode('<script>')).toBe(false);
  });

  it('supports Direct Link mode and channel enable toggles across WhatsApp, Telegram, and WeChat', async () => {
    renderStorefront(
      createBootstrapPayload({
        whatsappLink: 'https://wa.me/message/KSBZDVJTSEJYC1?src=qr',
        whatsappMode: 'link',
        whatsappEnabled: true,
        telegramLink: 'https://t.me/COLOMBOTOURS',
        telegramMode: 'link',
        telegramEnabled: true,
        wechatLink: 'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2',
        wechatMode: 'link',
        wechatEnabled: true,
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    const waCard = screen.getByTestId(
      'vehicle-whatsapp-2024-mercedes-benz-s-class'
    );
    expect(waCard.tagName).toBe('A');
    expect(waCard.getAttribute('href')).toBe(
      'https://wa.me/message/KSBZDVJTSEJYC1?src=qr'
    );

    const tgCard = screen.getByTestId(
      'vehicle-telegram-2024-mercedes-benz-s-class'
    );
    expect(tgCard.tagName).toBe('A');
    expect(tgCard.getAttribute('href')).toContain(
      'https://t.me/COLOMBOTOURS?text='
    );

    const wcCard = screen.getByTestId(
      'vehicle-wechat-2024-mercedes-benz-s-class'
    );
    expect(wcCard.tagName).toBe('A');
    expect(wcCard.getAttribute('href')).toBe(
      'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2'
    );

    const floatingWc = screen.getByTestId('floating-wechat-btn');
    expect(floatingWc.tagName).toBe('A');
    expect(floatingWc.getAttribute('href')).toBe(
      'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2'
    );
  });
});
