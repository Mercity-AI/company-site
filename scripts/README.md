# Scripts README

This folder contains utilities for blog image upload, validation, and optimization.

## Scripts

| File | Command | Purpose |
|---|---|---|
| `scripts/upload-images-to-r2.js` | `pnpm upload:images` | Upload images to Cloudflare R2 and rewrite Markdown references to CDN URLs. |
| `scripts/check-images.js` | `pnpm check:images` | Validate image references in Markdown files (local files + remote URLs). |
| `scripts/image-optimizer.js` | Internal helper | Converts PNG to JPG and optionally compresses large JPEGs. |

## Required Environment Variables

Set these in `.env` for real uploads:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-cdn-url.com
```

## Quick Workflow

1. Add image references in `content/*.md`.
2. Run a dry run first: `pnpm upload:images --dry-run`.
3. Run upload: `pnpm upload:images`.
4. Validate all references: `pnpm check:images`.

## Notion Markdown (Minimal Workflow)

Use this when importing a Notion markdown export (`.md`) plus its image folder.

1. Create a new post file in `content/<slug>.md`.
2. Add required frontmatter fields:
   - `title`
   - `slug`
   - `publishedAt`
   - `summary`
   - `authors`
3. Paste the Notion markdown body below the frontmatter.
4. Copy exported Notion images into `public/blog/<slug>/`.
5. Rewrite markdown image links to `/blog/<slug>/<filename>`.
6. Keep `cid:` links as-is for now or replace/remove them manually later.
7. Run dry-run upload:
   - `pnpm upload:images --dry-run`
8. Run live upload:
   - `pnpm upload:images`
9. Validate:
   - `pnpm check:images`

Notes:

- URL-encoded local paths from Notion (e.g. `image%201.png`) are supported.
- PNG files are converted to JPG during upload.

## Supported Image References

- Markdown image syntax: `![alt](path)`
- HTML image syntax: `<img src="path" />`
- Frontmatter image field: `image: ./hero.jpg`

Supported path types:

- Relative local paths: `./hero.jpg`, `../img/diagram.png`
- Absolute local paths: `/blog/my-post/hero.jpg` (resolved from `public/` first)
- Remote URLs: `https://...` (only processed when remote mode is enabled)

## Upload Command Examples

```bash
# Local images only (default)
pnpm upload:images

# Local + remote images from website-files CDN
pnpm upload:images --include-remote

# Any remote domain
pnpm upload:images --include-remote --allow-all-remote

# Remote only
pnpm upload:images --remote-only

# Dry run
pnpm upload:images --dry-run

# Dry run with remote processing
pnpm upload:images --include-remote --dry-run

# JPEG optimization (only files >= 200KB)
pnpm upload:images --optimize-jpeg --jpeg-quality 85
```

## Upload Flags

| Flag | Description |
|---|---|
| `--dry-run` | Preview uploads and file rewrites without writing changes. |
| `--include-remote` | Process remote URLs in addition to local files. |
| `--local-only` | Process only local files (default behavior). |
| `--remote-only` | Process only remote URLs. |
| `--allow-all-remote` | Allow all remote domains; default allowlist is `https://cdn.prod.website-files.com/`. |
| `--optimize-jpeg` | Enable JPEG compression for files 200KB or larger. |
| `--jpeg-quality <1-100>` | JPEG quality when optimization is enabled (default `70`). |
| `--content-dir <path>` | Override content directory (default `content/`). |

## Upload Behavior

- Uses slug-based object keys: `blog/<slug>/<filename>`.
- Rewrites matching image references in Markdown body and frontmatter.
- Skips remote URLs already on your configured CDN.
- Converts PNG files to JPG before upload.
- Compresses JPEG only when `--optimize-jpeg` is enabled and file size is at least 200KB.
- Avoids duplicate uploads within one run.

## Validation Behavior (`pnpm check:images`)

- Scans `content/*.md` for markdown, HTML, and frontmatter image references.
- Local references are checked with filesystem existence checks.
- Remote references are checked with HTTP requests.
- Exits with status code `1` if any reference fails (good for CI).

## Troubleshooting

| Issue | What to check |
|---|---|
| Missing env variable | Ensure `.env` contains all R2 variables listed above. |
| File not found | Verify path is correct relative to the Markdown file or under `public/`. |
| Upload access denied | Verify R2 credentials, bucket name, and token permissions. |
| Remote image skipped | Use `--include-remote`; use `--allow-all-remote` for non-allowlisted domains. |
| Remote download failed | Confirm URL is accessible and file is smaller than 25MB. |
