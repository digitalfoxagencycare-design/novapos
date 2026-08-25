# Known limitations and next steps

An honest account of what has been verified and what has not. Read this before selling NovaPOS
to anyone, and before promising a date.

The bar used throughout: **"tested" means an automated test or a live run proved it. Everything
else is "written but unverified", however confident the code looks.**

---

## 1. Things that need real hardware

These cannot be simulated, and none of them have run against physical equipment.

### Thermal printers — the largest gap

**What is verified:** the ESC/POS byte stream is generated correctly per the Epson command
reference. 35 automated tests cover layout at both paper widths, character folding, cut and
drawer commands, QR fallback, and the column arithmetic. `pnpm --filter @novapos/escpos preview`
renders sample receipts and KOTs as text so layout can be eyeballed.

**What is not:** no byte of this has reached a physical printer. Specifically unverified:

- **Real column counts.** The profiles say 32 columns at 58mm and 48 at 80mm. Clone printers
  vary — some 58mm units give 30, some 80mm units give 42 (the TVS profile already reflects
  this). Every profile you intend to sell against needs one test print and a column count.
- **Code page behaviour.** Non-ASCII characters currently fold to ASCII (`₹` → `Rs.`,
  `Crème` → `Creme`). Devanagari, Tamil and Arabic do **not** print — they become `?`.
  See "Non-Latin scripts" below.
- **Bluetooth pairing and throughput.** The transport layer exists; nothing has opened an SPP
  socket. Cheap Bluetooth printers are notorious for truncating on fast writes, which usually
  needs a chunked writer with a delay between chunks. Expect to add one.
- **The cut command.** `GS V` has variants; some printers need `GS V 66 n` rather than `GS V 1`.
- **Auto-detection confidence.** `detectProfile` is best-effort by design — most ESC/POS
  printers do not report their paper width at all. The app is built to *ask the operator to
  confirm* when confidence is `guess`, which is the right behaviour, but that prompt is not
  yet wired into the mobile app (which does not exist yet).

**Recommended:** buy one 58mm Bluetooth printer and one 80mm network printer before Phase 5.
Budget roughly ₹2,000 and ₹6,000. Test against `docs/qa-checklist.md`.

### Cash drawers

The kick command (`ESC p`) is emitted for profiles that declare a drawer port. Untested. Drawer
wiring varies by till, and some drawers need pin 1 rather than pin 0.

### Card terminals

No integration exists. In India, most small restaurants use a standalone terminal and key the
amount in by hand — NovaPOS records that as a manual `CARD` tender, which is correct and is what
the gateway registry falls back to. Integrated terminals (Pine Labs, Ezetap) would be a separate
adapter behind the existing `PaymentGateway` interface.

---

## 2. Payment gateways — written, never charged

`RazorpayGateway` and `StripeGateway` implement the documented request shapes, and their webhook
signature verification is real (HMAC, constant-time comparison, Stripe's timestamp tolerance
window). The `CashGateway` is fully exercised by the test suite.

**Neither online adapter has made a single live or test-mode call.** Before taking real money:

1. Run the provider's own test-mode suite end to end, including a failed payment, a partial
   refund and a replayed webhook.
2. Verify the webhook endpoint is reachable and that signature verification *rejects* a tampered
   body. Fail-closed is implemented; confirm it.
3. Check settlement reconciliation against the provider's report for a full day.

The abstraction itself is sound — the registry skips unconfigured providers and falls back to a
manual tender rather than failing the sale, which is tested. But an untested payment integration
is a liability, not a feature.

---

## 3. Non-Latin scripts do not print

The ESC/POS layer folds anything outside the printer's single-byte code page to ASCII. Hindi,
Tamil, Bengali and Arabic item names become `?` on paper.

This is a real limitation for the Indian market and the UI already supports those languages —
only *printing* is affected.

Two ways out, neither implemented:

- **Raster rendering.** Draw the line as a bitmap and send it via `GS v 0`, which the builder
  already supports. Works on every printer, needs a font and a text-shaping step, and is slower.
- **Printer-native fonts.** Some Indian-market printers ship Devanagari code pages. Fast and
  simple, but only works on those models.

Raster is the general answer. Estimate: a few days, plus a font licence.

---

## 4. Not yet built

| Item | Phase | Notes |
|---|---|---|
| **Mobile app (Flutter)** | 5 | Not started. Chosen for its ESC/POS and Bluetooth plugin ecosystem. The `@novapos/escpos` byte-builder logic would need a Dart port, or the server-rendered `bytesBase64` from `/printing/claim` can be used directly — the second is much less work and is what the print queue was designed for. |
| **Internationalisation UI** | 6 | Translation catalogues, RTL layout mirroring, and per-locale number formatting are designed for (`isRtl`, `nameI18n` columns, injected translator in the receipt renderer) but no catalogues exist and no string is currently translated. |
| **GDPR/DPDP compliance review** | 7 | The schema supports it — consent records, `anonymisedAt`, an audit trail, tenant isolation. But no data-subject-access or erasure endpoint exists, no retention job runs, and no lawyer has looked at any of it. |
| **App store listings** | 7 | Requires the mobile app to exist first. |
| **Combos** | — | Schema exists (`combos`, `combo_components`); no pricing logic and no UI. |
| **Inventory depletion** | — | Schema exists (`recipe_components`, `stock_movements`); nothing decrements stock when an order is placed. Low-stock alerts have data but no trigger. |
| **Loyalty / CRM** | — | `loyaltyPoints` column only. Deliberately deferred per the brief. |
| **Shift open/close UI** | — | The report exists and is tested; there is no screen to open or close a shift, so `shiftId` is never populated on orders. |
| **Table merge/split** | — | `mergedIntoId` exists in the schema; no logic or UI. Multiple tables per order *does* work. |
| **KOT modification flow** | — | `createModification` is implemented and produces correct delta tickets, but nothing calls it — editing a fired line currently voids and re-fires rather than sending a MODIFIED ticket. |

---

## 5. Operational gaps

- **No background worker.** The print queue drains opportunistically and on a timer inside the
  API process. That is fine for one outlet; a multi-outlet deployment wants a separate worker so
  a slow printer cannot occupy an API process.
- **No Redis.** The WebSocket gateway holds rooms in process memory, so **KOT push works within
  a single API instance only**. Run more than one instance and a KDS connected to instance B
  will not receive a ticket fired on instance A. The fix is the standard Socket.IO Redis
  adapter — perhaps an hour's work — but until then, **scale vertically, not horizontally.**
  The paper-print path is unaffected.
- **No rate limit on the PIN login specifically.** There is a global throttle and per-account
  lockout, but a 4-digit PIN across a whole outlet's staff deserves a tighter, per-outlet limit.
- **Retention job not scheduled.** `IdempotencyService.purgeExpired()` exists and is correct;
  nothing calls it. Records accumulate at roughly one row per write, expiring after 7 days.
- **No monitoring or alerting.** `/health/ready` is there and reports database latency. Nothing
  consumes it.
- **Backups are not configured.** See `docs/deployment.md`. This is the single most important
  operational task before a real restaurant depends on this.

---

## 6. Testing gaps

170 automated tests pass, covering the tax engine, money arithmetic, ESC/POS layout, the full
order→KOT→bill→pay flow, tenant isolation, RBAC, and offline sync. What they do *not* cover:

- **Load.** Nothing has been tested beyond a handful of concurrent requests. The concurrency
  test bills 8 orders simultaneously; a busy Friday is a different shape. No load test exists.
- **The React UI.** No component tests. The POS's *logic* (cart, pricing, sync) is well tested;
  its rendering is not.
- **Long-running sync.** The offline tests simulate failures; nothing has run a device
  disconnected for six hours and then reconnected with hundreds of queued operations.
- **Browser matrix.** Developed against Chromium. IndexedDB behaviour differs on Safari,
  particularly around storage eviction — a POS whose local database is evicted mid-service
  would be a serious problem, and Safari's seven-day eviction policy for non-installed PWAs is
  a real risk that needs testing.
- **Timezone edge cases.** Order numbers *and* KOT numbers restart at UTC midnight, not at the
  outlet's local midnight or at its business-day boundary. A restaurant in India open past
  midnight will see both reset at 05:30 local, mid-service. This is a genuine bug for
  late-night venues.

  The fix is contained: both now allocate from the same locked counter keyed on a
  `businessDate` string, and `kots.business_date` is a stored column. Changing
  `KotService.businessDate()` and the equivalent in `InvoiceNumberService.nextOrderNumber()` to
  use the outlet's timezone and a configurable day-start hour is the whole change. It is the
  first item on the "what I would do next" list below for that reason — small, and it will bite
  a late-night restaurant on day one.

---

## 7. Things I would do next, in order

1. **Fix the business-day boundary** for order numbers. Small, and it will bite a late-night
   restaurant on day one.
2. **Buy two printers** and work through the printing QA checklist. Everything about Phase 5
   depends on what that reveals.
3. **Wire the Socket.IO Redis adapter**, or document loudly that only one API instance may run.
4. **Schedule the retention job** and configure backups.
5. **Run the payment gateways in test mode** end to end.
6. **Then** start the mobile app.
