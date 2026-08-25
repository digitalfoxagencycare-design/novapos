# Tax engine

Adding a country is a database row, not a code change and not a deployment. This document
explains the model, then walks through adding a jurisdiction.

Source: `packages/tax-engine/`.

> **Not tax advice.** The shipped presets are starting points. Verify every rate and rule with
> a qualified professional for each market before billing a customer under it.

---

## The model

Three concepts, and everything else follows from them.

**Slab** — a named rate bucket an item belongs to. `gst-5`, `vat-standard`, `exempt`. A menu
item references a slab id, not a rate, so rates can change without touching the menu.

**Component** — a line that appears on the receipt. `CGST`, `SGST`, `VAT`, `District Tax`. Each
takes either a share of the item's slab rate (`slab-share`) or a flat rate of its own
(`fixed`), and each is gated by a condition.

**Condition** — a small boolean expression over facts about the sale.

That is the whole DSL. India's GST needs no special-casing:

```ts
components: [
  { code: 'CGST', rateSource: 'slab-share', share: 0.5,
    when: { op: 'eq', field: 'intraState', value: true } },
  { code: 'SGST', rateSource: 'slab-share', share: 0.5,
    when: { op: 'eq', field: 'intraState', value: true } },
  { code: 'IGST', rateSource: 'slab-share', share: 1,
    when: { op: 'eq', field: 'intraState', value: false } },
]
```

Two components at half rate when the supply stays in the state, one at full rate when it does
not. The same machinery expresses EU reverse charge and US state/county/district stacking.

### Facts a condition can read

| Field | Meaning |
|---|---|
| `intraState` | Place of supply is the outlet's own state. False across a state line, and always false across a country border even if region codes happen to match. |
| `intraCountry` | Place of supply is the outlet's country |
| `customerIsBusiness` | B2B |
| `customerHasTaxId` | A VAT number or GSTIN is on file |
| `customerExempt` | An exemption certificate is on file — suppresses every component |
| `channel` | `DINE_IN`, `TAKEAWAY`, `DELIVERY`, `QUICK_BILL` |
| `outletCountry`, `outletRegion` | |
| `flag:<name>` | Anything a tenant sets — SEZ status, a composition scheme, a local levy |

Operators: `always`, `eq`, `ne`, `in`, `and`, `or`, `not`.

### Rule-set settings

| Setting | Effect |
|---|---|
| `pricesIncludeTax` | Menu prices are gross (India, EU retail) or net (US). Changes the arithmetic entirely. |
| `applyAt` | `line` computes per line; `invoice` collapses to one synthetic line per slab first. Changes rounding, which is the point. |
| `rounding.mode` | `half-up`, `half-even` (banker's), `half-down`, `ceil`, `floor` |
| `rounding.componentStep` | Round each component to this many minor units |
| `rounding.invoiceStep` | Round the grand total. `100` = nearest rupee. |
| `serviceChargeSlabId` | Which slab taxes a service charge. Null leaves it untaxed. |
| `deliveryChargeSlabId` | Same for delivery. |
| `receiptRequirements` | Which legal fields the receipt template must print. |

---

## Order of operations

This is where most of the edge cases live, and it is fixed:

1. line gross = quantity × (unit price + modifiers)
2. line discount applied to the line gross
3. **order discount apportioned across lines** by their discounted value, exactly — the parts
   always sum back to the discount, with no lost minor unit
4. service charge computed on the discounted subtotal, taxed at its own slab
5. tax computed per line on the post-discount value
6. tip added after tax, **never taxed**
7. invoice rounding applied last and reported as its own receipt line

Tax always follows the discounted value. That is the rule in India, the EU, and every US state
targeted here.

### Tax-inclusive pricing has one subtlety

When prices include tax, the engine backs the tax out of the gross. Rounding each component
independently can drift a minor unit away from the price the guest was quoted — so the drift is
absorbed into the *taxable base*, never the total. The menu says ₹99, the guest pays ₹99.

---

## Adding a jurisdiction

Say Saudi Arabia: 15% VAT, tax-inclusive prices, halalas as minor units.

```ts
const SA_VAT: TaxRuleSet = {
  id: 'SA-VAT',
  label: 'Saudi Arabia — VAT',
  country: 'SA',
  pricesIncludeTax: true,
  applyAt: 'line',
  rounding: { mode: 'half-up', componentStep: 1, invoiceStep: 1 },
  slabs: [
    { id: 'vat-zero', label: 'VAT 0%', rate: 0, category: 'zero' },
    { id: 'vat-standard', label: 'VAT 15%', rate: 0.15, category: 'standard' },
  ],
  components: [
    { code: 'VAT', label: 'VAT', rateSource: 'slab-share', share: 1, reportingCode: 'VAT' },
  ],
  serviceChargeSlabId: 'vat-standard',
  deliveryChargeSlabId: 'vat-standard',
  receiptRequirements: {
    sequentialInvoiceNumber: true,
    showTenantTaxId: true,
    showTaxBreakdownTable: true,
  },
};
```

Store it against the tenant:

```ts
await taxConfig.upsertRuleSet({
  key: 'SA-VAT', label: 'Saudi Arabia — VAT', country: 'SA', definition: SA_VAT,
});
```

Point the outlet at it (`outlets.taxRuleSetKey = 'SA-VAT'`) and it is live on the next order.

**`upsertRuleSet` validates before saving** and refuses anything that would fail at the till —
a rate written as `18` instead of `0.18`, duplicate component codes, a charge slab pointing at
a slab that does not exist. Better to reject it in the admin screen than to discover it with a
queue of customers waiting.

---

## Versioning

Rule sets are versioned by `effectiveFrom`. Every lookup takes a date and picks the newest set
in force then.

More importantly, each order stores a **frozen snapshot** of its own computation. Reports and
reprints read that snapshot and never recompute. Change your rates today and last quarter's
figures do not move — which is what an auditor expects, and what a guest disputing an old bill
needs.

---

## Testing a change

The admin dashboard's Tax page runs the real engine in the browser. Enter an amount, pick a
slab, toggle the place of supply, and see exactly what a guest would be charged — before
anyone is charged it.

The automated suite (`packages/tax-engine/src/engine.test.ts`, 28 tests) covers the cases that
have historically gone wrong: the intra/inter-state split, backing tax out of an inclusive
price that does not divide cleanly, reverse charge in all four B2B/B2C × domestic/cross-border
combinations, US components on an exempt slab, and a 37-line mixed-slab bill reconciling to the
paisa.

Every shipped preset is validated by a test, so a typo in a rate fails the build rather than a
customer's bill.
