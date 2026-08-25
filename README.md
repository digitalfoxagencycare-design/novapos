# NovaPOS

A multi-tenant POS, KOT and admin platform for restaurants and retail, built for the Indian
market and designed from the first commit to work internationally.

Four pieces, one repository:

| | What it is | Where |
|---|---|---|
| **API** | Multi-tenant backend, real-time KOT push, tax engine, print queue | `apps/api` |
| **POS** | Offline-first till for tablet or touchscreen | `apps/pos` |
| **KDS** | Kitchen display screen | `apps/pos` (second entry point) |
| **Admin** | Owner console — menu, reports, tax, printing | `apps/admin` |
| **Mobile** | Flutter app with 2″/3″ thermal printing | Phase 5, not yet built |

---

## Quick start

You need **Node 20+**, **pnpm 10+**, and **PostgreSQL 16+**.

```bash
pnpm install
pnpm build:packages          # the shared packages must exist before the apps compile

# 1. Create the database and its two roles
createdb novapos
psql novapos -f apps/api/drizzle/manual/roles.sql   # edit the passwords first
psql novapos -c "ALTER ROLE novapos_admin BYPASSRLS;"

# 2. Configure
cp apps/api/.env.example apps/api/.env
#   set DATABASE_URL to the novapos_app role
#   set DATABASE_ADMIN_URL to the novapos_admin role
#   generate a secret:  openssl rand -base64 48

# 3. Migrate and seed
pnpm --filter @novapos/api db:migrate
pnpm --filter @novapos/api seed

# 4. Run
pnpm dev:api      # http://localhost:3000  (docs at /api/docs)
pnpm dev:pos      # http://localhost:5173  (kitchen screen at /kds.html)
pnpm dev:admin    # http://localhost:5174
```

The seed creates two tenants deliberately — an Indian restaurant and a German one — because a
multi-tenant system that has only ever run with one tenant has never actually been tested. Seed
credentials are printed at the end of the seed run.

---

## Why it is built this way

A few decisions shape everything else. Each is explained where it lives, but they are worth
stating up front.

### Tenant isolation is enforced by the database, not by application code

Every business-owned table carries `tenant_id` and has a Postgres row-level-security policy.
The API connects as `novapos_app`, a role with no `BYPASSRLS`, and sets `app.current_tenant`
per transaction.

The point is the failure mode. A missing `WHERE tenant_id = …` in a repository is a data breach.
A missing `set_config` here returns *zero rows* — an obvious, immediate bug that surfaces in
development rather than in someone else's data.

There is a second-order trap this guards against too: **a superuser bypasses RLS
unconditionally**, `FORCE ROW LEVEL SECURITY` included. Deploy with `DATABASE_URL` pointing at
`postgres` and every policy becomes decorative while the application looks perfectly healthy.
The API therefore checks its own role at boot and refuses to start in production if it is
exempt. See `docs/database.md`.

### Money is never a floating-point number

Every monetary value in the system is an integer in the currency's minor unit — paise, cents,
fils. The exponent travels with the currency, because JPY has none and KWD has three.
Splitting a bill uses an allocation function that guarantees the parts sum exactly to the
whole; there is no lost paisa at close of shift. See `packages/shared/src/money.ts`.

### The tax engine is configuration, not code

Adding Saudi Arabia's 15% VAT or Ontario's HST is a new row in `tax_rule_sets`, not a code
change and not a deployment. A jurisdiction is described by slabs (rate buckets), components
(the lines that appear on a receipt) and conditions (a small boolean DSL over facts about the
sale).

This is what makes India's GST work without special-casing: CGST and SGST are two components
gated on `intraState`, IGST is one component gated on its negation. The same machinery
expresses EU reverse charge and US state/county/district stacking. See `docs/tax-engine.md`.

### One pricing implementation, not two

The POS prices an order locally so the cashier sees a total the instant they tap an item, even
with the connection down. The server prices it authoritatively.

Those must never disagree — a till that displays one number and charges another is a till
nobody trusts. So there is exactly one `priceOrder`, in `packages/tax-engine`, that both call.
Not two implementations with a test asserting they match; one implementation.

### Offline is the normal case, not the exception

The POS writes to IndexedDB first and always, then queues for the server. Restaurant broadband
fails during service, and a till that stops taking orders when it does is worthless.

Everything the device sends carries a client-generated id, so replaying a batch is harmless.
The server classifies every operation as applied, duplicate, conflict, dead or retry, and the
device acts on that classification — in particular it *stops* retrying what can never succeed,
because a device stuck in a retry loop stops syncing everything queued behind it.

The one thing that cannot be done offline is billing: the invoice number has to come from a
gapless server-side sequence, and a number minted on a device could collide with another till's.
The POS says so plainly rather than failing mysteriously.

### Invoice numbers use a locked counter

India's GST rules and most EU jurisdictions require invoice numbers to run consecutively with no
gaps, per place of business, per financial year. A Postgres sequence leaks numbers on rollback;
`max(n)+1` races into duplicates; an application mutex does not survive a second API instance.

The only correct implementation is a counter row locked with `SELECT … FOR UPDATE` inside the
same transaction that writes the invoice. There is a test that bills eight orders concurrently
and asserts no number repeats.

---

## Repository layout

```
packages/
  shared/       money arithmetic, domain types, locales, RBAC permission map
  tax-engine/   the tax rule DSL, jurisdiction presets, and order pricing
  escpos/       ESC/POS command builder, 58mm and 80mm profiles, receipt and KOT layouts
apps/
  api/          NestJS + Drizzle + Postgres
  pos/          React PWA — till (index.html) and kitchen screen (kds.html)
  admin/        React dashboard
docs/           architecture, database, tax engine, deployment, QA, limitations
```

## Commands

```bash
pnpm build            # everything, packages first
pnpm test             # the whole suite (needs Postgres for the API tests)
pnpm lint             # typecheck every workspace

pnpm --filter @novapos/api db:generate    # new migration from a schema change
pnpm --filter @novapos/api db:migrate     # apply migrations + RLS policies
pnpm --filter @novapos/escpos preview     # render sample receipts as text
pnpm --filter @novapos/escpos preview -- --raw | nc 192.168.1.50 9100   # to real hardware
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit, and the request path
- [`docs/database.md`](docs/database.md) — schema, multi-tenancy, the RLS design
- [`docs/tax-engine.md`](docs/tax-engine.md) — the rule DSL, and how to add a country
- [`docs/api.md`](docs/api.md) — endpoints, auth, error codes, offline sync protocol
- [`docs/printing.md`](docs/printing.md) — ESC/POS, paper-width detection, printer support
- [`docs/deployment.md`](docs/deployment.md) — hosting, environment, scaling, backups
- [`docs/qa-checklist.md`](docs/qa-checklist.md) — what to test before going live
- [`docs/known-limitations.md`](docs/known-limitations.md) — what is not production-hardened yet

**Read `known-limitations.md` before selling this to anyone.** It is honest about what has been
verified against real hardware and real payment providers, and what has not.
