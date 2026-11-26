import { readdir, rename, rm } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeScrollableTables from './src/utils/rehype-scrollable-tables.mjs';

function normalizeAllowedHostsBoolean(allowedHosts) {
  return Array.isArray(allowedHosts) && allowedHosts.length === 1 && allowedHosts[0] === true
    ? true
    : allowedHosts;
}

const forceAllowAllHostsPlugin = {
  name: 'force-allow-all-hosts',
  configResolved(resolvedConfig) {
    resolvedConfig.server.allowedHosts = normalizeAllowedHostsBoolean(resolvedConfig.server.allowedHosts);
    resolvedConfig.preview.allowedHosts = normalizeAllowedHostsBoolean(resolvedConfig.preview.allowedHosts);
  },
};

// @astrojs/sitemap always writes sitemap-index.xml pointing at
// sitemap-0.xml. The site serves one file at /sitemap.xml instead, so this
// renames the chunk and drops the index. It must come after sitemap() in
// `integrations`: build:done hooks run in that order.
const singleSitemapFile = {
  name: 'single-sitemap-file',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const chunks = (await readdir(dir)).filter((name) => /^sitemap-\d+\.xml$/.test(name));
      if (chunks.length !== 1) {
        throw new Error(`Expected one sitemap chunk, found ${chunks.length}: ${chunks.join(', ')}`);
      }
      await rename(new URL(chunks[0], dir), new URL('sitemap.xml', dir));
      await rm(new URL('sitemap-index.xml', dir));
    },
  },
};

export default defineConfig({
  site: 'https://www.mercity.ai',
  // Astro 7 defaults to JSX whitespace rules, which drop spaces between
  // inline elements; keep the HTML-aware compression the pages were
  // written against.
  compressHTML: true,
  redirects: {
    '/v2': '/',
    // The Webflow-era contact URL; older posts still link to it.
    '/contacts': '/contact',
    // Earlier drafts of the Simula page; /open-source/simula replaced them.
    '/open-source/simula-v2': '/open-source/simula',
    '/open-source/simula-v3': '/open-source/simula',
    '/blog-post/laco-layer-pruning-for-qwen3-8b-our-research-log':
      '/research/laco-layer-pruning-for-qwen3-8b-our-research-log',
    '/blog-post/lcm-lora-distillation-training-fast-diffusion-models':
      '/research/lcm-lora-distillation-training-fast-diffusion-models',
  },
  // Astro's static preview server reads `server.allowedHosts` (see
  // core/preview/static-preview-server.js), not `vite.server`/`vite.preview`,
  // so tunnelled hosts must be listed here to preview a build over ngrok.
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
  },
  integrations: [
    mdx(),
    // Plain URL list: the site has no news, image, video or hreflang entries.
    sitemap({ namespaces: { news: false, xhtml: false, image: false, video: false } }),
    singleSitemapFile,
  ],
  vite: {
    plugins: [forceAllowAllHostsPlugin],
    server: {
      // host: '0.0.0.0',
      allowedHosts: true,
    },
  },
  // Astro 7 renders Markdown with Sätteri by default; the content relies on
  // remark/rehype plugins (math, highlighting, heading anchors, scrollable
  // tables), so it stays on the unified pipeline. MDX inherits it.
  markdown: {
    // Code blocks are coloured by rehype-highlight with the site palette in
    // v2-article.css. Astro's default Shiki would run first and paint them
    // github-dark, which rehype-highlight then skips.
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeSlug,
        rehypeHighlight,
        rehypeKatex,
        rehypeScrollableTables,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'wrap',
            properties: {
              className: ['anchor'],
            },
          },
        ],
      ],
    }),
  },
});
