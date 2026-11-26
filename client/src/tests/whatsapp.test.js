import { describe, expect, it } from 'vitest';
import {
  buildQuickEnquiryMessage,
  buildServiceEnquiryMessage,
  buildTelegramUrl,
  buildVehicleEnquiryMessage,
  buildVehicleShareUrl,
  buildWhatsAppUrl,
  formatTelegramDisplay,
  formatVehicleDetailsSummary,
  isSafeQrUrl,
  isValidTelegramHandle,
  isValidTelegramLink,
  isValidWeChatId,
  isValidWeChatLink,
  isValidWhatsAppLink,
  isValidWhatsAppNumber,
  isWeChatConfigured,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
  parseSafeVehicleLinkLine,
  resolveTelegramUrl,
  resolveWeChatAction,
  resolveWhatsAppUrl,
  sanitizeVehicleSlug,
  validateRentalDates,
} from '../lib/channels';

describe('WhatsApp helpers', () => {
  it('normalizes and validates E.164 international phone numbers', () => {
    expect(normalizeWhatsAppNumber('+94 77 123 4567')).toBe('94771234567');
    expect(normalizeWhatsAppNumber('0094-77-123-4567')).toBe('94771234567');
    expect(isValidWhatsAppNumber('+94 77 123 4567')).toBe(true);
    expect(isValidWhatsAppNumber('0771234567')).toBe(false);
    expect(isValidWhatsAppNumber('1234')).toBe(false);
    expect(isValidWhatsAppNumber('')).toBe(false);
  });

  it('returns null URL when WhatsApp number is missing or invalid', () => {
    expect(buildWhatsAppUrl('', 'Hello')).toBeNull();
    expect(buildWhatsAppUrl('0771234567', 'Hello')).toBeNull();
    expect(buildWhatsAppUrl('+94 77 123 4567', 'Hello Colombo')).toBe(
      'https://wa.me/94771234567?text=Hello%20Colombo'
    );
  });

  it('formats vehicle, service, and quick enquiry messages accurately', () => {
    const directMsg = buildVehicleEnquiryMessage('Mercedes-Benz S-Class');
    expect(directMsg).toBe(
      'Hello Colombo Tours, I’m interested in renting the Mercedes-Benz S-Class. Could you confirm availability and share the rate?'
    );

    const serviceMsg = buildServiceEnquiryMessage('Airport Transfer (BIA / CMB) service');
    expect(serviceMsg).toContain('Airport Transfer (BIA / CMB) service');

    const quickMsg = buildQuickEnquiryMessage({
      targetType: 'vehicle',
      targetName: 'Land Rover Defender 110',
      pickupLocation: 'Bandaranaike International Airport (CMB)',
      pickupDate: '2026-12-10',
      returnDate: '2026-12-14',
      chauffeurPreferred: true,
    });
    expect(quickMsg).toContain('Land Rover Defender 110');
    expect(quickMsg).toContain('Pickup location: Bandaranaike International Airport (CMB)');
    expect(quickMsg).toContain('Pickup date: 2026-12-10');
    expect(quickMsg).toContain('Return date: 2026-12-14');
    expect(quickMsg).toContain('With professional chauffeur');
  });

  it('validates pickup and return dates against past dates and inverted ranges', () => {
    const today = '2026-11-22';
    expect(validateRentalDates('', '', today)).toBe('');
    expect(validateRentalDates('2026-11-25', '2026-11-28', today)).toBe('');
    expect(validateRentalDates('2026-11-20', '', today)).toContain('past');
    expect(validateRentalDates('', '2026-11-19', today)).toContain('past');
    expect(validateRentalDates('2026-11-28', '2026-11-25', today)).toContain(
      'earlier than the pickup date'
    );
  });

  it('normalizes, validates, and builds Telegram deep links for usernames and phone numbers', () => {
    expect(normalizeTelegramHandle('@ColomboTours')).toBe('ColomboTours');
    expect(normalizeTelegramHandle('https://t.me/ColomboTours_LK')).toBe(
      'ColomboTours_LK'
    );
    expect(normalizeTelegramHandle('+94 77 123 4567')).toBe('+94771234567');
    expect(formatTelegramDisplay('ColomboTours')).toBe('@ColomboTours');
    expect(formatTelegramDisplay('+94771234567')).toBe('+94771234567');

    expect(isValidTelegramHandle('@ColomboTours')).toBe(true);
    expect(isValidTelegramHandle('+94 77 123 4567')).toBe(true);
    expect(isValidTelegramHandle('ab')).toBe(false);
    expect(isValidTelegramHandle('bad handle!')).toBe(false);

    expect(buildTelegramUrl('', 'Hello')).toBeNull();
    expect(buildTelegramUrl('@ColomboTours', '')).toBe('https://t.me/ColomboTours');
    expect(buildTelegramUrl('@ColomboTours', 'Hello Colombo')).toBe(
      'https://t.me/ColomboTours?text=Hello%20Colombo'
    );
    expect(buildTelegramUrl('+94 77 123 4567', 'Hi')).toBe(
      'https://t.me/+94771234567?text=Hi'
    );
  });

  it('validates WeChat IDs and strictly sanitizes WeChat QR URLs', () => {
    expect(normalizeWeChatId('ColomboToursLK')).toBe('ColomboToursLK');
    expect(normalizeWeChatId('+94 77 123 4567')).toBe('+94771234567');
    expect(isValidWeChatId('ColomboToursLK')).toBe(true);
    expect(isValidWeChatId('+94771234567')).toBe(true);
    expect(isValidWeChatId('123')).toBe(false);
    expect(isValidWeChatId('<script>')).toBe(false);

    expect(isSafeQrUrl('https://res.cloudinary.com/demo/qr.webp')).toBe(true);
    expect(isSafeQrUrl('/api/media/abc123')).toBe(true);
    expect(isSafeQrUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeQrUrl('data:image/svg+xml;base64,abc')).toBe(false);
    expect(isSafeQrUrl('//evil.example/qr.png')).toBe(false);

    expect(isWeChatConfigured('', '')).toBe(false);
    expect(isWeChatConfigured('ColomboToursLK', '')).toBe(true);
    expect(isWeChatConfigured('', 'https://res.cloudinary.com/demo/qr.webp')).toBe(
      true
    );
  });

  it('validates direct social links strictly by domain and resolves active mode & enable flags', () => {
    const waLink = 'https://wa.me/message/KSBZDVJTSEJYC1?src=qr';
    const tgLink = 'https://t.me/COLOMBOTOURS';
    const wcLink = 'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2';

    expect(isValidWhatsAppLink(waLink)).toBe(true);
    expect(isValidWhatsAppLink('https://evil.example/message/123')).toBe(false);
    expect(isValidWhatsAppLink('http://wa.me/message/123')).toBe(false);

    expect(isValidTelegramLink(tgLink)).toBe(true);
    expect(isValidTelegramLink('https://evil.example/COLOMBOTOURS')).toBe(false);

    expect(isValidWeChatLink(wcLink)).toBe(true);
    expect(isValidWeChatLink('javascript:alert(1)')).toBe(false);
    expect(isValidWeChatLink('https://evil.example/wechat')).toBe(false);

    // Direct link mode resolves cleanly and respects enabled flag
    expect(
      resolveWhatsAppUrl({
        whatsappMode: 'link',
        whatsappLink: waLink,
        whatsappEnabled: true,
        message: 'Hi',
      })
    ).toBe(waLink);
    expect(
      resolveWhatsAppUrl({
        whatsappMode: 'link',
        whatsappLink: waLink,
        whatsappEnabled: false,
      })
    ).toBeNull();

    expect(
      resolveTelegramUrl({
        telegramMode: 'link',
        telegramLink: tgLink,
        telegramEnabled: true,
        message: 'Hi Colombo',
      })
    ).toBe('https://t.me/COLOMBOTOURS?text=Hi%20Colombo');
    expect(
      resolveTelegramUrl({
        telegramMode: 'link',
        telegramLink: 'https://t.me/+94725737391',
        telegramEnabled: true,
        message: 'Hi Colombo',
      })
    ).toBe('https://t.me/+94725737391?text=Hi%20Colombo');
    expect(
      resolveTelegramUrl({
        telegramMode: 'link',
        telegramLink: 'https://t.me/+AbCdEfGh1234',
        telegramEnabled: true,
        message: 'Hi Colombo',
      })
    ).toBe('https://t.me/+AbCdEfGh1234');

    const wcDirect = resolveWeChatAction({
      wechatMode: 'link',
      wechatLink: wcLink,
      wechatEnabled: true,
    });
    expect(wcDirect.active).toBe(true);
    expect(wcDirect.mode).toBe('link');
    expect(wcDirect.url).toBe(wcLink);

    const wcDisabled = resolveWeChatAction({
      wechatMode: 'link',
      wechatLink: wcLink,
      wechatEnabled: false,
    });
    expect(wcDisabled.active).toBe(false);
  });

  it('builds safe shareable vehicle links and omits verbose Details line in booking messages', () => {
    expect(sanitizeVehicleSlug('2024-bmw-i7-xdrive60')).toBe(
      '2024-bmw-i7-xdrive60'
    );
    expect(sanitizeVehicleSlug('../admin')).toBe('');
    expect(sanitizeVehicleSlug('<script>alert(1)</script>')).toBe('');

    expect(
      buildVehicleShareUrl(
        '2024-bmw-i7-xdrive60',
        'https://colombo-tours.vercel.app'
      )
    ).toBe('https://colombo-tours.vercel.app/v/2024-bmw-i7-xdrive60');
    expect(
      buildVehicleShareUrl('2024-bmw-i7-xdrive60', 'javascript:alert(1)')
    ).toBe('');

    const vehicle = {
      name: '2024 BMW i7 xDrive60',
      model: 'BMW i7 Luxury Flagship Sedan',
      slug: '2024-bmw-i7-xdrive60',
      specs: {
        seats: 4,
        transmission: 'Automatic',
        luggage: '3 Suitcases',
        fuelType: 'Electric',
        chauffeur: 'Chauffeur Included',
      },
    };

    expect(formatVehicleDetailsSummary(vehicle)).toBe(
      'BMW i7 Luxury Flagship Sedan · 4 Seats · Automatic · 3 Suitcases · Electric · Chauffeur Included'
    );

    const msg = buildVehicleEnquiryMessage(vehicle, {
      origin: 'https://colombo-tours.vercel.app',
    });
    expect(msg).toContain('2024 BMW i7 xDrive60');
    expect(msg).not.toContain('Details:');
    expect(msg).not.toContain('4 Seats');
    expect(msg).toContain(
      'Link: https://colombo-tours.vercel.app/v/2024-bmw-i7-xdrive60'
    );
    expect(msg).toContain(
      'Could you confirm availability and share the rate?'
    );

    // Safe link line parser accepts only valid vehicle share URLs
    expect(
      parseSafeVehicleLinkLine(
        'Link: https://colombo-tours.vercel.app/v/2024-bmw-i7-xdrive60'
      )
    ).toEqual({
      label: 'Link',
      href: 'https://colombo-tours.vercel.app/v/2024-bmw-i7-xdrive60',
      slug: '2024-bmw-i7-xdrive60',
    });
    expect(parseSafeVehicleLinkLine('Link: javascript:alert(1)')).toBeNull();
    expect(
      parseSafeVehicleLinkLine('Link: https://evil.example/admin')
    ).toBeNull();
  });
});
