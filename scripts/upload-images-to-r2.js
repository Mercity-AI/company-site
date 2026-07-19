import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import mime from 'mime-types';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { maybeOptimizeJpeg } from './image-optimizer.js';
import { extractMarkdownImageTargets, replaceMarkdownLinks } from './markdown-links.js';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  const explicitNoOptimize = args.has('--no-optimize-jpeg');
  return {
    dryRun: args.has('--dry-run'),
    includeRemote: args.has('--include-remote'),
    localOnly: args.has('--local-only'),
    remoteOnly: args.has('--remote-only'),
    allowAllRemote: args.has('--allow-all-remote'),
    // Default ON. Use --no-optimize-jpeg to disable.
    optimizeJpeg: !explicitNoOptimize,
    jpegQuality: (() => {
      const idx = argv.indexOf('--jpeg-quality');
      if (idx !== -1 && argv[idx + 1]) {
        const n = Number(argv[idx + 1]);
        if (Number.isFinite(n) && n >= 1 && n <= 100) return Math.round(n);
      }
      return 70;
    })(),
    contentDir: (() => {
      const idx = argv.indexOf('--content-dir');
      if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
      return null;
    })(),
  };
}

const args = parseArgs(process.argv);

// Default behavior: process LOCAL images only (original behavior).
// Remote mirroring is opt-in via --include-remote (or explicitly via --remote-only).
const enableRemote = !args.localOnly && (args.includeRemote || args.remoteOnly);
const enableLocal = !args.remoteOnly;

// Validate environment variables unless dry-run
const requiredEnvVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'];
if (!args.dryRun) {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Error: Missing required environment variable: ${envVar}`);
      console.error('Please check your .env file and ensure all variables are set.');
      process.exit(1);
    }
  }
}

// Initialize S3 client for R2 (only when not dry-run)
const s3Client = args.dryRun
  ? null
  : new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

// Track uploaded files to avoid duplicates in single run
const uploadedFiles = new Set();
const optimizationStats = {
  optimizedCount: 0,
  totalBeforeBytes: 0,
  totalAfterBytes: 0,
};

function formatPercent(beforeBytes, afterBytes) {
  if (!beforeBytes) return '0.00%';
  const reduction = ((beforeBytes - afterBytes) / beforeBytes) * 100;
  return `${reduction.toFixed(2)}%`;
}

/**
 * Extract all image references from MDX body content
 * Supports both markdown syntax ![alt](path) and HTML <img src="path" />
 */
function extractImageRefs(content) {
  const imagePaths = new Set();

  for (const target of extractMarkdownImageTargets(content)) {
    imagePaths.add(target);
  }

  // Match HTML img tags: <img src="path" />
  let match;
  const htmlRegex = /<img[^>]+src=["']([^"']+)["']/g;
  while ((match = htmlRegex.exec(content)) !== null) {
    imagePaths.add(match[1]);
  }

  return Array.from(imagePaths);
}

function isRemoteUrl(u) {
  return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function guessExtensionFromContentType(contentType) {
  const ext = mime.extension(contentType || '');
  return ext ? `.${ext}` : '';
}

function safeDecodeURIComponent(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function sanitizeFilename(filename) {
  const raw = String(filename || '').trim();
  if (!raw) return 'file';

  const ext = extname(raw);
  const base = ext ? raw.slice(0, -ext.length) : raw;

  // Normalize whitespace to dashes (URLs) and strip other problematic chars
  const sanitizedBase = base
    .replace(/\s+/g, '-') // spaces/tabs/newlines -> -
    .replace(/%/g, '-') // avoid literal % in keys/urls
    .replace(/[\/\\]/g, '-') // path separators -> -
    .replace(/[^A-Za-z0-9._-]+/g, '-') // keep URL-safe-ish set
    .replace(/-+/g, '-') // collapse
    .replace(/^-+|-+$/g, ''); // trim dashes

  const out = (sanitizedBase || 'file') + ext;
  return out;
}

function toPublicUrl(fileKey) {
  const base = (process.env.R2_PUBLIC_URL || 'DRY_RUN_R2_PUBLIC_URL').replace(/\/+$/, '');
  // Encode each segment so spaces become %20, etc. (prevents %2520 double-encoding issues)
  const encodedKey = String(fileKey)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}/${encodedKey}`;
}

function isOurCdnUrl(url) {
  const base = (process.env.R2_PUBLIC_URL || '').trim();
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    return u.origin === b.origin;
  } catch {
    return false;
  }
}

function isWebsiteFilesUrl(url) {
  try {
    const u = new URL(url);
    return u.origin === 'https://cdn.prod.website-files.com';
  } catch {
    return false;
  }
}

function filenameFromUrl(url, contentType) {
  try {
    const u = new URL(url);
    const base = basename(u.pathname || '');
    const cleanBase = base.split('?')[0].split('#')[0];
    // Decode %XX sequences so object keys aren't stored with literal "%20" etc.
    // Also strip any decoded path separators to avoid surprises from %2F.
    const decodedBase = safeDecodeURIComponent(cleanBase).replace(/[\/\\]/g, '_');
    if (decodedBase && decodedBase !== '/' && decodedBase !== '.') {
      const ext = extname(decodedBase);
      if (ext) return sanitizeFilename(decodedBase);
      const fallbackExt = guessExtensionFromContentType(contentType);
      return sanitizeFilename(decodedBase + (fallbackExt || ''));
    }
  } catch {
    // fall through
  }
  const hash = crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, 12);
  const fallbackExt = guessExtensionFromContentType(contentType);
  return sanitizeFilename(`remote-${hash}${fallbackExt || ''}`);
}

async function downloadRemote(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const arr = await res.arrayBuffer();
  const buf = Buffer.from(arr);
  // Safety: 25MB cap to avoid surprises
  const maxBytes = 25 * 1024 * 1024;
  if (buf.length > maxBytes) throw new Error(`Remote file too large (${buf.length} bytes)`);
  const filename = filenameFromUrl(url, contentType);
  return { buffer: buf, contentType, filename };
}

/**
 * Resolve image path to filesystem path
 * Handles both relative paths (./image.jpg) and absolute paths (/blog/slug/image.jpg)
 */
function resolveImagePath(imagePath, mdxFilePath) {
  const candidates = [];

  // If it's a relative path, resolve from MDX file location
  if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
    const mdxDir = dirname(mdxFilePath);
    candidates.push(resolve(mdxDir, imagePath));
  }

  // If it's an absolute path, resolve from project root/public
  else if (imagePath.startsWith('/')) {
    // Try public folder first
    const publicPath = join(projectRoot, 'public', imagePath);
    candidates.push(publicPath);

    // Try from project root
    candidates.push(join(projectRoot, imagePath.substring(1)));
  }

  // Otherwise, resolve relative to MDX file
  else {
    const mdxDir = dirname(mdxFilePath);
    candidates.push(resolve(mdxDir, imagePath));
  }

  // Conditionally handle URL-encoded local paths from exports (e.g. %20 for spaces)
  // by trying decoded variants only when the original path is missing.
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
    const decodedCandidate = safeDecodeURIComponent(candidate);
    if (decodedCandidate !== candidate && existsSync(decodedCandidate)) {
      console.log(`   🔧 Resolved URL-encoded path: ${candidate} -> ${decodedCandidate}`);
      return decodedCandidate;
    }
  }

  // Preserve previous behavior for error reporting when no candidate exists.
  return candidates[0];
}

async function uploadToR2Buffer(buffer, contentType, slug, filename) {
  const optimized = await maybeOptimizeJpeg({
    buffer,
    contentType,
    filename,
    enabled: args.optimizeJpeg,
    quality: args.jpegQuality,
    dryRun: args.dryRun,
  });

  buffer = optimized.buffer;
  contentType = optimized.contentType;
  filename = optimized.filename;

  const safeName = sanitizeFilename(filename);
  const fileKey = `blog/${slug}/${safeName}`;

  // Skip if already uploaded in this run
  if (uploadedFiles.has(fileKey)) {
    console.log(`   ⏭️  Skipped (already uploaded): ${fileKey}`);
    return toPublicUrl(fileKey);
  }

  try {
    if (args.dryRun) {
      const cdnUrl = toPublicUrl(fileKey);
      console.log(`   🧪 Dry-run: would upload → ${cdnUrl}`);
      uploadedFiles.add(fileKey);
      return cdnUrl;
    }

    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    });

    await s3Client.send(command);
    uploadedFiles.add(fileKey);

    const cdnUrl = toPublicUrl(fileKey);
    console.log(`   ✅ Uploaded: ${safeName} → ${cdnUrl}`);
    if (optimized.optimized) {
      optimizationStats.optimizedCount += 1;
      optimizationStats.totalBeforeBytes += optimized.beforeBytes;
      optimizationStats.totalAfterBytes += optimized.afterBytes;
      const savedBytes = optimized.beforeBytes - optimized.afterBytes;
      console.log(
        `   🗜️  JPEG optimized: ${optimized.beforeBytes}B → ${optimized.afterBytes}B (saved ${savedBytes}B, ${formatPercent(optimized.beforeBytes, optimized.afterBytes)}, q=${args.jpegQuality})`,
      );
    }

    return cdnUrl;
  } catch (error) {
    console.error(`   ❌ Failed to upload ${safeName}:`, error.message);
    throw error;
  }
}

/**
 * Upload local file to R2 storage
 */
async function uploadToR2File(filePath, slug, filename) {
  const fileContent = readFileSync(filePath);
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  return uploadToR2Buffer(fileContent, contentType, slug, filename);
}

/**
 * Process a single content file
 */
async function processMDXFile(filePath) {
  console.log(`\n📄 Processing: ${basename(filePath)}`);
  
  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data || {};
  const mdxContent = parsed.content || '';
  
  // Get slug from frontmatter
  const slug = frontmatter.slug;
  if (!slug) {
    console.log('   ⚠️  No slug found in frontmatter, skipping...');
    return;
  }
  
  // Extract image refs from body
  const imageRefs = extractImageRefs(mdxContent);

  // Also include frontmatter cover image if present
  const coverRef = typeof frontmatter.image === 'string' ? frontmatter.image : null;

  const localRefs = imageRefs.filter((p) => !isRemoteUrl(p));
  const remoteRefs = imageRefs
    .filter((p) => isRemoteUrl(p))
    // Don't re-download/re-upload images that are already on our CDN.
    .filter((p) => !isOurCdnUrl(p))
    // By default, only process images from website-files.com (unless --allow-all-remote is set)
    .filter((p) => args.allowAllRemote || isWebsiteFilesUrl(p));

  const candidates = [];
  if (enableLocal) candidates.push(...localRefs.map((p) => ({ kind: 'body', ref: p, source: 'local' })));
  if (enableRemote) candidates.push(...remoteRefs.map((p) => ({ kind: 'body', ref: p, source: 'remote' })));

  if (coverRef) {
    const coverIsRemote = isRemoteUrl(coverRef);
    const coverAllowed = coverIsRemote 
      ? enableRemote && !isOurCdnUrl(coverRef) && (args.allowAllRemote || isWebsiteFilesUrl(coverRef))
      : enableLocal;
    if (coverAllowed) {
      candidates.push({ kind: 'frontmatter_image', ref: coverRef, source: coverIsRemote ? 'remote' : 'local' });
    }
  }

  if (candidates.length === 0) {
    console.log('   ℹ️  No images to process (based on flags / content)');
    return;
  }

  console.log(`   📷 Found ${candidates.length} image reference(s) to process`);

  let updatedBody = mdxContent;
  let updatedFrontmatter = { ...frontmatter };
  let changeCount = 0;

  for (const item of candidates) {
    console.log(`\n   🔍 Processing (${item.source}): ${item.ref}`);

    try {
      let cdnUrl;

      if (item.source === 'local') {
        const resolvedPath = resolveImagePath(item.ref, filePath);
        if (!existsSync(resolvedPath)) {
          console.log(`   ⚠️  File not found: ${resolvedPath}`);
          continue;
        }
        const filename = basename(resolvedPath);
        cdnUrl = await uploadToR2File(resolvedPath, slug, filename);
      } else {
        const { buffer, contentType, filename } = await downloadRemote(item.ref);
        cdnUrl = await uploadToR2Buffer(buffer, contentType, slug, filename);
      }

      if (item.kind === 'frontmatter_image') {
        updatedFrontmatter.image = cdnUrl;
        changeCount++;
        continue;
      }

      // Replace both markdown and HTML image references in body
      const escaped = escapeRegex(item.ref);
      const htmlRegex = new RegExp(`(<img[^>]+src=[\"'])${escaped}([\"'][^>]*>)`, 'g');
      updatedBody = replaceMarkdownLinks(updatedBody, (token) => {
        if (token.type !== 'image') return null;
        if (token.target !== item.ref) return null;
        return cdnUrl;
      });
      updatedBody = updatedBody.replace(htmlRegex, `$1${cdnUrl}$2`);

      changeCount++;
    } catch (error) {
      console.error(`   ❌ Error processing ${item.ref}:`, error.message);
    }
  }

  if (changeCount > 0) {
    if (args.dryRun) {
      console.log(`\n   🧪 Dry-run: would update ${changeCount} image reference(s) in content file`);
      return;
    }

    const updatedFile = matter.stringify(updatedBody, updatedFrontmatter);
    writeFileSync(filePath, updatedFile, 'utf-8');
    console.log(`\n   💾 Updated ${changeCount} image reference(s) in content file`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting R2 Image Upload Process\n');
  console.log('📦 Configuration:');
  console.log(`   Mode: ${args.dryRun ? 'dry-run' : 'live'}`);
  console.log(`   Local images: ${enableLocal ? 'enabled' : 'disabled'}`);
  console.log(`   Remote images: ${enableRemote ? 'enabled' : 'disabled'}${enableRemote && args.includeRemote ? ' (--include-remote)' : ''}`);
  if (enableRemote) {
    console.log(`   Remote filter: ${args.allowAllRemote ? 'all remote URLs allowed (--allow-all-remote)' : 'only https://cdn.prod.website-files.com/ (default)'}`);
  }
  console.log(`   JPEG optimize: ${args.optimizeJpeg ? `enabled by default (q=${args.jpegQuality}; disable with --no-optimize-jpeg)` : 'disabled (--no-optimize-jpeg)'}`);
  console.log(`   Bucket: ${process.env.R2_BUCKET_NAME || '(dry-run)'}`);
  console.log(`   CDN URL: ${process.env.R2_PUBLIC_URL || '(dry-run)'}`);

  const contentDir = args.contentDir ? resolve(args.contentDir) : join(projectRoot, 'content');
  
  if (!existsSync(contentDir)) {
    console.error(`❌ Content directory not found: ${contentDir}`);
    process.exit(1);
  }
  
  // Get all markdown content files
  const files = readdirSync(contentDir)
    .filter(file => file.endsWith('.md') || file.endsWith('.mdx'))
    .map(file => join(contentDir, file));
  
  console.log(`\n📁 Found ${files.length} content file(s) to process\n`);
  console.log('═'.repeat(60));
  
  // Process each file
  for (const file of files) {
    try {
      await processMDXFile(file);
    } catch (error) {
      console.error(`\n❌ Error processing ${basename(file)}:`, error.message);
    }
    console.log('\n' + '─'.repeat(60));
  }
  
  console.log('\n✨ Process completed!');
  console.log(`📊 Total unique files uploaded: ${uploadedFiles.size}`);
  if (optimizationStats.optimizedCount > 0) {
    const totalSaved = optimizationStats.totalBeforeBytes - optimizationStats.totalAfterBytes;
    console.log(
      `📉 JPEG optimization summary: ${optimizationStats.optimizedCount} file(s), ${optimizationStats.totalBeforeBytes}B → ${optimizationStats.totalAfterBytes}B, saved ${totalSaved}B (${formatPercent(optimizationStats.totalBeforeBytes, optimizationStats.totalAfterBytes)})`,
    );
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
