import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@novapos/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@novapos/tax-engine': path.resolve(__dirname, '../tax-engine/src/index.ts'),
      '@novapos/escpos': path.resolve(__dirname, '../escpos/src/index.ts'),
    },
  },
  test: { name: 'escpos', include: ['src/**/*.test.ts'], globals: true },
});
