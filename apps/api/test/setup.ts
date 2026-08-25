/**
 * Test environment.
 *
 * Points every test at the dedicated test database and supplies the config the
 * API refuses to boot without. `DATABASE_URL` must contain "test" — the
 * truncate helper checks for it before wiping anything.
 */
process.env.NODE_ENV = 'test';
// The app connects as the *unprivileged* role, exactly as it does in
// production. Testing as a superuser would silently bypass every RLS policy
// and make the isolation tests pass vacuously.
process.env.DATABASE_URL ??=
  'postgresql://novapos_app:CHANGE_ME_app@127.0.0.1:5432/novapos_test';
process.env.DATABASE_ADMIN_URL ??=
  'postgresql://postgres@127.0.0.1:5432/novapos_test';
process.env.JWT_SECRET ??= 'test-only-secret-not-for-any-real-deployment-0123456789';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '30d';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
// Keep the print queue from trying to reach hardware during tests.
process.env.PRINT_MAX_ATTEMPTS ??= '1';
