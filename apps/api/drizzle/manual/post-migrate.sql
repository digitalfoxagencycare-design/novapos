-- Post-migration SQL: things Drizzle's schema DSL cannot express.
-- Every statement here must be idempotent — this file re-runs on every deploy.

-- ── updated_at maintenance ──────────────────────────────────────────────────
-- Doing this in a trigger rather than in application code means a row written
-- by a background job, a manual fix, or a future service still gets a correct
-- timestamp. The sync cursor depends on updated_at being truthful.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END $$;

-- ── Money must never be negative where that is meaningless ──────────────────
-- A negative total is not a refund, it is a bug that has already printed a
-- bill. Catch it at the boundary the application cannot bypass.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_totals_non_negative') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_totals_non_negative CHECK (
      subtotal_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0
      AND total_minor >= 0 AND tip_minor >= 0
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_lines_quantity_positive') THEN
    ALTER TABLE order_lines ADD CONSTRAINT order_lines_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_positive') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount_minor > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_refund_within_amount') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_refund_within_amount
      CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor);
  END IF;
END $$;

-- ── A billed order must have an invoice number, and vice versa ──────────────
-- The gapless-series requirement is worthless if a bill can exist without one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_billed_has_invoice') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_billed_has_invoice CHECK (
      (status IN ('DRAFT', 'OPEN') AND invoice_number IS NULL)
      OR (status IN ('BILLED', 'PAID') AND invoice_number IS NOT NULL)
      OR status = 'VOIDED'
    );
  END IF;
END $$;

-- ── Partial index for the print-queue worker ────────────────────────────────
-- The worker polls for due jobs constantly; indexing only the rows it can act
-- on keeps that scan tiny however large the completed-job history grows.
CREATE INDEX IF NOT EXISTS print_jobs_due_idx
  ON print_jobs (next_attempt_at)
  WHERE status = 'QUEUED';

-- ── Partial index for the POS running-tabs view ─────────────────────────────
CREATE INDEX IF NOT EXISTS orders_live_idx
  ON orders (outlet_id, created_at)
  WHERE status IN ('DRAFT', 'OPEN', 'BILLED');

-- ── Partial index for the KDS ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS kots_live_idx
  ON kots (station_id, created_at)
  WHERE status IN ('PLACED', 'PREPARING', 'READY');

-- ── Platform-only tables ────────────────────────────────────────────────────
-- Cross-tenant platform records are only accessed through DatabaseService.system().
-- The ordinary tenant connection must not read or mutate these tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dealer_allocations', 'dealer_payouts', 'platform_telemetry'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novapos_app') THEN
      EXECUTE format('REVOKE ALL ON %I FROM novapos_app', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'novapos_admin') THEN
      EXECUTE format('GRANT ALL ON %I TO novapos_admin', t);
    END IF;
  END LOOP;
END $$;
