import { CarFront } from 'lucide-react';
import { useEffect, useState } from 'react';
import { resolveApiUrl } from '../lib/api';
import { optimizeCloudinaryDeliveryUrl } from '../lib/imageOptimize';

/**
 * Lightweight image component with native lazy loading below the fold,
 * automatic Cloudinary f_auto/q_auto responsive delivery,
 * and a polished studio fallback when a vehicle photo is missing or fails to load.
 */
export function VehiclePhoto({
  src,
  alt = 'Colombo Tours vehicle',
  eager = false,
  priority = false,
  deliveryWidth = 960,
  className = 'h-full w-full object-cover',
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const resolvedSrc = src
    ? optimizeCloudinaryDeliveryUrl(resolveApiUrl(src), deliveryWidth)
    : '';

  if (!resolvedSrc || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — photo unavailable`}
        data-testid="missing-photo-fallback"
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#1E1E26] to-[#111116] px-4 text-center text-[#9E9789]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#DFC173]">
          <CarFront className="h-6 w-6" />
        </div>
        <span className="text-xs font-medium tracking-wide text-[#C9C3B7]">
          Photo Coming Soon
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={eager || priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
