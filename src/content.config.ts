import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const authorSchema = z.object({
  name: z.string(),
  image: z.string().optional(),
  role: z.string().optional(),
});

/**
 * Hand-written structured data for one post or log, merged into the page's
 * JSON-LD by src/utils/schema.ts. Ids, dates, authors, the cover and the
 * breadcrumb come from the fields above; this block carries what an answer
 * engine needs that the rest of the frontmatter does not say. Strict, so a
 * misspelt key fails the build instead of disappearing.
 *
 *   abstract  2-4 sentences: what the piece covers and what it found, with
 *             its numbers. Not a copy of `summary`.
 *   about     The topics the piece is about. `sameAs` (a Wikipedia URL)
 *             only where the article is known to exist.
 *   keywords  Search phrases; merged with `tags`.
 *   citation  Sources the body links to. Every URL must appear in the body.
 *   faq       Questions the piece answers, each answer self-contained. The
 *             last one says how Mercity can help with the topic.
 */
const topicSchema = z.union([
  z.string(),
  z.strictObject({ name: z.string(), sameAs: z.url().optional() }),
]);

const jsonldSchema = z.strictObject({
  abstract: z.string().min(100).max(1200),
  about: z.array(topicSchema).min(1).max(8),
  keywords: z.array(z.string()).max(20).optional(),
  citation: z
    .array(
      z.strictObject({
        name: z.string(),
        url: z.url(),
        type: z.enum(['paper', 'code', 'dataset', 'model', 'page']).default('page'),
        author: z.string().optional(),
      }),
    )
    .max(15)
    .optional(),
  faq: z
    .array(z.strictObject({ q: z.string().min(10), a: z.string().min(40).max(900) }))
    .min(2)
    .max(8),
});

const postSchema = z.object({
  title: z.string().max(120),
  slug: z.string(),
  publishedAt: z.coerce.date(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  summary: z.string().max(500),
  // Optional search snippet. When set, it replaces the summary in the meta
  // description only; the dek on the page and the blog cards keep the summary.
  metaDescription: z.string().max(160).optional(),
  authors: z.array(authorSchema).min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().default('Research'),
  isTopPick: z.boolean().default(false),
  // Cover: export at 1600 × 900 (16:9). See "Cover images" in README.md.
  image: z.string().optional(),
  // Structured data for this entry. Optional so a fresh import builds;
  // tests/jsonld.test.mjs fails any post or log that ships without it.
  jsonld: jsonldSchema.optional(),
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
