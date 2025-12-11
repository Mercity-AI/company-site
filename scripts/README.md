# R2 Image Upload Script

This script automates the process of uploading blog post images to Cloudflare R2 storage and updating MDX files with CDN URLs.

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

#### Option A: Relative Paths (Recommended for testing locally)
Place images next to your MDX file and reference them:

```markdown
![Hero Image](./hero.jpg)
```

#### Option B: Absolute Paths from Public Folder
Place images in `public/blog/<slug>/` and reference them:

```markdown
![Hero Image](/blog/my-post/hero.jpg)
```

#### Option C: HTML Image Tags
You can also use HTML:

```html
<img src="./diagram.png" alt="Architecture Diagram" />
```

### 3. Run the Upload Script

Once your blog post is ready with local image references, run:

```bash
pnpm upload:images
```

The script will:
- 📄 Scan all MDX files in the `content/` directory
- 🔍 Detect local image references (excluding external URLs)
- 📤 Upload images to R2 in the structure: `blog/<slug>/<filename>`
- ✏️  Rewrite MDX files to use CDN URLs
- ✅ Provide detailed progress and summary

## 📋 What the Script Does

### Image Detection
- Finds markdown images: `![alt](path)`
- Finds HTML images: `<img src="path" />`
- Filters out external URLs (only processes local paths)

### Path Resolution
- **Relative paths** (`./image.jpg`, `../images/hero.png`): Resolved from MDX file location
- **Absolute paths** (`/blog/slug/image.jpg`): Resolved from project root or `public/` folder

### R2 Upload
- Connects to Cloudflare R2 using S3-compatible API
- Uploads to organized structure: `blog/<slug>/<filename>`
- Sets proper content types automatically
- Avoids duplicate uploads in single run

### MDX Rewriting
- Replaces local paths with full CDN URLs
- Example transformation:
  ```markdown
  Before: ![Hero](./hero.jpg)
  After:  ![Hero](https://blog-cdn.mercity.ai/blog/my-post/hero.jpg)
  ```
- Preserves all other content and formatting

## 📊 Example Output

```
🚀 Starting R2 Image Upload Process

📦 Configuration:
   Bucket: blog
   CDN URL: https://blog-cdn.mercity.ai

📁 Found 5 MDX file(s) to process

════════════════════════════════════════════════════════════

📄 Processing: optimize-lora-qlora.mdx
   📷 Found 2 local image(s)

   🔍 Processing: ./hero.jpg
   ✅ Uploaded: hero.jpg → https://blog-cdn.mercity.ai/blog/optimize-lora-qlora/hero.jpg

   🔍 Processing: ./diagram.png
   ✅ Uploaded: diagram.png → https://blog-cdn.mercity.ai/blog/optimize-lora-qlora/diagram.png

   💾 Updated 2 image reference(s) in MDX file

────────────────────────────────────────────────────────────

✨ Process completed!
📊 Total unique files uploaded: 2
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

## 🎯 Best Practices

1. **Test First**: Run the script on a single blog post to verify everything works
2. **Backup**: Keep local images as backup (the script doesn't delete them)
3. **Commit After**: Commit the updated MDX files after successful uploads
4. **Idempotent**: Safe to run multiple times - it won't re-upload the same files in a single run

## 🔮 Future Enhancements

Potential improvements to consider:
- Image optimization (compression, resizing)
- Automatic generation of responsive image variants
- Cache invalidation for updated images
- Batch upload mode with progress bars
- Dry-run mode to preview changes

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
