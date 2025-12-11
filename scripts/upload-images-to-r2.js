import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import mime from 'mime-types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Validate environment variables
const requiredEnvVars = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Error: Missing required environment variable: ${envVar}`);
    console.error('Please check your .env file and ensure all variables are set.');
    process.exit(1);
  }
}

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Track uploaded files to avoid duplicates in single run
const uploadedFiles = new Set();

/**
 * Extract all image references from MDX content
 * Supports both markdown syntax ![alt](path) and HTML <img src="path" />
 */
function extractImagePaths(content) {
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
  
  // Filter out external URLs (only keep local paths)
  return Array.from(imagePaths).filter(path => {
    return !path.startsWith('http://') && !path.startsWith('https://');
  });
}

/**
 * Resolve image path to filesystem path
 * Handles both relative paths (./image.jpg) and absolute paths (/blog/slug/image.jpg)
 */
function resolveImagePath(imagePath, mdxFilePath) {
  // If it's a relative path, resolve from MDX file location
  if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
    const mdxDir = dirname(mdxFilePath);
    return resolve(mdxDir, imagePath);
  }
  
  // If it's an absolute path, resolve from project root/public
  if (imagePath.startsWith('/')) {
    // Try public folder first
    const publicPath = join(projectRoot, 'public', imagePath);
    if (existsSync(publicPath)) {
      return publicPath;
    }
    
    // Try from project root
    return join(projectRoot, imagePath.substring(1));
  }
  
  // Otherwise, resolve relative to MDX file
  const mdxDir = dirname(mdxFilePath);
  return resolve(mdxDir, imagePath);
}

/**
 * Upload file to R2 storage
 */
async function uploadToR2(filePath, slug, filename) {
  const fileKey = `blog/${slug}/${filename}`;
  
  // Skip if already uploaded in this run
  if (uploadedFiles.has(fileKey)) {
    console.log(`   ⏭️  Skipped (already uploaded): ${fileKey}`);
    return `${process.env.R2_PUBLIC_URL}/${fileKey}`;
  }
  
  try {
    const fileContent = readFileSync(filePath);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileContent,
      ContentType: contentType,
    });
    
    await s3Client.send(command);
    uploadedFiles.add(fileKey);
    
    const cdnUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
    console.log(`   ✅ Uploaded: ${filename} → ${cdnUrl}`);
    
    return cdnUrl;
  } catch (error) {
    console.error(`   ❌ Failed to upload ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Process a single MDX file
 */
async function processMDXFile(filePath) {
  console.log(`\n📄 Processing: ${basename(filePath)}`);
  
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: mdxContent } = matter(content);
  
  // Get slug from frontmatter
  const slug = frontmatter.slug;
  if (!slug) {
    console.log('   ⚠️  No slug found in frontmatter, skipping...');
    return;
  }
  
  // Extract image paths
  const imagePaths = extractImagePaths(mdxContent);
  
  if (imagePaths.length === 0) {
    console.log('   ℹ️  No local images found');
    return;
  }
  
  console.log(`   📷 Found ${imagePaths.length} local image(s)`);
  
  let updatedContent = content;
  let changeCount = 0;
  
  // Process each image
  for (const imagePath of imagePaths) {
    console.log(`\n   🔍 Processing: ${imagePath}`);
    
    // Resolve to filesystem path
    const resolvedPath = resolveImagePath(imagePath, filePath);
    
    if (!existsSync(resolvedPath)) {
      console.log(`   ⚠️  File not found: ${resolvedPath}`);
      continue;
    }
    
    try {
      // Upload to R2
      const filename = basename(resolvedPath);
      const cdnUrl = await uploadToR2(resolvedPath, slug, filename);
      
      // Replace in content
      // Escape special regex characters in the image path
      const escapedPath = imagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Replace both markdown and HTML image references
      const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedPath}\\)`, 'g');
      const htmlRegex = new RegExp(`(<img[^>]+src=["'])${escapedPath}(["'][^>]*>)`, 'g');
      
      updatedContent = updatedContent.replace(markdownRegex, `![$1](${cdnUrl})`);
      updatedContent = updatedContent.replace(htmlRegex, `$1${cdnUrl}$2`);
      
      changeCount++;
    } catch (error) {
      console.error(`   ❌ Error processing ${imagePath}:`, error.message);
    }
  }
  
  // Write updated content back to file
  if (changeCount > 0) {
    writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`\n   💾 Updated ${changeCount} image reference(s) in MDX file`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting R2 Image Upload Process\n');
  console.log('📦 Configuration:');
  console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`   CDN URL: ${process.env.R2_PUBLIC_URL}`);
  
  const contentDir = join(projectRoot, 'content');
  
  if (!existsSync(contentDir)) {
    console.error(`❌ Content directory not found: ${contentDir}`);
    process.exit(1);
  }
  
  // Get all MDX files
  const files = readdirSync(contentDir)
    .filter(file => file.endsWith('.mdx'))
    .map(file => join(contentDir, file));
  
  console.log(`\n📁 Found ${files.length} MDX file(s) to process\n`);
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
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
