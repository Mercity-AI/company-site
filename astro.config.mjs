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

export default defineConfig({
  site: 'https://www.mercity.ai',
  // Astro 7 defaults to JSX whitespace rules, which drop spaces between
  // inline elements; keep the HTML-aware compression the pages were
  // written against.
  compressHTML: true,
  redirects: {
    '/v2': '/',
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
    sitemap({
      filter: (page) => !/\/simula-v2\/?$/.test(page),
    }),
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
