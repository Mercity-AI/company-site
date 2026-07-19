import { defineCollection, z } from 'astro:content';
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
  authors: z.array(authorSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().default('Research'),
  isTopPick: z.boolean().default(false),
  image: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content' }),
  schema: postSchema,
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './research' }),
  schema: postSchema,
});

export const collections = { posts, research };
