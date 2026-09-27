import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Smartphone,
  Star,
  Zap,
  ShoppingBag,
  QrCode,
  Layers,
} from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-12 pb-16 md:pt-16 md:pb-24 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Top Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>⚡ India's #1 Smart POS Billing Machines & Cloud Software</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
            Fast Retail Billing Machines &{' '}
            <span className="text-gradient-purple">Smart POS Software</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Equip your Supermarket, Kirana, Restaurant, or Retail store with All-In-One Touch POS Terminals, in-built high-speed thermal printers, 1-tap UPI QR, GST invoicing & 100% offline-first billing.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="#products"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <ShoppingBag className="w-5 h-5 text-amber-300" />
              <span>Explore All Products & Combos</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20a%20Touch%20POS%20Machine%20for%20my%20store"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2.5 shadow-sm transition-all"
            >
              <Printer className="w-5 h-5 text-indigo-600" />
              <span>Order Machine on WhatsApp</span>
            </a>
          </div>

          {/* Social Proof Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-600 border-t border-slate-200/60 mt-8">
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-slate-900 font-bold">4.9/5 Rating</span> (5,000+ Stores)
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Instant 1-Tap UPI (GPay, PhonePe, Paytm)</span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>1-Year Machine Replacement Warranty</span>
            </div>
          </div>
        </div>

        {/* Hero Machine & POS UI Presentation Card (Light, Crisp & High Contrast) */}
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl relative overflow-hidden">
            {/* Top Bar of POS Preview */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                <span className="ml-2 text-xs font-bold text-slate-700">NovaPOS Smart Retail Ecosystem</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ESC/POS Bluetooth & Thermal Connected</span>
              </div>
            </div>

            {/* Visual Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Box 1 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm">
                  01
                </div>
                <b className="text-sm text-slate-900 block font-bold">1-Tap Fast Barcode Billing</b>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scan 50+ items/min with wireless 2D barcode scanner or camera. Generates itemized 58mm/80mm GST thermal slips in 0.2s.
                </p>
              </div>

              {/* Box 2 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-sm">
                  02
                </div>
                <b className="text-sm text-slate-900 block font-bold">Restaurant KOT & Table Layouts</b>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Live table occupancy management, kitchen order tickets (KOT), parcel takeaways, section splits, and Captain mobile ordering.
                </p>
              </div>

              {/* Box 3 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-sm">
                  03
                </div>
                <b className="text-sm text-slate-900 block font-bold">Dynamic UPI QR & Khata</b>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Show dynamic transaction amount UPI QR code on customer display or bill slip. Automatic instant payment verification & customer ledger.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
