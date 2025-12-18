import { defineCollection, defineConfig, s } from "velite";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";

// Author schema for multiple authors support
const authorSchema = s.object({
  name: s.string(),
  image: s.string().optional(),
  role: s.string().optional(),
});

// Blog posts collection (full content for static HTML generation)
const posts = defineCollection({
  name: "Post",
  pattern: "**/*.mdx",
  schema: s
    .object({
      // Core fields
      title: s.string().max(120),
      slug: s.slug("posts"),
      publishedAt: s.isodate(),
      // Optional provenance dates (useful for migrations)
      createdAt: s.isodate().optional(),
      updatedAt: s.isodate().optional(),
      summary: s.string().max(500),

      // Authors (supports multiple)
      authors: s.array(authorSchema).min(1),

      // Categorization
      tags: s.array(s.string()).default([]),
      category: s.string().default("Research"),
      isTopPick: s.boolean().default(false),

      // Media
      image: s.string().optional(),

      // Content
      content: s.markdown(),
      raw: s.raw(),
      toc: s.toc(),

      // Metadata from file
      metadata: s.metadata(),
    })
    .transform((data) => ({
      ...data,
      // Add computed permalink
      permalink: `/blog-post/${data.slug}`,
      // Reading time estimate (roughly 200 words per minute)
      readingTime: `${Math.ceil(data.raw.split(/\s+/).length / 220)} min read`,
    })),
});

// OPTIONAL: Metadata-only collection (lightweight for blog list & homepage)
// This significantly reduces bundle size by excluding full HTML content
// Use this in BlogList.tsx and Home.tsx instead of the full 'posts' collection
const postsMetadata = defineCollection({
  name: "PostMetadata",
  pattern: "**/*.mdx",
  schema: s
    .object({
      // Lightweight fields only (no content, raw, toc)
      title: s.string().max(120),
      slug: s.slug("posts-meta"), // Use different namespace to avoid duplicate slug errors
      publishedAt: s.isodate(),
      createdAt: s.isodate().optional(),
      updatedAt: s.isodate().optional(),
      summary: s.string().max(500),
      authors: s.array(authorSchema).min(1),
      tags: s.array(s.string()).default([]),
      category: s.string().default("Research"),
      isTopPick: s.boolean().default(false),
      image: s.string().optional(),
      raw: s.raw(), // Keep for reading time calculation only
    })
    .transform((data) => ({
      title: data.title,
      slug: data.slug,
      publishedAt: data.publishedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      summary: data.summary,
      authors: data.authors,
      tags: data.tags,
      category: data.category,
      isTopPick: data.isTopPick,
      image: data.image,
      permalink: `/blog-post/${data.slug}`,
      readingTime: `${Math.ceil(data.raw.split(/\s+/).length / 220)} min read`,
    })),
});

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: { posts, postsMetadata },
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      rehypeHighlight, // Add syntax highlighting with highlight.js-compatible classes
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: {
            className: ["anchor"],
          },
        },
      ],
    ],
  },
});

