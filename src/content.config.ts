import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const authorSchema = z.object({
  name: z.string(),
  image: z.string().optional(),
  role: z.string().optional(),
});

const postSchema = z.object({
  title: z.string().max(120),
  slug: z.string(),
  publishedAt: z.coerce.date(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  summary: z.string().max(500),
  // Optional search overrides. When set, they replace the title and summary
  // in the <title> tag and meta description only; the page itself is unchanged.
  seoTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  authors: z.array(authorSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().default('Research'),
  isTopPick: z.boolean().default(false),
  // Cover: export at 1600 × 900 (16:9). See "Cover images" in README.md.
  image: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content' }),
  schema: postSchema,
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './research' }),
  schema: postSchema,
});

export const collections = { posts, research };
