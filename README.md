# Mercity Research (Astro)

Astro-based marketing and research site with MDX blog content and selective React islands for animated backgrounds.

## Stack

- Astro 5
- React islands (`@astrojs/react`)
- MDX content collections (`@astrojs/mdx`)
- Tailwind CSS v4
- View transitions via `astro:transitions`

## Run

Prerequisites: Node.js 20+ and `pnpm`.

```bash
pnpm install
pnpm dev
```

Build and preview:

```bash
pnpm build
pnpm preview
```

Type/content check:

```bash
pnpm check
```

## Content

Blog posts are loaded from `content/*.md` and research logs from
`research/*.md`, both through `src/content.config.ts`.

### Cover images

Export the frontmatter `image` at **1600 × 900 (16:9)**. The same file is
the listing thumbnail, the research lead card, the article header and the
social-share card, and 16:9 fits all four. Anything from 3:2 to 2:1 works:
listings fit the whole image in its frame on white, so nothing is cropped.
Social cards do crop, so keep key content off the top and bottom edges.
The listing thumbnail is only 220px wide, so the image needs to read at
that size.

## Content scripts

Cloudflare R2 helper scripts are unchanged:

```bash
pnpm import:notion --dry-run
pnpm import:notion -- ".notion/LCM Blog"
pnpm upload:images
pnpm check:images
```
