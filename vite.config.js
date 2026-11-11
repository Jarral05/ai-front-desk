import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Fonts stay as separate files. The Content Security Policy doesn't allow data: fonts.
    assetsInlineLimit: 0,
  },
  server: {
    // Never move to another port: the page on 5173 would then be an old copy (scripts/check-ports.js).
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
