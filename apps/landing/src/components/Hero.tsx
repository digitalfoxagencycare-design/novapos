import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Smartphone,
  CreditCard,
  Zap,
  Star,
  Play,
} from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
      {/* Background Radial Glow */}
      <div className="glow-bg top-0 left-1/2 -translate-x-1/2 -translate-y-1/3"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Glowing Top Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-xs font-bold text-indigo-300 shadow-lg shadow-indigo-950/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>⚡ India's #1 All-In-One Touch POS Billing Machines & Cloud SaaS</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
            Fast Retail Billing Machines &{' '}
            <span className="text-gradient-purple">Smart POS Software</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Equip your Supermarket, Restaurant, Kirana, or Retail store with Android Touch POS Terminals, in-built high-speed thermal printers, 1-tap UPI QR, GST invoicing & live multi-counter cloud sync.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Start 3-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20a%20Touch%20POS%20Machine%20for%20my%20store"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm text-slate-200 glass-card hover:bg-white/10 flex items-center justify-center gap-2.5 transition-all"
            >
              <Printer className="w-5 h-5 text-indigo-400" />
              <span>Book POS Hardware Demo</span>
            </a>
          </div>

          {/* Social Proof Trust Badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-2">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <span className="text-slate-200 font-bold">4.9/5 Rating</span> (2,500+ Indian Retailers)
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Instant 1-Tap UPI (GPay, PhonePe, Paytm)</span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>1-Year Machine Replacement Warranty</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Terminal & Machine Showcase Visual */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <div className="glass-card rounded-3xl p-4 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Top Bar of POS Preview */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="ml-2 text-xs font-mono font-bold text-slate-400">NovaPOS Cloud Live Interface</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ESC/POS Bluetooth & USB Connected</span>
              </div>
            </div>

            {/* Grid Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left">
              {/* Box 1: Retail & Barcode Billing */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black">
                  01
                </div>
                <b className="text-base text-white block">Lightning 1-Tap Barcode Billing</b>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scan 50+ items/min with wireless 2D barcode scanner or camera. Generates itemized 58mm/80mm GST thermal slips in 0.2s.
                </p>
              </div>

              {/* Box 2: Restaurant Tables & KOT */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-black">
                  02
                </div>
                <b className="text-base text-white block">Restaurant KOT & Table Layouts</b>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live table occupancy management, kitchen order tickets (KOT), parcel takeaways, AC/Non-AC section splits, and split bills.
                </p>
              </div>

              {/* Box 3: Dual-Mode UPI QR & Razorpay */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
                  03
                </div>
                <b className="text-base text-white block">Dynamic Dynamic UPI QR Code</b>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Show dynamic transaction amount UPI QR code on customer display or bill slip. Automatic instant payment verification without transaction fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
