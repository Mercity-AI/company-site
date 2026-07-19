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

Blog posts are loaded from `content/*.mdx` through `src/content.config.ts`.

## Content scripts

Cloudflare R2 helper scripts are unchanged:

```bash
pnpm import:notion --dry-run
pnpm import:notion -- ".notion/LCM Blog"
pnpm upload:images
pnpm check:images
```
