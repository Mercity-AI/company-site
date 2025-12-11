<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1jip51wXYGGd5zHyL5yUGgg51RGNgVgtk

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Run the app:
   ```bash
   pnpm run dev
   ```

## 📸 Image Management

This project includes an automated image upload system for blog posts using Cloudflare R2.

### Setup R2 Image Upload

1. **Configure Credentials**: Copy `.env.example` to `.env` and add your Cloudflare R2 credentials:
   ```bash
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_BUCKET_NAME=your_bucket_name
   R2_PUBLIC_URL=https://your-cdn-url.com
   ```

2. **Add Images to Blog Posts**: Reference local images in your MDX files:
   ```markdown
   ![Hero Image](./hero.jpg)
   ```

3. **Upload to R2**: Run the upload script to automatically upload images and update MDX files:
   ```bash
   pnpm upload:images
   ```

For detailed documentation, see [`scripts/README.md`](scripts/README.md).
