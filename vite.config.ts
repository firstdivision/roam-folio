import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const siteUrl = new URL(process.env.VITE_SITE_URL || 'https://roam-folio.com/');
siteUrl.pathname = siteUrl.pathname.replace(/\/?$/, '/');
siteUrl.search = '';
siteUrl.hash = '';
const buildTimestamp = process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();

export default defineConfig({
  plugins: [react(), {
    name: 'social-metadata',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replaceAll('%SITE_URL%', siteUrl.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')),
    },
  }, {
    name: 'version-file',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0].endsWith('/version.txt')) {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/plain');
          response.setHeader('Cache-Control', 'no-store');
          response.end(`${buildTimestamp}\n`);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.txt',
        source: `${buildTimestamp}\n`,
      });
    },
  }],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
