# QA checklist

What to test before a real restaurant depends on this. Split into what is already automated
(so you know what you do *not* need to retest by hand) and what still needs a human or real
hardware.

**Legend:** ✅ covered by an automated test · 🔲 needs manual testing · 🖨 needs real hardware

---

## Already automated — 172 tests

Run with `pnpm test`. The API suite needs a Postgres reachable at `DATABASE_URL` with `test`
in the name.

| Area | Covered |
|---|---|
| **Tax engine** (28) | GST intra/inter-state split, tax-inclusive back-out, EU VAT + reverse charge, US multi-component, zero-rated slabs, compounding, invoice rounding, rule-set validation, no lost paise across 37 mixed-slab lines |
| **Money** (16) | Rounding modes, banker's rounding, binary-error resistance, exact allocation across many awkward splits, currency exponents, RTL locales |
| **ESC/POS** (35) | Layout at 32 and 48 columns, word wrap, column scaling, profile detection at every confidence level, character folding, cut/QR/drawer fallbacks, receipt and KOT rendering, "no prices on a KOT" |
| **Order flow** (23) | Full order→KOT→bill→pay→receipt, station routing, re-fire refusal, modifiers, gapless invoice numbers, **8 concurrent tills with no duplicate number**, partial payments, cash change, card overpayment refusal, exact bill splitting, discounts, category counts |
| **Isolation** (20) | RLS coverage on all 31 tables, cross-tenant read/write blocked at the database, cross-tenant API access blocked, login enumeration resistance, refresh-token rotation and family revocation on reuse, account lockout, RBAC per role, void audit trail |
| **Offline sync** (16) | Duplicate delivery, full batch replay, edit-vs-replay distinction, payment key reuse rejection, poisoned operation in mid-batch, dead-letter parking, conflict reconciliation, full offline shift replay, cursor semantics, two devices on one tab, void-not-delete after firing |
| **POS logic** (34) | Cart merge rules, fired-line protection, local pricing parity, sync queue ordering, backoff bounds and jitter, dead letters, device reset guard, offline vs error states |

---

## Manual — before the first paying customer

### Offline behaviour 🔲

The most important section. Test on the actual device you will sell.

- [ ] Take an order with wifi off. Total appears immediately and is correct.
- [ ] Fire to the kitchen offline. The lines show as "Sent"; the sync pill shows queued work.
- [ ] Try to bill offline. It must refuse **with a clear explanation**, not a generic error.
- [ ] Reconnect. Queued work flushes in order; the bill then succeeds.
- [ ] Take an order offline, then **close the browser tab entirely**. Reopen. The order is
      still there with all its lines.
- [ ] Reload mid-order with wifi on. No sign-out, no lost lines.
- [ ] Turn wifi off and on ten times in a minute. No duplicate orders appear.
- [ ] Take twenty orders offline, then reconnect. All twenty arrive, none twice.
- [ ] Leave a device offline overnight with queued orders. Reconnect next morning.
- [ ] **Safari specifically**: leave the PWA unopened for eight days, then reopen. Safari evicts
      storage for non-installed PWAs after seven days — confirm whether the local database
      survived. If not, that is a launch blocker for iPad tills.

### Two devices, one restaurant 🔲

- [ ] Two tills open the same table. Both add items. Neither loses the other's.
- [ ] Two tills press "Bill" on different orders at the same instant. Both get numbers; the
      numbers differ and have no gap between them.
- [ ] One till goes offline, edits an order, comes back — while the other till edited the same
      order online. Confirm the merge is sensible and nothing vanishes silently.
- [ ] A waiter voids a line the kitchen already has. Confirm the kitchen is told.

### Money 🔲

- [ ] Bill totalling ₹99.99 — check rounding to the nearest rupee and the round-off line.
- [ ] Split a ₹100.01 bill three ways. Parts sum exactly to the total.
- [ ] Cash ₹2000 against a ₹347 bill. Change shows ₹1653, large and unmissable.
- [ ] Pay half by card, half by cash. Order settles exactly once.
- [ ] Apply a 100% discount. Total is zero, no negative numbers anywhere.
- [ ] Add an item, remove it, add it again. Total returns to where it should be.
- [ ] Ring up 50 items on one bill. Totals still reconcile; the screen stays usable.

### Tax 🔲

Cross-check every one of these against an accountant before launch.

- [ ] Dine-in in your own state: CGST + SGST, each half the slab.
- [ ] Delivery to another state: a single IGST line at the full slab.
- [ ] A bill mixing 5%, 12% and 28% items. Each slab gets its own tax rows.
- [ ] A zero-rated item. No tax line at all.
- [ ] Service charge, where you levy one: taxed at its own slab, after discount.
- [ ] Tip: added after tax and never taxed.
- [ ] Print a bill, then change that item's price and reprint. **The reprint must show the
      original figures.** If it does not, stop — that is a serious bug.

### Kitchen 🔲

- [ ] Fire an order with items for two stations. Each station gets only its own.
- [ ] A ticket ages past 8 and 15 minutes. It turns amber, then red, visibly from across a room.
- [ ] Pull the kitchen screen's network cable mid-service. It shows "Reconnecting", then
      recovers with the correct tickets — **not an empty screen**.
- [ ] Restart the API while a KDS is connected. The screen reconnects on its own.
- [ ] Cancel an order that is already cooking. The kitchen is told.
- [ ] Two screens on the same station. Both see every ticket; marking done on one updates both.

### Access control 🔲

- [ ] A waiter cannot void, cannot take payment, cannot change the menu.
- [ ] A cashier cannot change the menu.
- [ ] A void requires a reason, and the reason plus the operator appear in the audit log.
- [ ] Eight wrong passwords lock the account; a correct password then still refuses.
- [ ] Sign in as tenant A, note an order id, sign in as tenant B, request that id → 404.

---

## Printing 🖨 — needs real hardware

**Nothing in this section has been verified.** See `docs/known-limitations.md`.

Print a sample first: `pnpm --filter @novapos/escpos preview -- --raw | nc <ip> 9100`

### Per printer model you intend to support

- [ ] **Count the columns.** Print a line of 48 `X` characters at 80mm (32 at 58mm). Count what
      actually fits. If it differs, add a profile — this is the single most valuable thing on
      this page.
- [ ] Receipt renders with no wrapping or truncation at the right edge.
- [ ] Long item names wrap sensibly rather than running into the price column.
- [ ] The total is large and unmistakable.
- [ ] The cut command works. If not, try the `GS V 66 n` variant.
- [ ] The QR code scans with a real phone, and a UPI QR actually opens a payment app.
- [ ] Non-ASCII characters. **Expect `₹` to fold to `Rs.` and Devanagari to become `?`** —
      confirm and decide whether that is acceptable for your market.
- [ ] KOT is legible from two metres. Quantities stand out.
- [ ] A MODIFIED KOT clearly shows what changed.
- [ ] The cash drawer opens, if wired.

### Failure handling 🖨

- [ ] Turn the printer off mid-service. The order still completes; the failure appears in the
      admin print queue.
- [ ] Turn it back on. Retry the job from the admin screen; it prints.
- [ ] Run the paper out mid-receipt. Reload; confirm what a reprint produces.
- [ ] Unplug the network printer's cable. Confirm the backoff does not hammer it, and that it
      recovers when replugged.
- [ ] Print twenty receipts in quick succession. Nothing is truncated or interleaved.

### Bluetooth 🖨

- [ ] Pair from the till device.
- [ ] Print with the printer at the far end of the restaurant.
- [ ] Walk out of range mid-print. Confirm what happens and that the job is retried.
- [ ] Print a long receipt (20+ lines). **Cheap Bluetooth printers truncate on fast writes** —
      if so, a chunked writer with a delay between chunks is needed.

---

## Payments 🔲

Do all of this in the provider's test mode before touching live keys.

- [ ] A successful payment.
- [ ] A declined payment. The cashier sees why and can retry or switch to cash.
- [ ] The provider times out. The sale is not lost.
- [ ] A partial refund, then a full refund.
- [ ] A webhook arriving twice. The payment does not double-count.
- [ ] A webhook with a tampered body → **rejected**. Verify this explicitly.
- [ ] Webhooks arriving out of order. The payment does not move backwards.
- [ ] Reconcile a full day against the provider's settlement report.

---

## Before you go live

- [ ] Boot log says `enforcement ACTIVE (role: novapos_app)`.
- [ ] `JWT_SECRET` is a real generated secret, not the placeholder.
- [ ] Backups run nightly, are copied off the machine, and **one has been restored**.
- [ ] Exactly one API instance is running (see the Redis caveat in `known-limitations.md`).
- [ ] `/health/ready` is monitored.
- [ ] The seed data is gone from the production database.
- [ ] Seed credentials do not exist in production.
- [ ] You have read `docs/known-limitations.md` end to end.
