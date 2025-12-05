import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Velite plugin for Vite - runs Velite build during dev/build
function velitePlugin() {
  let started = false;
  return {
    name: 'velite',
    async buildStart() {
      if (started) return;
      started = true;
      const { build } = await import('velite');
      await build({ watch: process.argv.includes('--watch') || process.env.NODE_ENV === 'development' });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [velitePlugin(), tailwindcss(), react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@/.velite': path.resolve(__dirname, '.velite'),
        }
      }
    };
});
