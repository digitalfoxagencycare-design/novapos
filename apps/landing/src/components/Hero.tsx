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
  Store,
} from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-8 pb-16 md:pt-12 md:pb-20 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Top Announcement Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-700 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>⚡ German Engineering Core · India's #1 Smart POS Cloud Software</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.12]">
              Fast Retail Billing Machines &{' '}
              <span className="text-gradient-orange">Smart POS Software</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
              Equip your Supermarket, Kirana, Restaurant, or Retail store with All-In-One Touch POS Terminals, in-built high-speed thermal printers, 1-tap UPI QR & 100% offline-first cloud billing.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <a
                href="#products"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                <ShoppingBag className="w-4 h-4 text-amber-200" />
                <span>Explore All Products & Combos</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20a%20Touch%20POS%20Machine%20for%20my%20store"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-orange-600" />
                <span>Order Machine on WhatsApp</span>
              </a>
            </div>

            {/* Social Proof Trust Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 sm:gap-8 text-xs font-semibold text-slate-600 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5">
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-slate-900 font-bold">4.9/5 Rating</span> (5,000+ Stores)
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>1-Tap Dynamic UPI QR</span>
              </div>

              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                <span>1-Year Machine Warranty</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Impact Merchant & Hardware Visual Banner */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Outer Decorative Gradient Glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl blur-lg opacity-25"></div>

              {/* Main Image Container */}
              <div className="relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
                <img
                  src="/assets/images/hero-merchant.jpg"
                  alt="Indian Supermarket Retail Merchant with NovaPOS Billing Machine"
                  className="w-full h-80 sm:h-96 object-cover object-center"
                />

                {/* Floating Overlay Badge 1: Top Right */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-2 text-xs font-bold text-slate-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>NovaPOS Handheld Live</span>
                </div>

                {/* Floating Overlay Badge 2: Bottom Bar */}
                <div className="absolute bottom-3 inset-x-3 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black text-xs">
                      58mm
                    </div>
                    <div>
                      <b className="text-xs block">Fast Receipt Printing</b>
                      <span className="text-[10px] text-slate-300">0.2s 1-Tap Thermal Print · 4G + WiFi</span>
                    </div>
                  </div>
                  <span className="bg-orange-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
