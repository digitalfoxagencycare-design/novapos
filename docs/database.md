# Database

PostgreSQL 16+, accessed through Drizzle ORM. The schema lives in
`apps/api/src/db/schema.ts`; migrations are generated SQL files in `apps/api/drizzle/` and are
reviewed like any other code.

---

## Multi-tenancy

### The model

Every business-owned table carries `tenant_id`. There are 31 such tables; the only unscoped one
is `tenants` itself, which *is* the tenant.

Isolation is enforced by **Postgres row-level security**, not by application code:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant_isolation ON orders
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
```

The API sets `app.current_tenant` at the start of each transaction:

```sql
BEGIN;
SELECT set_config('app.current_tenant', '<uuid>', true);   -- true = transaction-local
-- … every query here is filtered …
COMMIT;
```

### Why this rather than filtering in code

The failure modes are different, and that is the whole argument.

A missing `WHERE tenant_id = …` in a repository method returns *another tenant's data*. It looks
like a working feature. It ships. Someone finds out later.

A missing `set_config` returns *zero rows*. It breaks immediately, visibly, in development.

`FORCE ROW LEVEL SECURITY` matters too: without it, the table's **owner** silently bypasses its
own policies — which is exactly the case that slips through testing, because the developer is
usually connected as the owner.

### Two roles, and why

```
novapos_app     no BYPASSRLS.  The API connects as this. Serves all customer traffic.
novapos_admin   BYPASSRLS.     Migrations, and the handful of genuinely cross-tenant paths.
```

The cross-tenant paths are deliberately few and easy to find — every one goes through
`DatabaseService.system()`:

- the login lookup (there is no tenant context until a credential resolves one)
- payment webhooks (a provider callback carries no session)
- the print-queue worker (spans tenants)
- retention sweeps

### The trap that nearly shipped

**A Postgres superuser bypasses RLS unconditionally** — `FORCE ROW LEVEL SECURITY` included.
There is no way to make a policy apply to a superuser.

During development this project connected as `postgres`. Every policy was in place, the schema
was correct, the application looked healthy — and tenant isolation was doing nothing at all. It
was caught only because the isolation tests were written adversarially and run as the real app
role.

Two safeguards now exist:

1. **The API checks its own role at boot** (`checkRlsEnforcement`) and refuses to start in
   production if that role is a superuser or has `BYPASSRLS`. In development it logs a loud
   warning. The startup line tells you which it is:

   ```
   Database ready — RLS policies on 31 tables, enforcement ACTIVE (role: novapos_app)
   ```

2. **The test suite connects as `novapos_app`**, so the isolation tests exercise the real
   constraint rather than passing vacuously.

If you take one thing from this document: check that startup line says `ACTIVE`.

### Verifying it yourself

```sql
-- Should return f, f for novapos_app
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname LIKE 'novapos%';

-- Every tenant-scoped table should have rowsecurity = t and at least one policy
SELECT tablename, rowsecurity,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS policies
FROM pg_tables t WHERE schemaname = 'public' ORDER BY 1;
```

And the empirical check, which is more convincing than either:

```sql
-- As novapos_app, with no tenant set:
SELECT count(*) FROM orders;     -- must be 0, not "all of them"
```

---

## Money

Every monetary column is `integer`, holding the currency's **minor unit** — paise, cents, fils.
Floating point never touches money anywhere in this system.

The exponent travels with the currency because it is not always 2: JPY and KRW have 0, KWD and
BHD have 3. `currencyExponent()` in `@novapos/shared` knows the exceptions.

`integer` caps a single value at about 2.1 billion minor units — ₹21 million for one order,
which is comfortable. Aggregates in reports cast to `bigint` in SQL before summing.

---

## Conventions

**Uniqueness is per tenant, never global.** `@@unique([tenantId, code])`, so two restaurants can
both have an item coded `TEA`.

**Historical rows snapshot what they need.** `order_lines.nameSnapshot`, `unitPriceMinor`,
`taxSnapshot`; `orders.taxSnapshot`. A bill reprinted six months later shows exactly what the
guest was charged, even after prices and tax rates have moved. Reports read these snapshots and
never recompute — otherwise last quarter's numbers would change when this quarter's rates do.

**Menu items are soft-deleted.** `order_lines` reference `menu_items` without `ON DELETE
CASCADE`, deliberately: a hard delete would make an old bill unreprintable, which in most
jurisdictions this ships to is a records-retention violation.

**`updated_at` is maintained by a trigger**, not by application code, so a row written by a
background job or a manual fix still gets a truthful timestamp. The sync cursor depends on that.

---

## Constraints worth knowing about

Beyond the schema, `drizzle/manual/post-migrate.sql` adds constraints the DSL cannot express.
All are idempotent and re-run on every deploy.

```sql
orders_totals_non_negative       -- a negative total is not a refund, it is a printed bug
order_lines_quantity_positive
payments_amount_positive
payments_refund_within_amount    -- cannot refund more than was taken
orders_billed_has_invoice        -- a BILLED or PAID order must have an invoice number,
                                 -- and a DRAFT or OPEN one must not
```

That last one is what makes the gapless-series guarantee meaningful: it is worthless if a bill
can exist without a number.

Three partial indexes keep the hot paths small regardless of history size:

```sql
print_jobs_due_idx   ON print_jobs (next_attempt_at) WHERE status = 'QUEUED'
orders_live_idx      ON orders (outlet_id, created_at) WHERE status IN ('DRAFT','OPEN','BILLED')
kots_live_idx        ON kots (station_id, created_at) WHERE status IN ('PLACED','PREPARING','READY')
```

---

## Invoice sequences

`invoice_sequences` is a counter table, one row per `(outlet, period, prefix)`.

```sql
INSERT INTO invoice_sequences (…) VALUES (…, 0) ON CONFLICT DO NOTHING;
UPDATE invoice_sequences SET last_number = last_number + 1
 WHERE outlet_id = $1 AND period = $2 AND prefix = $3
RETURNING last_number;
```

The `UPDATE … RETURNING` takes a row lock held until the transaction commits, which is what
serialises two concurrent tills.

**Why not a Postgres sequence?** It leaks numbers on rollback, producing gaps. India's GST rules
and most EU jurisdictions require consecutive numbering.

**Why not `max(n) + 1`?** It races. Two tills read the same maximum and both write the same
number. This exact bug shipped in an early version of this codebase for the *order* number and
was caught by a concurrency test — see `order-flow.test.ts`, "does not hand the same invoice
number to two concurrent tills".

The same mechanism issues daily order numbers, where gaps are fine but duplicates are not
(`(outlet_id, order_number)` is unique).

---

## Migrations

```bash
pnpm --filter @novapos/api db:generate    # after editing schema.ts — writes SQL to drizzle/
pnpm --filter @novapos/api db:migrate     # applies SQL, then RLS policies, then post-migrate.sql
```

The runner re-applies RLS policies on **every** run, idempotently. That is deliberate: a newly
added table must never sit in production without its policy, and relying on someone remembering
to add it to a migration is how that happens. The runner then verifies coverage and **exits
non-zero if any tenant-scoped table is unprotected**, so a bad deploy fails loudly rather than
succeeding quietly.

Adding a table:

1. Define it in `schema.ts`.
2. If it carries `tenant_id`, add its name to `TENANT_SCOPED_TABLES` in the same file.
3. `db:generate`, review the SQL, `db:migrate`.

Forgetting step 2 means no policy. The migration's coverage check catches it.
