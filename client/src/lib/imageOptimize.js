const TARGET_MAX_BYTES = 190 * 1024; // ~190 KB sweet spot (150–200 KB range)
const SKIP_ALREADY_OPTIMIZED_BYTES = 160 * 1024;

function encodeCanvas(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (webpBlob) => {
        if (webpBlob && webpBlob.type === 'image/webp') {
          return resolve(webpBlob);
        }
        // Fallback for very old browsers without Canvas WebP encoding
        canvas.toBlob((jpgBlob) => resolve(jpgBlob), 'image/jpeg', quality);
      },
      'image/webp',
      quality
    );
  });
}

function drawResized(img, maxWidth, maxHeight) {
  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return canvas;
}

/**
 * Adaptive client-side WebP image optimizer.
 * Converts PNG/JPEG/other formats into sharp WebP targeting <= ~190 KB before upload
 * so large multi-MB photos upload rapidly and stay well below Vercel's 4.5 MB body limit.
 */
export async function optimizeImageForUpload(
  file,
  {
    maxWidth = 1280,
    maxHeight = 960,
    targetMaxBytes = TARGET_MAX_BYTES,
  } = {}
) {
  if (!file || !file.type?.startsWith('image/')) {
    return file;
  }

  // Only skip if already a lightweight WebP image under 160 KB
  if (file.type === 'image/webp' && file.size <= SKIP_ALREADY_OPTIMIZED_BYTES) {
    return file;
  }

  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read image dimensions.'));
      el.src = bitmapUrl;
    });
    URL.revokeObjectURL(bitmapUrl);

    // Pass 1: Sharp 1280px max width with gentle quality steps (preserves crisp details)
    let canvas = drawResized(img, maxWidth, maxHeight);
    if (!canvas) return file;

    const qualitySteps = [0.85, 0.79, 0.73, 0.67];
    let bestBlob = null;

    for (const q of qualitySteps) {
      const candidate = await encodeCanvas(canvas, q);
      if (!candidate) continue;
      bestBlob = candidate;
      if (candidate.size <= targetMaxBytes) {
        break;
      }
    }

    // Pass 2: If a very detailed multi-MB photo is still above 200 KB, gently scale to 1080px
    if (bestBlob && bestBlob.size > targetMaxBytes + 15 * 1024 && maxWidth > 1080) {
      const compactCanvas = drawResized(img, 1080, 810);
      if (compactCanvas) {
        for (const q of [0.76, 0.70]) {
          const candidate = await encodeCanvas(compactCanvas, q);
          if (candidate && candidate.size < bestBlob.size) {
            bestBlob = candidate;
          }
          if (bestBlob.size <= targetMaxBytes) {
            break;
          }
        }
      }
    }

    if (!bestBlob) {
      return file;
    }

    // Always prefer WebP over PNG/JPEG even if file was tiny, otherwise only replace if smaller
    const convertedToWebp =
      bestBlob.type === 'image/webp' && file.type !== 'image/webp';
    if (!convertedToWebp && bestBlob.size >= file.size) {
      return file;
    }

    const ext = bestBlob.type === 'image/webp' ? '.webp' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([bestBlob], `${baseName}${ext}`, {
      type: bestBlob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Injects Cloudinary on-the-fly CDN optimization (`f_auto,q_auto:good,w_...,c_limit`)
 * so both new WebP uploads and any existing Cloudinary PNG/JPEG assets load fast on mobile.
 */
export function optimizeCloudinaryDeliveryUrl(url, width = 960) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com/')) {
    return url;
  }
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const afterMarker = url.slice(idx + marker.length);
  // Don't double-inject if a delivery transform is already present
  if (/^(f_|q_|w_|c_|t_)/.test(afterMarker)) {
    return url;
  }

  const safeWidth = Math.max(320, Math.min(1600, Number(width) || 960));
  return `${url.slice(0, idx + marker.length)}f_auto,q_auto:good,w_${safeWidth},c_limit/${afterMarker}`;
}
