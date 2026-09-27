import React, { useState } from 'react';
import { Store, Phone, ArrowRight, Menu, X, Sparkles, ShoppingBag } from 'lucide-react';

interface Props {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export const Navbar: React.FC<Props> = ({ onOpenPrivacy, onOpenTerms }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Special Offer Ribbon */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white text-xs py-2 px-4 text-center font-bold tracking-wide flex items-center justify-center gap-2">
        <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
          Special Offer
        </span>
        <span>⚡ FLAT 45% OFF ON NOVAPOS SOFTWARE + SMART BILLING MACHINES | PAN-INDIA EXPRESS SHIPPING 🚚</span>
      </div>

      {/* Main White Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Brand Logo */}
            <a href="#" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                  NovaPOS <span className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase">Smart POS</span>
                </span>
                <span className="text-[11px] text-slate-500 font-semibold block">Hardware Billing Machines & Cloud Software</span>
              </div>
            </a>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-slate-700">
              <a href="#products" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                <ShoppingBag className="w-4 h-4 text-indigo-500" />
                <span>All Products</span>
              </a>
              <a href="#products" className="hover:text-indigo-600 transition-colors">POS Machines</a>
              <a href="#pricing" className="hover:text-indigo-600 transition-colors">Software Plans</a>
              <a href="#software" className="hover:text-indigo-600 transition-colors">Features</a>
              <a href="#calculator" className="hover:text-indigo-600 transition-colors">ROI Calculator</a>
              <a href="#download" className="hover:text-indigo-600 transition-colors">Download App</a>
              <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact / Support</a>
            </nav>

            {/* Desktop CTA Action */}
            <div className="hidden sm:flex items-center gap-3">
              <a
                href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20am%20interested%20in%20NovaPOS%20Machine%20and%20Software%20Demo"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-2 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>+91 9381563241</span>
              </a>

              <a
                href="#pricing"
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-4 shadow-xl">
            <div className="flex flex-col gap-2.5 text-sm font-bold text-slate-700">
              <a href="#products" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <span>All Products & Machines</span>
              </a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl">Pricing & Plans</a>
              <a href="#software" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl">Software Features</a>
              <a href="#calculator" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl">ROI Calculator</a>
              <a href="#download" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl">Download Mobile App</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="p-2.5 hover:bg-slate-50 rounded-xl">Contact Sales Desk</a>
            </div>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <a
                href="https://wa.me/919381563241"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl text-center text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp: +91 9381563241</span>
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 rounded-xl text-center text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Free Trial</span>
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
