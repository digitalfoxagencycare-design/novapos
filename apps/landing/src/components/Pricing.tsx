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
} from 'lucide-react';

export const Pricing: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'software' | 'hardware'>('software');

  return (
    <section id="pricing" className="py-20 md:py-32 relative bg-slate-950/80 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <span>Transparent Pricing & Plans</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Simple, Affordable Plans for <span className="text-gradient-purple">Every Business Stage</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Start with our 3-Day Free Trial on your own Android phone, or upgrade to a complete Touch POS Hardware Machine with lifetime software.
          </p>

          {/* Tab Switcher */}
          <div className="inline-flex p-1.5 rounded-2xl bg-white/5 border border-white/10 mt-6">
            <button
              onClick={() => setBillingCycle('software')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                billingCycle === 'software'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Software SaaS Plans (Mobile App & Web)
            </button>
            <button
              onClick={() => setBillingCycle('hardware')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
                billingCycle === 'hardware'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hardware POS + Software Combos
            </button>
          </div>
        </div>

        {/* Software Plans View */}
        {billingCycle === 'software' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Plan 1: 3-Day Free Trial */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Trial Edition</span>
                <h3 className="text-2xl font-black text-white mt-1">3-Day Free Trial</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Full Pro Edition access on any Android mobile phone. No credit card required.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-white">₹0</span>
                  <span className="text-xs text-slate-400 ml-2 font-medium">for 3 Days</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>10 Pre-loaded Merchant Test Stores</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Unlimited Sales Invoices & Thermal Print</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Barcode Scanning with Mobile Camera</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>DayBook & GST Calculation Tools</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Instant SMS OTP Authentication</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="#download"
                  className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-white text-center block transition-all"
                >
                  Download App & Start Trial
                </a>
              </div>
            </div>

            {/* Plan 2: Pro Annual License (Most Popular) */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-500 shadow-2xl relative bg-indigo-950/40">
              <span className="absolute -top-3.5 right-6 bg-amber-400 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                Best Value · Save 17%
              </span>

              <div>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">Full Cloud License</span>
                <h3 className="text-2xl font-black text-white mt-1">Pro Annual License</h3>
                <p className="text-xs text-slate-300 mt-2">
                  Complete 365-day license for high volume stores with multi-counter cloud sync.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-indigo-300">₹4,999</span>
                  <span className="text-xs text-slate-400 ml-2 font-medium">/ year (₹416/mo)</span>
                </div>

                <div className="space-y-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span><b>365 Days Uninterrupted Live Billing</b></span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span><b>Multi-Terminal Real-Time Sync (5 Counters)</b></span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Automatic Daily Cloud Database Backup</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Complete GSTR-1 Automated Reports</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>WhatsApp Bill Receipts with UPI Pay Link</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Priority 24/7 Telephone & WhatsApp Support</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20activate%20the%20Pro%20Annual%20Plan%20(%E2%82%B94999)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 font-black text-xs text-white text-center flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Upgrade to Pro Annual (₹4,999)</span>
                </a>
              </div>
            </div>

            {/* Plan 3: Starter Monthly */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Monthly Plan</span>
                <h3 className="text-2xl font-black text-white mt-1">Starter Monthly</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Flexible month-to-month subscription for single counter retail & cafes.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-white">₹499</span>
                  <span className="text-xs text-slate-400 ml-2 font-medium">/ month</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>30 Days Full Access</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>1 POS Terminal Billing</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Unlimited Invoices & Thermal Printing</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>GST & Tax Calculations</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Customer Khata & Ledger Management</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20activate%20the%20Starter%20Monthly%20Plan%20(%E2%82%B9499)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-white text-center block transition-all"
                >
                  Get Starter Monthly (₹499)
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Hardware Combo Packs View */}
        {billingCycle === 'hardware' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
            {/* Combo 1: Handheld Smart POS Combo */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-500 bg-indigo-950/30">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">Complete Hardware + Software Combo</span>
                <h3 className="text-2xl font-black text-white mt-1">Handheld Smart POS Bundle</h3>
                <p className="text-xs text-slate-300 mt-2">
                  Android Touch POS Machine with In-Built Thermal Printer + Lifetime Software.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-emerald-400">₹11,999</span>
                  <span className="text-xs text-slate-400 line-through ml-2">₹14,999</span>
                  <span className="text-xs text-slate-400 block mt-1">One-Time Payment · 0 Monthly Rental</span>
                </div>

                <div className="space-y-3 text-xs text-slate-200">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>5.5" Touchscreen Handheld Smart POS Device</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>In-Built High Speed 58mm Thermal Printer</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>5000 mAh Rechargeable Battery (14+ hours)</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>4G SIM Slot + WiFi Connectivity</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>1-Year Machine Replacement Warranty</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Free 5 Thermal Paper Rolls + Pan-India Courier</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20the%20Handheld%20POS%20Bundle%20(%E2%82%B911999)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 font-black text-xs text-white text-center flex items-center justify-center gap-2 shadow-lg"
                >
                  <Phone className="w-4 h-4" />
                  <span>Order Handheld Bundle on WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Combo 2: Supermarket Desktop Dual-Screen Combo */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400">Flagship Counter Setup</span>
                <h3 className="text-2xl font-black text-white mt-1">Desktop Dual-Screen Supermarket Bundle</h3>
                <p className="text-xs text-slate-400 mt-2">
                  15.6" Touch Terminal + 10.1" Customer Display + 80mm Auto-Cut Printer + 2D Scanner.
                </p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-black text-emerald-400">₹18,999</span>
                  <span className="text-xs text-slate-400 line-through ml-2">₹24,999</span>
                  <span className="text-xs text-slate-400 block mt-1">Complete Counter Setup · 0 Monthly Rental</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>15.6" Full HD Operator Touch Terminal (4GB RAM)</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>10.1" Customer-Facing Dynamic UPI QR Screen</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>80mm High-Speed USB/LAN Thermal Auto-Cutter</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Hands-Free Desktop 2D Barcode & QR Scanner</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Heavy Duty Cash Drawer Connection Port (RJ11)</span></div>
                  <div className="flex items-center gap-2.5"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>1-Year Warranty with Onsite Remote Setup</span></div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a
                  href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20the%20Desktop%20Dual-Screen%20Bundle%20(%E2%82%B918999)"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-white text-center flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Order Desktop Terminal on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
