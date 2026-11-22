import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  optimizeCloudinaryDeliveryUrl,
} from '../lib/imageOptimize';

describe('Image optimization helpers', () => {
  it('injects Cloudinary responsive f_auto/q_auto transforms on raw Cloudinary URLs', () => {
    const raw =
      'https://res.cloudinary.com/demo/image/upload/v1700000000/colombo-tours/vehicles/s-class.webp';
    expect(optimizeCloudinaryDeliveryUrl(raw, 960)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,w_960,c_limit/v1700000000/colombo-tours/vehicles/s-class.webp'
    );
  });

  it('does not modify non-Cloudinary URLs or already-transformed Cloudinary URLs', () => {
    expect(optimizeCloudinaryDeliveryUrl('/vehicles/bmw-i7-card.webp', 960)).toBe(
      '/vehicles/bmw-i7-card.webp'
    );
    const transformed =
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/car.webp';
    expect(optimizeCloudinaryDeliveryUrl(transformed, 960)).toBe(transformed);
  });

  it('formats byte counts cleanly in KB and MB', () => {
    expect(formatFileSize(153600)).toBe('150 KB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });
});
