import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Printer } from 'lucide-react';
import { useBackHandler } from '../lib/navigation';

import { NovaPrint as NativePrint } from '../lib/nativePrint';

export function showPrintPreview(html: string) {
  window.dispatchEvent(new CustomEvent('novapos:print', { detail: html }));
}

export function PrintPreview() {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useBackHandler(Boolean(html), () => setHtml(null));
  useEffect(() => {
    const show = (event: Event) => { setError(''); setReady(false); setHtml((event as CustomEvent<string>).detail); };
    window.addEventListener('novapos:print', show);
    return () => window.removeEventListener('novapos:print', show);
  }, []);
  if (!html) return null;
  return <section className="print-preview" role="dialog" aria-modal="true" aria-label="Print preview">
    <header><button onClick={() => setHtml(null)} aria-label="Back from print preview"><ArrowLeft size={20} /> Back</button><h2>Print preview</h2><button disabled={!ready} onClick={async () => {
      try {
        if (Capacitor.isNativePlatform()) await NativePrint.printHtml({ html, title: 'NovaPOS receipt' });
        else { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }
      } catch (err) { setError(`Could not open printing: ${(err as Error).message}`); }
    }}><Printer size={18} /> Print</button></header>
    {error && <p role="alert" className="p-3 text-rose-700">{error}</p>}
    <p className="p-3 text-sm text-center">Select a printer or save a PDF. Use Back to return to NovaPOS.</p>
    <iframe ref={frame} title="Receipt preview" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} />
  </section>;
}
