/**
 * Print-preview CLI — renders the sample receipt and KOT at both paper widths
 * as plain text, so layout changes can be eyeballed without burning paper.
 *
 *   pnpm --filter @novapos/escpos preview
 *   pnpm --filter @novapos/escpos preview -- --raw > receipt.bin   # real bytes
 *
 * Piping the raw output to a printer is the fastest hardware smoke test:
 *   pnpm --filter @novapos/escpos preview -- --raw | nc 192.168.1.50 9100
 */
import { renderReceipt, renderKot, TEMPLATE_INDIA_GST } from '../src/documents';
import { PROFILE_58MM, PROFILE_80MM, findProfile } from '../src/profiles';
import { SAMPLE_RECEIPT, SAMPLE_KOT } from '../src/samples';

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const only = args.find((a) => a.startsWith('--profile='))?.split('=')[1];
const doc = args.includes('--kot') ? 'kot' : 'receipt';

const profiles = only
  ? [findProfile(only) ?? PROFILE_80MM]
  : [PROFILE_80MM, PROFILE_58MM];

for (const p of profiles) {
  const builder = doc === 'kot'
    ? renderKot(SAMPLE_KOT, p)
    : renderReceipt(SAMPLE_RECEIPT, p, TEMPLATE_INDIA_GST);
  if (raw) {
    process.stdout.write(Buffer.from(builder.build()));
  } else {
    console.log(`\n${'='.repeat(60)}\n  ${doc.toUpperCase()} — ${p.label} (${p.columns} cols)\n${'='.repeat(60)}`);
    console.log(builder.toPlainText());
  }
}
