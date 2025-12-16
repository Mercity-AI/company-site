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

// Blog posts collection
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
      permalink: `/blog/${data.slug}`,
      // Reading time estimate (roughly 200 words per minute)
      readingTime: `${Math.ceil(data.raw.split(/\s+/).length / 200)} min read`,
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
  collections: { posts },
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

