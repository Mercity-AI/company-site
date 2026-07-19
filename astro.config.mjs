import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
  redirects: {
    '/blog-post/laco-layer-pruning-for-qwen3-8b-our-research-log':
      '/research/laco-layer-pruning-for-qwen3-8b-our-research-log',
    '/blog-post/lcm-lora-distillation-training-fast-diffusion-models':
      '/research/lcm-lora-distillation-training-fast-diffusion-models',
  },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss(), forceAllowAllHostsPlugin],
    server: {
      // host: '0.0.0.0',
      allowedHosts: true,
    },
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      rehypeSlug,
      rehypeHighlight,
      rehypeKatex,
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
  },
});
