# Mercity Research (Astro)

Astro-based marketing and research site with Markdown and MDX content.

## Stack

- Astro 7
- MDX content collections (`@astrojs/mdx`)
- Scoped Astro styles and small inline scripts; no UI framework

## Run

Prerequisites: Node.js 22.12+ and `pnpm`.

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

### Structured data (`jsonld`)

Every post and log carries a `jsonld` block at the end of its frontmatter:
the hand-written part of the page's JSON-LD. Ids, dates, authors, the cover
and breadcrumbs are generated from the other fields; this block adds what an
answer engine needs that they do not say.

```yaml
jsonld:
  abstract: >-
    2-4 sentences: what the piece covers and what it found, with its numbers.
  about:
    - name: Red teaming
      sameAs: https://en.wikipedia.org/wiki/Red_team   # only a checked Wikipedia URL
    - name: AI agent stress testing
  keywords: [agent stress testing, multi-turn agent testing]  # merged with tags
  citation:                     # every URL must appear in the body
    - name: Heckler
      url: https://github.com/Mercity-AI/heckler
      type: code                # paper | code | dataset | model | page
  faq:                          # 4-6 questions, answers self-contained
    - q: What is Heckler?
      a: >-
        ...
    - q: How can Mercity help with stress-testing an LLM agent?   # always last
      a: >-
        2-4 sentences on what Mercity does here and the work behind it.
```

The schema is strict (a misspelt key fails the build) and `pnpm test`
fails any built post or log without an abstract, topics and an FAQ ending in
one "How can Mercity help" question. A new post needs one before it merges;
`pnpm import:notion` does not write it. See `src/utils/schema.ts`.

## Content scripts

Cloudflare R2 helper scripts are unchanged:

```bash
pnpm import:notion --dry-run
pnpm import:notion -- ".notion/LCM Blog"
pnpm upload:images
pnpm check:images
```
