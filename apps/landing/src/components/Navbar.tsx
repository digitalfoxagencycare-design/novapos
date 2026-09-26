import React, { useState } from 'react';
import { Store, ShieldCheck, Phone, ArrowRight, Menu, X, Sparkles, Download } from 'lucide-react';

interface Props {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Navbar: React.FC<Props> = ({ onOpenPrivacy, onOpenTerms }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                NovaPOS <span className="text-xs bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold px-2 py-0.5 rounded-full uppercase">SaaS</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium block">Hardware Machines & Retail POS</span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#hardware" className="hover:text-white transition-colors">POS Machines</a>
            <a href="#software" className="hover:text-white transition-colors">Software Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing & Plans</a>
            <a href="#calculator" className="hover:text-white transition-colors">ROI Calculator</a>
            <a href="#download" className="hover:text-white transition-colors">Download App</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact / Support</a>
          </nav>

          {/* Desktop CTA Action */}
          <div className="hidden lg:flex items-center gap-3.5">
            <a
              href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20am%20interested%20in%20NovaPOS%20Machine%20and%20Software%20Demo"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 transition-all"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>+91 9381563241</span>
            </a>

            <a
              href="#pricing"
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Start 3-Day Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-b border-white/10 px-4 pt-3 pb-6 space-y-4">
          <div className="flex flex-col gap-3 text-sm font-semibold text-slate-200">
            <a href="#hardware" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">POS Hardware Machines</a>
            <a href="#software" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">Software & Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">Pricing & Bundles</a>
            <a href="#calculator" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">ROI Calculator</a>
            <a href="#download" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">Download Mobile App</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">Contact Sales</a>
          </div>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
            <a
              href="https://wa.me/919381563241"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl text-center text-xs font-bold text-slate-200 bg-white/5 border border-white/10 flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp: +91 9381563241</span>
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 rounded-xl text-center text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Start 3-Day Free Trial</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
