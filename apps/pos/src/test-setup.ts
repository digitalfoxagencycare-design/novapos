/**
 * Test environment for the POS.
 *
 * `fake-indexeddb` gives Dexie a real IndexedDB implementation rather than a
 * mock, so the offline tests exercise the actual storage layer — transactions,
 * indexes, auto-increment ordering and all.
 */
import 'fake-indexeddb/auto';

// jsdom/happy-dom do not implement these, and the POS depends on both.
if (!globalThis.crypto?.randomUUID) {
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

if (typeof navigator !== 'undefined' && !('onLine' in navigator)) {
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
}
