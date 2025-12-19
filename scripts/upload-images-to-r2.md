# R2 Image Upload Script

This script automates the process of uploading blog post images to Cloudflare R2 storage and updating MDX files with CDN URLs. It supports both local images and remote images from external sources.

## 🚀 Quick Start

### 1. Set Up R2 Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** from the left sidebar
3. Create a bucket or use an existing one
4. Generate an API token with R2 read/write permissions
5. Copy the credentials to your `.env` file:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-cdn-url.com
```

### 2. Add Images to Your Blog Posts

When creating a new blog post, you have several options for referencing images:

#### Option A: Relative Paths (Recommended for local images)
Place images next to your MDX file and reference them:

```markdown
![Hero Image](./hero.jpg)
```

#### Option B: Absolute Paths from Public Folder
Place images in `public/blog/<slug>/` and reference them:

```markdown
![Hero Image](/blog/my-post/hero.jpg)
```

#### Option C: Remote URLs
Reference images from external sources (default: only `https://cdn.prod.website-files.com/`):

```markdown
![External Image](https://cdn.prod.website-files.com/path/to/image.jpg)
```

#### Option D: HTML Image Tags
You can also use HTML:

```html
<img src="./diagram.png" alt="Architecture Diagram" />
```

### 3. Run the Upload Script

#### Basic Usage (Local Images Only)
By default, the script only processes local images:

```bash
pnpm upload:images
```

#### Process Remote Images
To also process remote images from `https://cdn.prod.website-files.com/`:

```bash
pnpm upload:images --include-remote
```

#### Process All Remote Images
To process remote images from any source:

```bash
pnpm upload:images --include-remote --allow-all-remote
```

#### Dry Run Mode
Preview changes without uploading:

```bash
pnpm upload:images --dry-run
pnpm upload:images --include-remote --dry-run
```

## 📋 Command-Line Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without uploading to R2 |
| `--include-remote` | Process remote images in addition to local ones |
| `--local-only` | Process only local images (default behavior) |
| `--remote-only` | Process only remote images (skip local) |
| `--allow-all-remote` | Allow processing remote images from any source (default: only `https://cdn.prod.website-files.com/`) |
| `--optimize-jpeg` | Enable JPEG optimization before upload |
| `--jpeg-quality <1-100>` | Set JPEG quality (default: 70) |
| `--content-dir <path>` | Specify custom content directory (default: `content/`) |

## 📋 What the Script Does

### Image Detection
- Finds markdown images: `![alt](path)`
- Finds HTML images: `<img src="path" />`
- Extracts cover images from frontmatter `image` field
- Categorizes images as local or remote

### Local Image Processing
- **Relative paths** (`./image.jpg`, `../images/hero.png`): Resolved from MDX file location
- **Absolute paths** (`/blog/slug/image.jpg`): Resolved from project root or `public/` folder
- Only processes local images by default (unless `--include-remote` or `--remote-only` is used)

### Remote Image Processing
- **Default behavior**: Only processes images from `https://cdn.prod.website-files.com/`
- Use `--allow-all-remote` to process images from any remote source
- Automatically skips images already on your CDN (prevents re-uploading)
- Downloads remote images (max 25MB) and uploads to R2
- Generates safe filenames from URLs

### R2 Upload
- Connects to Cloudflare R2 using S3-compatible API
- Uploads to organized structure: `blog/<slug>/<filename>`
- Sets proper content types automatically
- Avoids duplicate uploads in single run
- Supports JPEG optimization (optional)

### MDX Rewriting
- Replaces local paths with full CDN URLs
- Updates both markdown and HTML image references
- Updates frontmatter `image` field if present
- Example transformation:
  ```markdown
  Before: ![Hero](./hero.jpg)
  After:  ![Hero](https://blog-cdn.mercity.ai/blog/my-post/hero.jpg)
  ```
- Preserves all other content and formatting

## 📊 Example Output

### Local Images Only
```
🚀 Starting R2 Image Upload Process

📦 Configuration:
   Mode: live
   Local images: enabled
   Remote images: disabled
   JPEG optimize: disabled
   Bucket: blog
   CDN URL: https://blog-cdn.mercity.ai

📁 Found 5 MDX file(s) to process

════════════════════════════════════════════════════════════

📄 Processing: optimize-lora-qlora.mdx
   📷 Found 2 image reference(s) to process

   🔍 Processing (local): ./hero.jpg
   ✅ Uploaded: hero.jpg → https://blog-cdn.mercity.ai/blog/optimize-lora-qlora/hero.jpg

   🔍 Processing (local): ./diagram.png
   ✅ Uploaded: diagram.png → https://blog-cdn.mercity.ai/blog/optimize-lora-qlora/diagram.png

   💾 Updated 2 image reference(s) in MDX file

────────────────────────────────────────────────────────────

✨ Process completed!
📊 Total unique files uploaded: 2
```

### With Remote Images
```
🚀 Starting R2 Image Upload Process

📦 Configuration:
   Mode: live
   Local images: enabled
   Remote images: enabled (--include-remote)
   Remote filter: only https://cdn.prod.website-files.com/ (default)
   JPEG optimize: enabled (q=70)
   Bucket: blog
   CDN URL: https://blog-cdn.mercity.ai

📁 Found 3 MDX file(s) to process

════════════════════════════════════════════════════════════

📄 Processing: my-post.mdx
   📷 Found 3 image reference(s) to process

   🔍 Processing (local): ./local-image.jpg
   ✅ Uploaded: local-image.jpg → https://blog-cdn.mercity.ai/blog/my-post/local-image.jpg

   🔍 Processing (remote): https://cdn.prod.website-files.com/path/to/image.jpg
   ✅ Uploaded: image.jpg → https://blog-cdn.mercity.ai/blog/my-post/image.jpg

   🔍 Processing (remote): https://example.com/image.png
   ⚠️  Skipped (not from website-files.com)

   💾 Updated 2 image reference(s) in MDX file

────────────────────────────────────────────────────────────

✨ Process completed!
📊 Total unique files uploaded: 2
```

## 🔧 Usage Examples

### Process Local Images Only (Default)
```bash
node scripts/upload-images-to-r2.js
```

### Process Local + Remote (website-files.com only)
```bash
node scripts/upload-images-to-r2.js --include-remote
```

### Process All Remote Images
```bash
node scripts/upload-images-to-r2.js --include-remote --allow-all-remote
```

### Process Remote Images Only
```bash
node scripts/upload-images-to-r2.js --remote-only
```

### Dry Run with Remote Images
```bash
node scripts/upload-images-to-r2.js --include-remote --dry-run
```

### Enable JPEG Optimization
```bash
node scripts/upload-images-to-r2.js --optimize-jpeg --jpeg-quality 85
```

### Custom Content Directory
```bash
node scripts/upload-images-to-r2.js --content-dir ./custom-content
```

## 🔧 Troubleshooting

### Missing Environment Variables
If you see this error:
```
❌ Error: Missing required environment variable: R2_ACCOUNT_ID
```

Make sure your `.env` file exists and contains all required variables. You can use `.env.example` as a template.

### File Not Found
If images aren't found:
```
⚠️  File not found: /path/to/image.jpg
```

Check that:
1. The image file actually exists at that location
2. The path in your MDX is correct
3. You're using the correct relative or absolute path format

### Upload Failures
If uploads fail:
```
❌ Failed to upload image.jpg: Access Denied
```

Verify that:
1. Your R2 credentials are correct
2. Your API token has read/write permissions
3. The bucket name is correct
4. Your account has sufficient R2 storage

### Remote Image Issues
If remote images aren't processed:
```
⚠️  Skipped (not from website-files.com)
```

- By default, only images from `https://cdn.prod.website-files.com/` are processed
- Use `--allow-all-remote` to process images from any source
- Images already on your CDN are automatically skipped

### Remote Download Failures
If remote downloads fail:
```
❌ Error processing https://example.com/image.jpg: HTTP 404 Not Found
```

Check that:
1. The URL is accessible
2. The file size is under 25MB
3. The URL doesn't require authentication

## 🎯 Best Practices

1. **Test First**: Run with `--dry-run` to preview changes
2. **Backup**: Keep local images as backup (the script doesn't delete them)
3. **Commit After**: Commit the updated MDX files after successful uploads
4. **Idempotent**: Safe to run multiple times - it won't re-upload the same files in a single run
5. **Remote Filtering**: Use default website-files.com filter to avoid downloading unwanted images
6. **JPEG Optimization**: Enable `--optimize-jpeg` for better performance and storage savings

## 🔮 Features

- ✅ Local image upload and URL replacement
- ✅ Remote image download and upload (with filtering)
- ✅ Frontmatter cover image support
- ✅ JPEG optimization (optional)
- ✅ Dry-run mode for safe testing
- ✅ Duplicate detection within single run
- ✅ Automatic CDN URL detection (skips already uploaded images)
- ✅ Support for both markdown and HTML image syntax
- ✅ Custom content directory support
- ✅ Detailed progress reporting

## 📚 Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Gray Matter (Frontmatter Parser)](https://github.com/jonschlinkert/gray-matter)

## 🆘 Support

If you encounter issues:
1. Check the error messages in the console
2. Verify your `.env` configuration
3. Ensure all dependencies are installed (`pnpm install`)
4. Check that your R2 bucket exists and is accessible
5. Use `--dry-run` to debug without making changes

