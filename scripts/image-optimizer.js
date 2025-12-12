import sharp from 'sharp';

function isJpegByTypeOrName(contentType, filename) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/jpeg')) return true;
  const name = String(filename || '').toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg');
}

/**
 * Optionally recompress JPEGs in-memory.
 *
 * - Only touches JPEG inputs (by content-type or filename).
 * - Returns updated {buffer, contentType, filename}.
 * - If optimization is disabled, returns input unchanged.
 */
export async function maybeOptimizeJpeg({
  buffer,
  contentType,
  filename,
  enabled,
  quality,
  dryRun,
}) {
  if (!enabled) return { buffer, contentType, filename, optimized: false };
  if (dryRun) return { buffer, contentType, filename, optimized: false };
  if (!isJpegByTypeOrName(contentType, filename)) return { buffer, contentType, filename, optimized: false };

  const q = Math.max(1, Math.min(100, Number(quality || 70)));

  const out = await sharp(buffer)
    .jpeg({ quality: q, mozjpeg: true })
    .toBuffer();

  // Normalize extension for consistency
  const nextName = String(filename || 'image.jpg').replace(/\.jpeg$/i, '.jpg');

  return {
    buffer: out,
    contentType: 'image/jpeg',
    filename: nextName,
    optimized: true,
    beforeBytes: buffer?.length ?? 0,
    afterBytes: out?.length ?? 0,
  };
}


