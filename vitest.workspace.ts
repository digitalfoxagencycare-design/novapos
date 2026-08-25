/**
 * Test projects.
 *
 * The API and the POS each need their own config — NestJS requires
 * `emitDecoratorMetadata` (which Vitest's default esbuild transform does not
 * emit, so those tests run through SWC), and the POS needs a DOM plus a real
 * IndexedDB. The pure packages have neither constraint and stay fast.
 */
export default [
  'packages/*',
  'apps/api',
  'apps/pos',
];
