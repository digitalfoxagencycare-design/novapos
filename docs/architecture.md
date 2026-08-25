# Architecture

## The shape of it

```
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │  POS (till)  │   │  KDS screen  │   │    Admin     │   │  Mobile app  │
   │   React PWA  │   │   React      │   │   React      │   │  Flutter     │
   │  IndexedDB   │   │  WebSocket   │   │              │   │  (Phase 5)   │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │  REST + sync     │  WebSocket       │  REST            │
          └──────────────────┴──────────┬───────┴──────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │      API           │
                              │   NestJS           │
                              │  ┌──────────────┐  │
                              │  │ auth + RBAC  │  │
                              │  │ orders       │  │
                              │  │ KOT gateway  │──┼──▶ WebSocket rooms
                              │  │ payments     │──┼──▶ Razorpay / Stripe
                              │  │ print queue  │──┼──▶ TCP :9100 printers
                              │  │ reports      │  │
                              │  └──────────────┘  │
                              └─────────┬──────────┘
                                        │  novapos_app (RLS enforced)
                              ┌─────────▼──────────┐
                              │    PostgreSQL      │
                              │  row-level security│
                              └────────────────────┘
```

## Shared packages

The three packages exist because the same logic must run in more than one place, and a second
implementation would drift.

**`@novapos/shared`** — money arithmetic (integer minor units, exact allocation), domain types,
locale configuration, and the RBAC permission map. Depends on nothing.

**`@novapos/tax-engine`** — the tax rule DSL, the jurisdiction presets, and `priceOrder`. Runs
on the server (authoritative) and in the POS (so the cashier sees a total offline). One
implementation, called from both.

**`@novapos/escpos`** — the ESC/POS command builder, printer profiles, and the receipt and KOT
layout renderers. Runs on the server for network printers; the same rendered bytes are handed to
devices for Bluetooth printers via `/printing/claim`, which is what lets the mobile app print
without reimplementing any of it.

## The path of a request

Every authenticated request goes through the same sequence, and the ordering matters:

1. **`AuthGuard`** verifies the bearer token and builds a `TenantContext` — tenant, staff,
   outlet, role, permissions.
2. It calls `runWithTenant(ctx, …)`, putting that context in `AsyncLocalStorage`.
3. **`TenantContextInterceptor`** re-establishes the same context around the handler's
   observable, because a guard's async scope does not extend to the handler that follows it.
4. The service calls `db.tx(fn)`, which opens a transaction and issues
   `SELECT set_config('app.current_tenant', …, true)`.
5. Postgres RLS filters every subsequent query in that transaction.

The consequence: a service method cannot accidentally read another tenant's data, because it
never sees a tenant id it could get wrong. It just queries, and the database constrains it.

## Order lifecycle

```
   DRAFT ──fire──▶ OPEN ──bill──▶ BILLED ──pay──▶ PAID
      │              │               │
      └──────────────┴───────────────┴──────▶ VOIDED
```

Transitions are enforced server-side, not trusted from the client, because an offline device
replaying a stale batch will cheerfully request an illegal one. `PAID` and `VOIDED` are terminal:
correcting a paid bill means a refund and a new bill, which is also the shape a tax auditor
expects to find.

Two moments are worth calling out:

- **Firing** is separate from saving. A waiter builds a round at the table and fires when the
  guest has finished ordering. Only unfired lines are included, so re-firing cannot duplicate a
  dish already on the pass.
- **Billing** is when the invoice number is assigned — not at creation. An abandoned draft must
  never consume a number from a gapless series.

## KOT delivery

When lines are fired:

1. They are grouped **by station**, and one KOT is created per station. The grill does not need
   to read the bar's drinks, and printing the whole order everywhere is how tickets get skimmed
   and items get missed.
2. Each ticket is pushed to KDS screens *and* queued to station printers **concurrently**, via
   `Promise.allSettled`. A jammed printer must not delay the screen, and a disconnected screen
   must not stop the paper. Each leg fails independently and is logged.
3. A line whose station is missing or inactive falls back to the first station rather than
   vanishing. A ticket in the wrong place is recoverable; a ticket nobody ever sees is a
   walked-out customer.

Measured push latency on the reference setup: **29ms**, against the brief's sub-second target.

## Offline sync

The POS is local-first: it writes to IndexedDB and queues an operation, in that order, always.

The outbox is ordered (`++id` in Dexie) and drained in order, because `order.bill` must not
overtake the `order.upsert` that created the order. The server returns a classification per
operation:

| Result | Meaning | What the device does |
|---|---|---|
| `applied` | Done | Remove from queue, record the server id |
| `duplicate` | Already done | Remove from queue |
| `conflict` | Server state moved past this | Adopt the server's version, remove |
| `dead` | Can never succeed | Park it, surface to a human, **stop retrying** |
| `retry` | Transient | Back off exponentially and try again |

The `dead` case is the one that matters most. A device that keeps retrying a poisoned operation
stops syncing everything queued behind it, which is a far worse outcome than one held-back line.

Backoff is exponential, capped at 60 seconds, and jittered so a chain of tills does not retry in
lockstep after an outage.

## What cannot be done offline

Exactly one thing: **billing**. The invoice number must come from the gapless server-side
sequence, and a number minted on a device could collide with another till's — which is a
compliance problem, not an inconvenience. The POS says so plainly and keeps the order open.

Everything else — taking orders, firing to the kitchen, taking payment, printing — works with no
network at all.
