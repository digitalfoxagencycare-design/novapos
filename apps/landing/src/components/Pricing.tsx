import React, { useState } from 'react';
import {
  Check,
  Sparkles,
  ShieldCheck,
  Phone,
  ArrowRight,
  Zap,
  Printer,
  CreditCard,
  Star,
} from 'lucide-react';

export const Pricing: React.FC = () => {
  const [pricingTab, setPricingTab] = useState<'all' | 'software' | 'combos'>('all');

  return (
    <section id="pricing" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 uppercase tracking-wider">
            <span>Transparent Pricing & Plans</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Affordable Plans for <span className="text-gradient-purple">Every Retail Outlet</span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Get started with a 7-Day Free Trial on your own mobile, or choose our complete POS billing machine bundle with lifetime hardware ownership.
          </p>

          {/* Switcher Buttons */}
          <div className="inline-flex p-1 rounded-xl bg-white border border-slate-200 mt-4 shadow-xs">
            <button
              onClick={() => setPricingTab('all')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Packages
            </button>
            <button
              onClick={() => setPricingTab('software')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingTab === 'software'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Software Plans (45% OFF)
            </button>
            <button
              onClick={() => setPricingTab('combos')}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingTab === 'combos'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Machine + Software Combos
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Plan 1: 7-Day Free Trial */}
          {(pricingTab === 'all' || pricingTab === 'software') && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Free Trial</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">7-Day Free Trial</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Full Pro access on your Android phone, tablet, or web browser. No payment required.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-slate-900">₹0</span>
                  <span className="text-xs text-slate-500 ml-2 font-semibold">for 7 Days</span>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>10 Pre-loaded Merchant Test Accounts</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Unlimited Sales Invoices & Thermal Slip Print</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>1-Tap Dynamic UPI QR Generation</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Barcode Scanning via Mobile Camera</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Instant SMS OTP Sign In</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <a
                  href="#download"
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-800 text-center block transition-all"
                >
                  Download App & Start Trial
                </a>
              </div>
            </div>
          )}

          {/* Plan 2: 1-Year Pro Software SaaS License (Featured) */}
          {(pricingTab === 'all' || pricingTab === 'software') && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-600 shadow-xl relative">
              <span className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                45% OFF · POPULAR CHOICE
              </span>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Full Cloud Software</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">1-Year Pro Software</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Complete 365-day license for high volume stores with live multi-counter sync.
                </p>

                <div className="mt-6 mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-indigo-600">₹2,999</span>
                    <span className="text-xs text-slate-400 line-through">₹5,499</span>
                    <span className="text-xs text-slate-500 font-semibold">/ year</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-1">Special Discount: Flat 45% OFF</span>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span><b>365 Days Uninterrupted Billing</b></span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span><b>Multi-Terminal Real-Time Sync (5 Counters)</b></span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Automatic Daily Cloud Database Backup</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Complete GSTR-1 Automated Export</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>WhatsApp Bill Receipts with UPI Pay Link</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Priority 24/7 Telephone & WhatsApp Support</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20activate%20the%201-Year%20Software%20Plan%20(%E2%82%B92999)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs text-white text-center flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Activate 1-Year License (₹2,999)</span>
                </a>
              </div>
            </div>
          )}

          {/* Plan 3: Bada Billing Machine + 1-Year Software Combo */}
          {(pricingTab === 'all' || pricingTab === 'combos') && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hardware + Software Combo</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">Bada Machine + 1-Year Software</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Touch POS Machine with in-built 58mm Thermal Printer + 1-Year Pro Software License.
                </p>

                <div className="mt-6 mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">₹6,499</span>
                    <span className="text-xs text-slate-400 line-through">₹9,999</span>
                  </div>
                  <span className="text-xs text-slate-500 block mt-1">Complete Bundle · 0 Monthly Rental</span>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Android Smart Touch POS Billing Terminal</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>In-Built High Speed 58mm Thermal Printer</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>1-Year Full Pro SaaS Software License</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>5000 mAh Rechargeable Battery (14+ hours)</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>1-Year Machine Replacement Warranty</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /><span>Free Thermal Rolls + Free Pan-India Courier</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20the%20Bada%20Machine%20+%20Software%20Combo%20(%E2%82%B96499)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 font-bold text-xs text-white text-center flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Order Combo on WhatsApp (₹6,499)</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
