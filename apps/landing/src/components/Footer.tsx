import React from 'react';
import { Store, ShieldCheck, Heart, Scale, Lock, FileText, ArrowUp } from 'lucide-react';

interface Props {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenAbout: () => void;
}

export const Footer: React.FC<Props> = ({ onOpenPrivacy, onOpenTerms, onOpenAbout }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black/90 border-t border-white/10 text-slate-400 text-xs relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg">
                <Store className="w-5 h-5" />
              </div>
              <span className="text-xl font-black text-white">NovaPOS</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              India's leading provider of Android Touch POS billing machines, thermal receipt printers, and cloud SaaS retail billing software.
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              Domain: novasaas.net / novapos.in
            </div>
          </div>

          {/* POS Hardware */}
          <div className="space-y-3">
            <b className="text-sm font-bold text-white uppercase tracking-wider block">POS Hardware</b>
            <ul className="space-y-2 text-xs">
              <li><a href="#hardware" className="hover:text-white transition-colors">Handheld Smart POS Terminal</a></li>
              <li><a href="#hardware" className="hover:text-white transition-colors">15.6" Dual-Screen Desktop POS</a></li>
              <li><a href="#hardware" className="hover:text-white transition-colors">58mm & 80mm Thermal Receipt Printers</a></li>
              <li><a href="#hardware" className="hover:text-white transition-colors">Wireless 2D QR / Barcode Scanners</a></li>
              <li><a href="#hardware" className="hover:text-white transition-colors">Electronic Cash Drawers (RJ11)</a></li>
            </ul>
          </div>

          {/* Software & Industries */}
          <div className="space-y-3">
            <b className="text-sm font-bold text-white uppercase tracking-wider block">Software & Industries</b>
            <ul className="space-y-2 text-xs">
              <li><a href="#software" className="hover:text-white transition-colors">Kirana & Supermarket GST Billing</a></li>
              <li><a href="#software" className="hover:text-white transition-colors">Restaurant Dine-In, Tables & KOT</a></li>
              <li><a href="#software" className="hover:text-white transition-colors">Bakery, Sweets & Confectionery</a></li>
              <li><a href="#software" className="hover:text-white transition-colors">Apparel, Garments & Footwear</a></li>
              <li><a href="#software" className="hover:text-white transition-colors">Customer Khata & Udhar Ledger</a></li>
            </ul>
          </div>

          {/* Legal & Regulatory Compliance */}
          <div className="space-y-3">
            <b className="text-sm font-bold text-white uppercase tracking-wider block">Legal & Compliance</b>
            <ul className="space-y-2 text-xs">
              <li>
                <button type="button" onClick={onOpenPrivacy} className="hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  <Lock className="w-3.5 h-3.5" /> <span>Google Play Privacy Policy</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenTerms} className="hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> <span>Terms of Service & Licensing</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenAbout} className="hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  <Scale className="w-3.5 h-3.5" /> <span>Publisher Details & Grievance</span>
                </button>
              </li>
              <li>
                <a href="#download" className="hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5" /> <span>Target SDK 35 (Android 15) Ready</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>
            © 2026 NovaPOS Technologies & Digital Fox Agency. All rights reserved. Compliant with Consumer Protection (E-Commerce) Rules, 2020.
          </p>
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
