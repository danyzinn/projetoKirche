/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import church from './config/church.json';

const manifest = JSON.stringify({ name: church.name, short_name: church.shortName,
  description: church.description, start_url: '/', scope: '/', display: 'standalone',
  background_color: '#ffffff', theme_color: church.theme.primary,
  icons: [{ src: church.logoUrl, sizes: 'any', type: 'image/svg+xml' }] });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);


export default defineConfig({
  plugins: [react(), {
    name: 'church-identity',
    transformIndexHtml: { order: 'pre', handler(html) {
      const values: Record<string, string> = { NAME: church.name, DESCRIPTION: church.description, COLOR: church.theme.primary, LOGO: church.logoUrl };
      return html.replace(/%CHURCH_(NAME|DESCRIPTION|COLOR|LOGO)%/g, (_, key: string) => escapeHtml(values[key]));
    },
    },
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json'); res.end(manifest);
      });
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest }); },
  }],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 8080 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', '@supabase/supabase-js', 'zod'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
