# Printing

ESC/POS over Bluetooth, network and USB, at 58mm (2 inch) and 80mm (3 inch).

Source: `packages/escpos/`.

> **No byte of this has reached a physical printer.** The command stream follows the Epson
> reference and 35 automated tests cover layout, but real hardware is the gap. See
> `docs/known-limitations.md` and work through the printing section of `docs/qa-checklist.md`
> before selling against any printer model.

---

## Paper widths

What layout code needs is **columns**, not millimetres — and they differ per printer even at
the same paper width.

| | Font A | Font B (condensed) | Dots |
|---|---|---|---|
| 58mm | 32 columns | 42 | 384 |
| 80mm | 48 columns | 64 | 576 |

Clone printers vary. A TVS RP 3200 gives 42 columns at 80mm, not 48 — which is why the profile,
not the paper width, is the unit of truth.

**The single most valuable hardware test:** print 48 `X` characters at 80mm and count what fits.
If it is not 48, add a profile.

---

## Auto-detection

Most ESC/POS printers do not report their paper width at all, so detection is best-effort by
design. In order of reliability:

1. An explicit profile the operator chose — always wins
2. A model string matched against known vendors (available over USB descriptors and over
   Bluetooth device names on most Android stacks)
3. `GS I` / status-byte width, where firmware supports it
4. Dots-per-line from a printed calibration line
5. Fall back to 80mm — the more common counter printer — and **surface a "confirm your paper
   width" prompt**

That last point matters. `detectProfile` returns a confidence level, and a result of `guess`
should prompt the operator rather than silently printing a misformatted receipt.

```ts
const { profile, confidence } = detectProfile({ modelName: 'XP-58IIH' });
// → { profile: PROFILE_XPRINTER_58IIH, confidence: 'model' }
```

---

## Layout adapts, it is not duplicated

One document renders at both widths. At 80mm an item table has four or five columns; at 32
columns that is illegible, so the renderer puts the name on its own line with `qty × rate` and
the amount beneath.

`row()` treats declared widths as *proportions* and reserves a one-character gutter between
columns — without which a name that exactly fills its cell butts against the next value and the
row becomes unreadable. That was a real bug, caught by eye in the preview output.

Check any layout change with:

```bash
pnpm --filter @novapos/escpos preview
pnpm --filter @novapos/escpos preview -- --kot
pnpm --filter @novapos/escpos preview -- --profile=generic-58
```

---

## Receipts are template-driven

Which blocks appear, and in what order, is configuration:

```ts
export const TEMPLATE_INDIA_GST: ReceiptTemplate = {
  id: 'in-gst',
  blocks: ['logo', 'outlet', 'tax-id', 'invoice-meta', 'customer', 'items',
           'totals', 'tax-table', 'payments', 'qr', 'footer', 'legal'],
};
```

Unknown block names are skipped, so a template written for a future version degrades rather
than crashing. A region needing a different receipt is a new template, not a code change.

Labels go through an injected translator, so nothing is hardcoded English.

---

## KOTs are deliberately unlike receipts

No prices — the kitchen must not see money, and there is a test asserting no currency-shaped
string appears on a KOT. Large glyphs, quantity first (it is what a cook scans for), and change
markers before anything else.

A modified ticket carries only the delta:

```
*** MODIFIED ***
MAIN KITCHEN
================================================
2  Paneer Butter Masala
+ Extra gravy
~ 2>4  Butter Naan
X 1  Veg Biryani
```

`~ 2>4` is a quantity change showing both old and new; `X` is a void. A cook should not have to
diff a fresh ticket by eye against the one already clipped to the rail.

---

## Transports

**Network** — raw TCP on port 9100, the near-universal protocol. Note there is no
application-level acknowledgement: a successful write means the bytes left the socket, not that
paper moved. Real confirmation needs `DLE EOT`, which only some models implement.

**Bluetooth and USB** — the server cannot reach a printer hanging off a phone. Those jobs are
queued and *collected by the device*: it polls `/printing/claim` and gets pre-rendered ESC/POS
bytes to write over its own link.

That design is why the mobile app will not need to reimplement any of this — it writes bytes
the server already rendered.

---

## Failures never block a sale

Every print is a durable job carrying its own fully rendered payload. Retries use exponential
backoff (5s, 10s, 20s, 40s…) capped at six attempts, then park as `FAILED` and appear in the
admin print queue for a human.

The payload is stored rendered, not as a reference to live data, for two reasons: the machine
that prints it may not be the one that queued it, and a retry must reproduce what was
originally meant even if the underlying order has since changed.

A print failure never rolls back the thing it was printing. The money is already taken and the
kitchen has a screen copy; losing the sale because the paper jammed would be far worse than a
missing receipt.

---

## Character encoding — a real limitation

Non-ASCII folds to ASCII: `₹` → `Rs.`, `Crème` → `Creme`. **Devanagari, Tamil and Arabic become
`?`.**

The UI supports those languages; only printing is affected. Two ways out, neither implemented:

- **Raster rendering** — draw the line as a bitmap and send it via `GS v 0`, which the builder
  already supports. Works on every printer; needs a font and text shaping.
- **Printer-native code pages** — some Indian-market printers ship Devanagari. Fast, but only
  on those models.

Raster is the general answer.

---

## Adding a printer profile

```ts
export const PROFILE_MY_PRINTER: PrinterProfile = {
  id: 'vendor-model',
  label: 'Vendor Model (80mm)',
  paperWidth: 80,
  columns: 42,              // ← count this on real paper
  columnsFontB: 56,
  dotsPerLine: 576,
  codePage: 16,
  encoding: 'cp1252',
  supportsCut: true,
  supportsPartialCut: false,
  supportsRaster: true,
  supportsNativeQr: false,  // falls back to printing the payload as text
  supportsBarcode: true,
  supportsDrawerKick: true,
  feedLinesBeforeCut: 3,
};
```

Add it to `BUILT_IN_PROFILES`, and add a matcher in `detectProfile` if the model string is
recognisable.
