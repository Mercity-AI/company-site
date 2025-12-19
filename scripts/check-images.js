import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Extract all image references from MDX body content
 * Supports both markdown syntax ![alt](path) and HTML <img src="path" />
 */
function extractImageRefs(content) {
  const imagePaths = new Set();

  // Match markdown image syntax: ![alt](path)
  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownRegex.exec(content)) !== null) {
    imagePaths.add(match[2]);
  }

  // Match HTML img tags: <img src="path" />
  const htmlRegex = /<img[^>]+src=["']([^"']+)["']/g;
  while ((match = htmlRegex.exec(content)) !== null) {
    imagePaths.add(match[1]);
  }

  return Array.from(imagePaths);
}

function isRemoteUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

/**
 * Check if an image URL is accessible
 */
async function checkImage(url, timeout = 10000) {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Try HEAD first to save bandwidth
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        url,
        success: false,
        status: response.status,
        statusText: response.statusText,
        duration,
        size: 0,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    // Get content length if available
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : null;

    const contentType = response.headers.get('content-type') || 'unknown';

    return {
      url,
      success: true,
      status: response.status,
      duration,
      size,
      contentType,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      url,
      success: false,
      duration,
      size: 0,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
    };
  }
}

/**
 * Get full image URL for local paths (if they exist)
 * For remote URLs, return as-is
 */
function resolveImageUrl(imagePath, mdxFilePath) {
  if (isRemoteUrl(imagePath)) {
    return imagePath;
  }

  // Try to resolve local paths (though we'll check if they exist)
  const mdxDir = dirname(mdxFilePath);
  
  // Relative path
  if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
    const resolvedPath = resolve(mdxDir, imagePath);
    if (existsSync(resolvedPath)) {
      // For local files, we'll mark them as local
      return { local: true, path: resolvedPath };
    }
  }
  
  // Absolute path from public folder
  if (imagePath.startsWith('/')) {
    const publicPath = join(projectRoot, 'public', imagePath);
    if (existsSync(publicPath)) {
      return { local: true, path: publicPath };
    }
  }
  
  // Otherwise, assume it's a remote URL or doesn't exist
  return imagePath;
}

/**
 * Process a single MDX file
 */
function processMDXFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data || {};
  const mdxContent = parsed.content || '';
  
  const slug = frontmatter.slug || basename(filePath, '.mdx');
  
  // Extract image refs from body
  const imageRefs = extractImageRefs(mdxContent);
  
  // Also include frontmatter cover image if present
  const coverRef = typeof frontmatter.image === 'string' ? frontmatter.image : null;
  
  const allRefs = [...imageRefs];
  if (coverRef) {
    allRefs.push(coverRef);
  }
  
  return {
    slug,
    filePath,
    imageRefs: allRefs,
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Starting Image Validation Check\n');
  
  const contentDir = join(projectRoot, 'content');
  
  if (!existsSync(contentDir)) {
    console.error(`❌ Content directory not found: ${contentDir}`);
    process.exit(1);
  }
  
  // Get all MDX files
  const files = readdirSync(contentDir)
    .filter(file => file.endsWith('.mdx'))
    .map(file => join(contentDir, file));
  
  console.log(`📁 Found ${files.length} MDX file(s)\n`);
  
  // Process all files
  const blogData = files.map(file => processMDXFile(file));
  
  // Collect all unique image URLs
  const imageMap = new Map();
  for (const blog of blogData) {
    for (const ref of blog.imageRefs) {
      if (!imageMap.has(ref)) {
        imageMap.set(ref, []);
      }
      imageMap.get(ref).push(blog.slug);
    }
  }
  
  console.log(`📷 Found ${imageMap.size} unique image reference(s)\n`);
  console.log('🔄 Checking images in parallel...\n');
  
  // Check all images in parallel
  const imageRefsArray = Array.from(imageMap.keys());
  const checkPromises = imageRefsArray.map(async (imageRef, index) => {
    // Find a blog that uses this image to get the file path for resolution
    const blogsUsingImage = imageMap.get(imageRef) || [];
    const blog = blogData.find(b => blogsUsingImage.includes(b.slug));
    const resolved = resolveImageUrl(imageRef, blog?.filePath || '');
    
    if (resolved && typeof resolved === 'object' && resolved.local) {
      // Local file - just check if it exists
      const exists = existsSync(resolved.path);
      return {
        url: imageRef,
        success: exists,
        local: true,
        size: exists ? statSync(resolved.path).size : 0,
        error: exists ? null : 'File not found',
      };
    }
    
    // Remote URL - check via HTTP
    const url = typeof resolved === 'string' ? resolved : imageRef;
    return await checkImage(url);
  });
  
  const results = await Promise.all(checkPromises);
  
  // Process results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  // Calculate metrics per blog
  const blogMetrics = new Map();
  for (const blog of blogData) {
    let totalSize = 0;
    let imageCount = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (const ref of blog.imageRefs) {
      const index = imageRefsArray.indexOf(ref);
      if (index !== -1 && results[index]) {
        const result = results[index];
        imageCount++;
        if (result.success) {
          successCount++;
          totalSize += result.size || 0;
        } else {
          failCount++;
        }
      }
    }
    
    blogMetrics.set(blog.slug, {
      totalImages: imageCount,
      successful: successCount,
      failed: failCount,
      totalSize,
    });
  }
  
  // Calculate overall statistics
  const successfulWithSize = successful.filter(r => r.size !== null && r.size > 0);
  const totalSize = successful.reduce((sum, r) => sum + (r.size || 0), 0);
  const avgSize = successfulWithSize.length > 0 
    ? successfulWithSize.reduce((sum, r) => sum + r.size, 0) / successfulWithSize.length 
    : 0;
  const avgImagesPerBlog = blogData.reduce((sum, b) => sum + b.imageRefs.length, 0) / blogData.length;
  const blogsWithImages = Array.from(blogMetrics.values()).filter(m => m.totalSize > 0);
  const avgSizePerBlog = blogsWithImages.length > 0
    ? blogsWithImages.reduce((sum, m) => sum + m.totalSize, 0) / blogsWithImages.length
    : 0;
  
  // Print results
  console.log('═'.repeat(80));
  console.log('\n📊 OVERALL STATISTICS\n');
  console.log(`✅ Successful: ${successful.length} image(s)`);
  console.log(`❌ Failed: ${failed.length} image(s)`);
  console.log(`📈 Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
  console.log(`\n💾 Total Data Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  if (successfulWithSize.length > 0) {
    console.log(`📏 Average Image Size: ${(avgSize / 1024).toFixed(2)} KB (${successfulWithSize.length} with size info)`);
  } else {
    console.log(`📏 Average Image Size: N/A (size info not available)`);
  }
  console.log(`\n📝 Average Images per Blog: ${avgImagesPerBlog.toFixed(1)}`);
  if (blogsWithImages.length > 0) {
    console.log(`💾 Average Data per Blog: ${(avgSizePerBlog / 1024 / 1024).toFixed(2)} MB (${blogsWithImages.length} blogs with images)`);
  } else {
    console.log(`💾 Average Data per Blog: N/A`);
  }
  
  // Show failed images
  if (failed.length > 0) {
    console.log('\n' + '═'.repeat(80));
    console.log('\n❌ FAILED IMAGES\n');
    for (const fail of failed) {
      const blogs = imageMap.get(fail.url) || [];
      console.log(`   ${fail.url}`);
      console.log(`   Error: ${fail.error || `HTTP ${fail.status} ${fail.statusText || ''}`}`);
      console.log(`   Used in: ${blogs.join(', ')}`);
      console.log('');
    }
  }
  
  // Show blog-level breakdown
  console.log('\n' + '═'.repeat(80));
  console.log('\n📝 BLOG-LEVEL BREAKDOWN\n');
  
  const sortedBlogs = Array.from(blogMetrics.entries())
    .sort((a, b) => b[1].totalImages - a[1].totalImages);
  
  for (const [slug, metrics] of sortedBlogs) {
    const status = metrics.failed === 0 ? '✅' : metrics.failed === metrics.totalImages ? '❌' : '⚠️';
    console.log(`${status} ${slug}`);
    console.log(`   Images: ${metrics.successful}/${metrics.totalImages} successful`);
    console.log(`   Size: ${(metrics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    if (metrics.failed > 0) {
      console.log(`   ⚠️  ${metrics.failed} failed`);
    }
    console.log('');
  }
  
  console.log('═'.repeat(80));
  console.log('\n✨ Validation complete!\n');
  
  // Exit with error code if any images failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

