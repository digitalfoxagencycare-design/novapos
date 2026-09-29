import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@novapos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@novapos/tax-engine': path.resolve(__dirname, '../../packages/tax-engine/src/index.ts'),
      '@novapos/escpos': path.resolve(__dirname, '../../packages/escpos/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      // Two entry points, one deployment: the till and the kitchen screen run
      // on different devices but share the API client, styles and build.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        kds: path.resolve(__dirname, 'kds.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-firebase': ['firebase/app', 'firebase/auth'],
          'vendor-db': ['dexie'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/realtime': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
  test: {
    name: 'pos',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
