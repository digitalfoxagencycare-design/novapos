import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Generated SQL is checked into the repo and reviewed like any other code.
  // Nothing is auto-pushed to a database; `db:migrate` applies reviewed files.
  strict: true,
  verbose: true,
} satisfies Config;
