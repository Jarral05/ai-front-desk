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
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
});
