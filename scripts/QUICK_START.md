# 🚀 Quick Start Guide: R2 Image Upload

## One-Time Setup (Already Done ✅)

Your R2 credentials are already configured in `.env`:
```
Bucket: blog
CDN URL: https://blog-cdn.mercity.ai
```

## How to Use

### Step 1: Add Images to Your Blog Post

Create or edit an MDX file in `content/` and reference images:

```markdown
---
title: "My Awesome Post"
slug: my-awesome-post
publishedAt: "2024-12-12"
---

## My Content

Here's a local image:
![Hero Image](./hero.jpg)

Or use an absolute path:
![Diagram](/blog/my-awesome-post/diagram.png)
```

### Step 2: Place Images

**Option A: Next to MDX file** (for `./image.jpg`)
```
content/
├── my-awesome-post.mdx
└── hero.jpg           ← Place here
```

**Option B: In public folder** (for `/blog/slug/image.jpg`)
```
public/
└── blog/
    └── my-awesome-post/
        └── diagram.png    ← Place here
```

### Step 3: Run the Upload Script

```bash
pnpm upload:images
```

### Step 4: Done! ✨

Your MDX file is automatically updated:
```markdown
![Hero Image](https://blog-cdn.mercity.ai/blog/my-awesome-post/hero.jpg)
```

Images are now served from your R2 CDN!

## 📊 Example Output

```
🚀 Starting R2 Image Upload Process

📦 Configuration:
   Bucket: blog
   CDN URL: https://blog-cdn.mercity.ai

📁 Found 5 MDX file(s) to process

📄 Processing: my-awesome-post.mdx
   📷 Found 2 local image(s)

   🔍 Processing: ./hero.jpg
   ✅ Uploaded: hero.jpg → https://blog-cdn.mercity.ai/blog/my-awesome-post/hero.jpg

   🔍 Processing: /blog/my-awesome-post/diagram.png
   ✅ Uploaded: diagram.png → https://blog-cdn.mercity.ai/blog/my-awesome-post/diagram.png

   💾 Updated 2 image reference(s) in MDX file

✨ Process completed!
📊 Total unique files uploaded: 2
```

## 💡 Pro Tips

1. **External URLs are ignored** - Images starting with `http://` or `https://` won't be touched
2. **Run anytime** - Safe to run multiple times, won't duplicate uploads in same session
3. **Local backup** - Original image files are kept, not deleted
4. **Test first** - Start with one blog post to verify everything works

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| `File not found` | Check image path and file location |
| `Missing environment variable` | Verify `.env` file exists and has all credentials |
| `Upload failed` | Check R2 credentials and bucket permissions |
| No images found | Make sure paths don't start with `http://` or `https://` |

## 📚 Need More Help?

See [`scripts/README.md`](./README.md) for detailed documentation.
