import sharp from 'sharp';

function isJpegByTypeOrName(contentType, filename) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/jpeg')) return true;
  const name = String(filename || '').toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg');
}

function isPngByTypeOrName(contentType, filename) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/png')) return true;
  const name = String(filename || '').toLowerCase();
  return name.endsWith('.png');
}

/**
 * Convert PNG to JPG and optionally compress images.
 *
 * - Converts PNG images to JPG format.
 * - Only compresses if file size >= 200KB.
 * - Returns updated {buffer, contentType, filename}.
 * - If optimization is disabled, still converts PNG to JPG.
 */
export async function maybeOptimizeJpeg({
  buffer,
  contentType,
  filename,
  enabled,
  quality,
  dryRun,
}) {
  if (dryRun) return { buffer, contentType, filename, optimized: false };

  const originalSize = buffer?.length ?? 0;
  const sizeThreshold = 200 * 1024; // 200KB in bytes
  
  let workingBuffer = buffer;
  let workingContentType = contentType;
  let workingFilename = filename;
  let converted = false;
  let optimized = false;

  // Step 1: Convert PNG to JPG (always, even if optimization is disabled)
  if (isPngByTypeOrName(contentType, filename)) {
    console.log(`   🔄 Converting PNG to JPG: ${filename}`);
    workingBuffer = await sharp(buffer)
      .jpeg({ quality: 95, mozjpeg: true }) // High quality for conversion
      .toBuffer();
    
    workingContentType = 'image/jpeg';
    workingFilename = String(filename || 'image.png').replace(/\.png$/i, '.jpg');
    converted = true;
    
    console.log(`   ✓ Converted: ${originalSize}B → ${workingBuffer.length}B`);
  }

  // Step 2: Compress if enabled AND file size >= 200KB
  if (enabled && workingBuffer.length >= sizeThreshold) {
    // Ensure we're working with JPEG
    if (isJpegByTypeOrName(workingContentType, workingFilename)) {
      const q = Math.max(1, Math.min(100, Number(quality || 70)));
      const beforeCompression = workingBuffer.length;

      workingBuffer = await sharp(workingBuffer)
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();

      // Normalize extension for consistency
      workingFilename = String(workingFilename || 'image.jpg').replace(/\.jpeg$/i, '.jpg');
      workingContentType = 'image/jpeg';
      optimized = true;

      console.log(`   🗜️  Compressed (≥200KB): ${beforeCompression}B → ${workingBuffer.length}B (q=${q})`);
    }
  } else if (enabled && workingBuffer.length < sizeThreshold) {
    console.log(`   ⏭️  Skipped compression (under 200KB): ${workingBuffer.length}B`);
  }

  return {
    buffer: workingBuffer,
    contentType: workingContentType,
    filename: workingFilename,
    optimized,
    converted,
    beforeBytes: originalSize,
    afterBytes: workingBuffer?.length ?? 0,
  };
}


