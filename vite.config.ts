import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const siteUrl = new URL(process.env.VITE_SITE_URL || 'https://roam-folio.com/');
siteUrl.pathname = siteUrl.pathname.replace(/\/?$/, '/');
siteUrl.search = '';
siteUrl.hash = '';

export default defineConfig({
  plugins: [react(), {
    name: 'social-metadata',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replaceAll('%SITE_URL%', siteUrl.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')),
    },
  }],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString()),
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
