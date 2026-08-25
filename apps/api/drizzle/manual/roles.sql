-- Database roles.
--
-- Run once per database, as a superuser, BEFORE the first migration:
--   psql "$ADMIN_URL" -f drizzle/manual/roles.sql
--
-- Two roles, because tenant isolation depends on the difference:
--
--   novapos_app    — what the API connects as. No BYPASSRLS, so every query it
--                    issues is filtered by the row-level-security policies.
--                    This is the role that serves customer traffic.
--
--   novapos_admin  — owns the schema, runs migrations, and serves the handful
--                    of genuinely cross-tenant paths (login lookup, payment
--                    webhooks, retention sweeps). Never used for request
--                    handling.
--
-- Set real passwords: replace the placeholders or pass them via psql -v.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novapos_admin') THEN
    CREATE ROLE novapos_admin LOGIN PASSWORD 'CHANGE_ME_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novapos_app') THEN
    CREATE ROLE novapos_app LOGIN PASSWORD 'CHANGE_ME_app';
  END IF;
END $$;

-- The app role must NOT bypass RLS. Stated explicitly because a role that
-- inherits BYPASSRLS from somewhere would silently defeat the whole design.
ALTER ROLE novapos_app NOBYPASSRLS;

DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO novapos_app, novapos_admin', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO novapos_app, novapos_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO novapos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO novapos_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO novapos_admin;

-- Tables created by future migrations get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO novapos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO novapos_app;
