# API

Base path `/api/v1`. Interactive docs at `/api/docs` in development, or with
`ENABLE_DOCS=true`.

Every request is scoped to the tenant in the bearer token. There is no way to address another
tenant's data through this API — see `docs/database.md`.

---

## Authentication

```http
POST /auth/login
{ "tenantSlug": "nova-kitchen", "email": "owner@…", "password": "…" }

→ { "tokens": { "accessToken": "…", "refreshToken": "…", "expiresIn": 900 },
    "staff":  { "id": "…", "name": "…", "role": "OWNER", "outletId": null,
                "permissions": ["order:create", …] } }
```

`POST /auth/login/pin` signs in with a till PIN for fast operator switching at a shared
terminal — scoped to one outlet and rate-limited harder, because a 4-digit PIN is weak by
construction.

`POST /auth/refresh` rotates. **Each refresh mints a new token and revokes the old one.** If a
already-consumed token is presented, the entire rotation family is revoked — that is the
signature of a stolen token being replayed, and signing every session in that chain out is the
safe response.

A client must therefore ensure only one refresh is in flight at a time. Both the POS and admin
clients serialise this; a second concurrent refresh would present an already-rotated token and
sign the device out.

Headers:

| Header | Purpose |
|---|---|
| `Authorization: Bearer <token>` | Required except on `@Public()` routes |
| `X-Outlet-Id` | Pin a request to an outlet. Must be one the token permits. |
| `X-Device-Id` | Attributes queued work to a terminal. Diagnostics, not security. |

---

## Errors

Every error carries a stable machine-readable code alongside the message, because an offline
client replaying a queue needs to decide whether to retry, drop, or surface it — and a
human-readable string cannot drive that decision.

```json
{ "code": "INVALID_STATE",
  "message": "An order that is PAID cannot become VOIDED. A paid bill is final; issue a refund and a fresh bill instead.",
  "details": { "from": "PAID", "to": "VOIDED", "allowed": [] },
  "retryable": false }
```

| Code | HTTP | Meaning | Client should |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Bad or expired token | Refresh once, then sign in |
| `FORBIDDEN` | 403 | Missing permission | Show it; do not retry |
| `NOT_FOUND` | 404 | No such entity in this tenant | Do not retry |
| `VALIDATION_FAILED` | 400 | Malformed or references something gone | Do not retry |
| `INVALID_STATE` | 409 | Illegal transition | Re-fetch and reconcile |
| `SYNC_CONFLICT` | 409 | Server moved past the client | Re-fetch and reconcile |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Same key, different body | Client bug; do not retry |
| `TAX_CONFIG_INVALID` | 422 | Rule set would fail at the till | Operator must fix config |
| `PAYMENT_FAILED` | 402 | Gateway declined or unreachable | Retryable |
| `PRINTER_UNREACHABLE` | 503 | No printer, or it did not answer | Retryable |

---

## Orders

```http
POST /orders
{
  "clientOrderId": "<uuid>",          // identity of the order on the device
  "clientRequestId": "<uuid>",        // optional; identity of this write attempt
  "outletId": "<uuid>",
  "channel": "DINE_IN",
  "tableIds": ["<uuid>"],
  "guestCount": 2,
  "lines": [
    { "clientLineId": "<uuid>", "itemId": "<uuid>", "quantity": 2,
      "modifierIds": ["<uuid>"], "notes": "less spicy" }
  ],
  "orderDiscount": { "type": "PERCENT", "value": 10, "reason": "Regular guest" }
}
```

**All money is recomputed server-side** from menu data. Client-supplied totals are not merely
ignored — validation rejects the request outright, so a tampered client cannot set its own
prices.

### The two ids, and why there are two

`clientOrderId` identifies the *order*; an upsert targets it. `clientRequestId` identifies this
*write attempt*.

If one value did both jobs, the server could not distinguish "the network dropped, resend the
same thing" from "the guest ordered another naan" — and one of those two entirely normal
situations would have to be rejected. Omit `clientRequestId` and the server derives one from
the request content: an identical resend deduplicates, a changed one applies as an edit.

Payments are different. They are not upserts, so `clientPaymentId` is strict: the same key with
a different amount is rejected as a client bug.

### Lifecycle

```
POST /orders/:id/fire     → creates one KOT per station, pushes to screens, queues printers
POST /orders/:id/bill     → assigns a gapless invoice number, freezes totals. Idempotent.
POST /orders/:id/payments → takes payment. Idempotent on clientPaymentId.
POST /orders/:id/void     → requires a reason. Records it. Never deletes.
GET  /orders/:id/receipt  → the rendered receipt document
GET  /orders?outletId=…   → open tabs
```

Only unfired lines are included when firing, so re-firing cannot duplicate a dish already on
the pass.

---

## Offline sync

```http
POST /sync/push
X-Device-Id: till-1
{ "operations": [
    { "opId": "<uuid>", "type": "order.upsert",
      "occurredAt": "2026-08-22T12:30:00Z", "payload": { … } }
] }

→ { "results": [ { "opId": "…", "status": "applied", "entityId": "…" } ],
    "serverTime": "…" }
```

Operations apply **in order**, and the batch is deliberately **not atomic** — one poisoned
operation must not block the twelve good ones queued behind it.

| Status | Meaning | Device should |
|---|---|---|
| `applied` | Done | Remove from queue |
| `duplicate` | Already done | Remove from queue |
| `conflict` | Server state moved past this; `serverState` is included | Adopt it, remove |
| `dead` | Can never succeed | Park it, tell a human, **stop retrying** |
| `retry` | Transient | Back off and try again |

`dead` matters most. A device looping on an impossible operation stops syncing everything
behind it, which is far worse than one held-back line.

```http
GET /sync/pull?outletId=…&since=<cursor>
→ { "cursor": "…", "orders": [...], "kots": [...], "tables": [...], "hasMore": false }
```

The cursor is a **server** timestamp, never the device's — device clocks drift, and a skewed
clock would silently skip records that landed in the gap.

---

## Real-time

WebSocket at `/realtime`, authenticated on connect rather than per message (a kitchen screen
holds one socket for a whole service).

```js
io('/realtime', { auth: { token }, query: { outletId, stationId } })
```

Rooms are namespaced by tenant — `t:<tenantId>:o:<outletId>:s:<stationId>` — so a socket cannot
join another tenant's room even by guessing an id.

| Event | Direction | Meaning |
|---|---|---|
| `ready` | → client | Connected and joined |
| `kot:snapshot` | → client | Everything live on this station, sent on connect |
| `kot:new` | → client | A new or modified ticket |
| `kot:status` | → client | A ticket advanced |
| `kot:update-status` | client → | Mark preparing / ready / served |
| `ping` | client → | Latency probe used by the QA checklist |

The snapshot on connect is what makes a screen that dropped out mid-service come back correct
rather than empty.

---

## Menu

```http
GET /menu/snapshot?outletId=…
```

One call returns everything a POS needs to take and price orders with **no network**:
categories, items with variants, modifier groups, stations, tables, sections, and the outlet's
own settings. It carries a `version` so a device can skip the transfer when nothing changed.

```http
GET    /menu/items?categoryId=&search=
POST   /menu/items                     menu:write
PATCH  /menu/items/:id                 menu:write
DELETE /menu/items/:id                 menu:write — archives, never hard-deletes
GET    /menu/categories                includes a live item count
```

---

## Reports

All read the **frozen tax snapshot** on each order rather than recomputing, so a past period
does not change when today's rates do.

```http
GET /reports/today?outletId=…
GET /reports/sales?outletId=…&from=…&to=…
GET /reports/tax?outletId=…&from=…&to=…        the GST/VAT filing figures
GET /reports/items?outletId=…&from=…&to=…
GET /reports/payments?outletId=…&from=…&to=…
GET /reports/shifts/:id
```

---

## Printing

```http
GET  /printing/profiles                  known 58mm and 80mm profiles
POST /printing/detect                    best-effort width detection + confidence
GET  /printing/queue?outletId=…          what is stuck and why
POST /printing/claim                     device collects jobs for its Bluetooth/USB printers
POST /printing/jobs/:id/result           device reports what happened
POST /printing/jobs/:id/retry            settings:write
```

`/printing/claim` returns pre-rendered ESC/POS bytes as base64, which is what lets a phone print
without reimplementing the layout engine.

---

## Permissions

Enforced per route. `GET /auth/me` returns the caller's set, which the UIs use to hide what the
operator cannot do — though hiding is cosmetic; the server is the boundary.

| Role | Notably can | Notably cannot |
|---|---|---|
| `OWNER` | everything | — |
| `MANAGER` | void, refund, edit menu, reports | tenant settings |
| `CASHIER` | take orders and payment | void, edit menu |
| `WAITER` | take orders, fire to kitchen | take payment, void, edit menu |
| `KITCHEN` | read and advance tickets, reprint | everything else |

Individual staff can be granted extra permissions beyond their role — a senior cashier who may
void, for instance — via `staff.extraPermissions`.

---

## Rate limiting

30 requests/second and 600/minute per client by default. The login route is additionally
protected by per-account lockout: eight failed attempts locks an account for 15 minutes.
