import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const BUILD_TIMESTAMP = Date.now();
const BUILD_DATE = new Date(BUILD_TIMESTAMP).toISOString().split('T')[0];

export default defineConfig({
  base: './',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(`${BUILD_DATE}-${BUILD_TIMESTAMP}`),
    __BUILD_TIME__: BUILD_TIMESTAMP,
    __APP_VERSION__: JSON.stringify(pkg.version), // Always in sync with package.json
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets'),
      'bcryptjs': path.resolve(__dirname, 'node_modules/bcryptjs/index.js'),
    },
  },
  plugins: [
    react(),
  ],
  optimizeDeps: {
    exclude: ['leaflet-routing-machine'],
    include: ['leaflet', 'react-leaflet'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020',
    commonjsOptions: {
      include: [/node_modules/],
      exclude: [/leaflet-routing-machine/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [/^\/vendor\//, 'leaflet-routing-machine'],
      output: {
        manualChunks: {},
      },
    },
  },
});
