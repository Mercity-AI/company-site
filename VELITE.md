# Velite Content Management

This project uses [Velite](https://velite.js.org/) to manage blog content from MDX files. Velite transforms your markdown/MDX files into type-safe JSON data that can be imported directly into React components.

## Quick Start

```bash
# Development - runs Vite with Velite auto-building
pnpm dev

# Watch content changes only (run in separate terminal for hot reload)
pnpm dev:content

# Production build
pnpm build
```

## Project Structure

```
├── content/                    # Your blog posts live here
│   ├── towards-causal-reasoning.mdx
│   ├── sparse-attention-patterns.mdx
│   └── ...
├── .velite/                    # Auto-generated (gitignored)
│   ├── index.js                # Exports posts array
│   ├── index.d.ts              # TypeScript types
│   └── posts.json              # Raw JSON data
├── velite.config.ts            # Velite configuration
└── vite.config.ts              # Vite config with Velite plugin
```

## Configuration Files

### `velite.config.ts`

This is where you define your content schema and collections.

**Key sections:**

| Section | Purpose |
|---------|---------|
| `root` | Source directory for content files (`content/`) |
| `output.data` | Where generated data goes (`.velite/`) |
| `output.assets` | Where images/files are copied (`public/static/`) |
| `collections` | Define your content types (posts, pages, etc.) |
| `markdown.rehypePlugins` | Plugins for processing markdown |

**Current schema fields:**

```typescript
{
  title: string,           // max 120 chars
  slug: string,            // URL-friendly identifier
  publishedAt: string,     // ISO date (YYYY-MM-DD)
  summary: string,         // max 500 chars
  authors: [{ name, image?, role? }],
  tags: string[],          // default: []
  category: string,        // default: "Research"
  isTopPick: boolean,      // default: false
  image?: string,          // optional cover image
  
  // Auto-generated:
  content: string,         // HTML from markdown
  raw: string,             // Raw markdown text
  toc: TableOfContents,    // Headings tree
  permalink: string,       // /blog/{slug}
  readingTime: string,     // "X min read"
}
```

### `vite.config.ts`

Contains a custom Velite plugin that:
- Runs Velite build when Vite starts
- Enables watch mode during development
- Sets up path alias for `@/.velite` imports

## Working with Content

### Adding a New Blog Post

1. Create a new `.mdx` file in `content/`:

```bash
touch content/my-new-post.mdx
```

2. Add frontmatter and content:

```mdx
---
title: "My New Blog Post"
slug: my-new-post
publishedAt: "2024-01-15"
summary: "A brief description of this post."
authors:
  - name: "Your Name"
    role: "Researcher"
tags: ["AI", "Research"]
category: "Engineering"
isTopPick: false
---

Your markdown content here...

## Section Heading

More content with **bold** and *italic* text.

```python
# Code blocks are syntax highlighted
print("Hello World")
```
```

3. The post will auto-appear if `pnpm dev` is running, or run `pnpm dev:content` to rebuild.

### Removing a Blog Post

Simply delete the `.mdx` file from `content/`. The generated data will update automatically.

### Editing a Blog Post

Edit the `.mdx` file directly. Changes are picked up by the watcher.

## Importing Content in Components

```tsx
import { posts } from '@/.velite';

// All posts
console.log(posts);

// Find single post
const post = posts.find(p => p.slug === 'my-post');

// Sort by date
const sorted = [...posts].sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
);

// Filter by category
const research = posts.filter(p => p.category === 'Research');

// Top picks only
const featured = posts.filter(p => p.isTopPick);
```

## Modifying the Schema

To add/remove fields, edit `velite.config.ts`:

**Adding a new field:**

```typescript
schema: s.object({
  // ... existing fields
  myNewField: s.string().optional(),  // Add this
})
```

Then update your MDX frontmatter and components to use the new field.

**Removing a field:**

1. Remove from schema in `velite.config.ts`
2. Remove from MDX frontmatter in all posts
3. Remove usage from components

## Adding a New Collection

To add a new content type (e.g., team members, projects):

```typescript
// velite.config.ts
const projects = defineCollection({
  name: "Project",
  pattern: "projects/**/*.mdx",  // Different folder
  schema: s.object({
    title: s.string(),
    // ... your fields
  }),
});

export default defineConfig({
  // ...
  collections: { posts, projects },  // Add here
});
```

Then import: `import { posts, projects } from '@/.velite';`

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `pnpm dev` | Start Vite dev server (auto-runs Velite) |
| `dev:content` | `pnpm dev:content` | Watch content folder for changes |
| `build` | `pnpm build` | Build Velite then Vite for production |
| `preview` | `pnpm preview` | Preview production build locally |

**Recommended development workflow:**

```bash
# Terminal 1 - Vite dev server
pnpm dev

# Terminal 2 (optional) - Content hot reload
pnpm dev:content
```

The Vite plugin runs Velite on startup, but for instant content updates while editing MDX files, run `dev:content` in a separate terminal.

## Troubleshooting

### Content not updating?

```bash
# Force rebuild
rm -rf .velite && pnpm dev
```

### TypeScript errors with imports?

Make sure `tsconfig.json` has the path alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@/.velite": ["./.velite"]
    }
  }
}
```

### Build fails?

Check that all MDX files have valid frontmatter matching the schema. Missing required fields will cause errors.

## Rehype Plugins

Currently configured:

- **rehype-slug**: Adds `id` attributes to headings
- **rehype-pretty-code**: Syntax highlighting for code blocks (github-light/dark themes)
- **rehype-autolink-headings**: Makes headings clickable links

To add more plugins, install them and add to `markdown.rehypePlugins` in `velite.config.ts`.

