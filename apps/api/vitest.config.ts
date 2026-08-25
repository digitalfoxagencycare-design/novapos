import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'node:path';

/**
 * NestJS relies on `emitDecoratorMetadata` for constructor injection, and
 * esbuild (Vitest's default transform) does not emit it — dependencies arrive
 * as `undefined` at runtime. SWC does emit it, so the whole test suite is
 * transformed with SWC instead.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@novapos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@novapos/tax-engine': path.resolve(__dirname, '../../packages/tax-engine/src/index.ts'),
      '@novapos/escpos': path.resolve(__dirname, '../../packages/escpos/src/index.ts'),
    },
  },
  test: {
    name: 'api',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globals: true,
    // Integration tests share one Postgres database, so files must not race.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    setupFiles: ['test/setup.ts'],
  },
});
