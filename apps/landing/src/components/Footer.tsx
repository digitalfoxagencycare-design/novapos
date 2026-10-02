import React from 'react';
import { Store, ShieldCheck, Phone, Mail, Heart, Scale, Lock, FileText, Building2 } from 'lucide-react';

interface Props {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenAbout: () => void;
}

export const Footer: React.FC<Props> = ({ onOpenPrivacy, onOpenTerms, onOpenAbout }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-600/30">
                <Store className="w-5 h-5" />
              </div>
              <span className="text-xl font-black text-white">NovaPOS</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              India's leading smart touch billing machines, Bluetooth thermal printers, and 100% offline-first POS cloud software.
            </p>
            <div className="pt-2 text-[11px] text-slate-400">
              <span>Helpline: </span>
              <a href="tel:+919381563241" className="text-white font-bold hover:text-orange-400">
                +91 9381563241
              </a>
            </div>
          </div>

          {/* Products & Portals */}
          <div className="space-y-2.5">
            <b className="text-white text-xs uppercase tracking-wider block font-black">Apps & Hardware</b>
            <ul className="space-y-1.5 text-slate-400">
              <li><a href="https://pos.novasaas.net" target="_blank" rel="noreferrer" className="text-orange-400 font-bold hover:text-orange-300">⚡ Live Web POS (pos.novasaas.net)</a></li>
              <li><a href="https://admin.novasaas.net" target="_blank" rel="noreferrer" className="text-orange-400 font-bold hover:text-orange-300">🛡️ Admin Merchant Portal</a></li>
              <li><a href="#products" className="hover:text-white">Bada Machine + 1-Yr Software (₹6,499)</a></li>
              <li><a href="#products" className="hover:text-white">Touch POS Hardware Standalone (₹2,999)</a></li>
              <li><a href="#products" className="hover:text-white">1-Year Software SaaS License (₹4,999)</a></li>
              <li><a href="#products" className="hover:text-white">Bluetooth Thermal Printers (₹1,999)</a></li>
              <li><a href="#download" className="hover:text-white">Android Mobile POS App</a></li>
            </ul>
          </div>

          {/* Software Features */}
          <div className="space-y-2.5">
            <b className="text-white text-xs uppercase tracking-wider block font-black">Solutions</b>
            <ul className="space-y-1.5 text-slate-400">
              <li><a href="#software" className="hover:text-white">Kirana & Supermarket POS</a></li>
              <li><a href="#software" className="hover:text-white">Restaurant Tables & Kitchen KOT</a></li>
              <li><a href="#software" className="hover:text-white">1-Tap Dynamic UPI QR</a></li>
              <li><a href="#software" className="hover:text-white">Customer Khata / Udhaar Ledger</a></li>
              <li><a href="#software" className="hover:text-white">18 Automated Tax Reports</a></li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div className="space-y-2.5">
            <b className="text-white text-xs uppercase tracking-wider block font-black">Legal & Compliance</b>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <button onClick={onOpenPrivacy} className="hover:text-white text-left flex items-center gap-1">
                  <Lock className="w-3 h-3 text-orange-400" />
                  <span>Privacy Policy (Play Store Compliant)</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenTerms} className="hover:text-white text-left flex items-center gap-1">
                  <FileText className="w-3 h-3 text-orange-400" />
                  <span>Terms of Service & Warranty</span>
                </button>
              </li>
              <li>
                <button onClick={onOpenAbout} className="hover:text-white text-left flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-orange-400" />
                  <span>Publisher & Contact Details</span>
                </button>
              </li>
              <li>
                <a href="#contact" className="hover:text-white">Grievance Officer: care@digitalfox.in</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} NovaPOS Technologies & Digital Fox Agency India. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Built with precision for Indian Retailers</span>
            <span>Target SDK 35 (Android 15) Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
