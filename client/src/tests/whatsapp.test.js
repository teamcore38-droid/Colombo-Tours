import { describe, expect, it } from 'vitest';
import {
  buildQuickEnquiryMessage,
  buildServiceEnquiryMessage,
  buildTelegramUrl,
  buildVehicleEnquiryMessage,
  buildWhatsAppUrl,
  formatTelegramDisplay,
  isSafeQrUrl,
  isValidTelegramHandle,
  isValidWeChatId,
  isValidWhatsAppNumber,
  isWeChatConfigured,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
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
});
