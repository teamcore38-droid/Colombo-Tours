/**
 * Lightweight client-side image optimization using HTML5 Canvas.
 * Resizes large mobile/DSLR uploads to max 1280px wide and compresses to WebP
 * (or JPEG fallback) before uploading, keeping mobile page loads blazing fast
 * and comfortably below Vercel's 4.5 MB serverless body limit.
 */
export async function optimizeImageForUpload(
  file,
  { maxWidth = 1280, maxHeight = 960, quality = 0.82 } = {}
) {
  if (!file || !file.type?.startsWith('image/')) {
    return file;
  }

  // Skip tiny already-optimized images (< 90 KB)
  if (file.size < 90 * 1024 && (file.type === 'image/webp' || file.type === 'image/jpeg')) {
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

    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const preferType = 'image/webp';
    const blob = await new Promise((resolve) =>
      canvas.toBlob(
        (b) => {
          if (b && b.type === preferType) return resolve(b);
          canvas.toBlob((jpg) => resolve(jpg), 'image/jpeg', quality);
        },
        preferType,
        quality
      )
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
