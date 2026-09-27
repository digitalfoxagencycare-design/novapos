import React, { useState } from 'react';
import {
  Smartphone,
  Printer,
  Check,
  ShieldCheck,
  Star,
  Zap,
  Phone,
  Sparkles,
  ShoppingBag,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const HardwareShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'combos' | 'machines' | 'software'>('all');

  const products = [
    {
      id: 'bada-machine-software',
      category: 'combos',
      name: 'NovaPOS Bada Billing Machine with 1-Year Software',
      badge: 'SALE',
      offerTag: 'BEST VALUE COMBO · SAVE 35%',
      price: '₹6,499.00',
      originalPrice: '₹9,999.00',
      discount: '35% OFF',
      rating: '5.0',
      reviewsCount: 148,
      desc: 'Complete all-in-one smart touchscreen billing terminal with in-built 58mm high-speed thermal receipt printer + 1-Year full Pro Cloud SaaS software license.',
      image: '/assets/images/bada-machine.jpg',
      specs: [
        'Android Smart Touchscreen POS Terminal',
        'In-built 58mm High-Speed Thermal Receipt Printer',
        '1-Year Full Pro SaaS Software License Included',
        '4G LTE SIM Slot + Dual-Band WiFi Connectivity',
        '5000 mAh Heavy Duty All-Day Battery (14+ Hours)',
        '1-Year Replacement Warranty & Pan-India Free Delivery',
      ],
      idealFor: 'Supermarkets, Kirana, Restaurants, Bakeries & Retail Stores',
    },
    {
      id: 'smart-pos-machine',
      category: 'machines',
      name: 'NovaPOS Smart Touch POS Hardware Machine (Standalone)',
      badge: 'SALE',
      offerTag: 'COMMERCIAL GRADE HARDWARE',
      price: '₹2,999.00',
      originalPrice: '₹3,999.00',
      discount: '25% OFF',
      rating: '4.9',
      reviewsCount: 95,
      desc: 'Heavy-duty handheld Android touch billing machine with integrated 58mm thermal receipt printer. Works with NovaPOS or any Android billing app.',
      image: '/assets/images/handheld-pos.jpg',
      specs: [
        '5.5" IPS High-Sensitivity Capacitive Touchscreen',
        'In-built 58mm ESC/POS Thermal Printer (70mm/s)',
        'Heavy Duty 5000 mAh Rechargeable Lithium Battery',
        'Rear Barcode Scanner Camera with Auto-Focus LED',
        'Bluetooth 4.2 + High Speed USB Support',
        '1-Year Hardware Replacement Warranty',
      ],
      idealFor: 'Food Delivery, Cash Counters, Mobile Van Billing, Express Outlets',
    },
    {
      id: 'software-1year-sub',
      category: 'software',
      name: 'NovaPOS 1-Year Cloud SaaS Software Subscription (Recharge)',
      badge: 'SALE',
      offerTag: 'SPECIAL 45% OFF DISCOUNT',
      price: '₹2,999.00',
      originalPrice: '₹5,499.00',
      discount: '45% OFF',
      rating: '5.0',
      reviewsCount: 210,
      desc: 'Complete 365-day license for your Android mobile, tablet, or PC. Unlimited billing, thermal printing, multi-counter sync, and automated GSTR-1 reports.',
      image: null,
      icon: (
        <div className="w-full h-48 bg-gradient-to-tr from-purple-50 via-indigo-50 to-emerald-50 rounded-xl flex items-center justify-center relative p-4 border border-purple-100">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-8 h-8 text-amber-300" />
            </div>
            <span className="text-xs font-black text-indigo-900 bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-xs">
              365 Days Pro License
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">Multi-Counter Cloud Sync</span>
          </div>
          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            45% OFF
          </span>
        </div>
      ),
      specs: [
        '365 Days Uninterrupted Billing & Live Sync',
        '100% Offline-First SQLite Database Engine',
        'Multi-Terminal Real-Time Sync (up to 5 counters)',
        '18 Comprehensive Reports & Automated GSTR-1',
        'Dynamic UPI QR Payment Verification',
        'Customer Khata / Udhaar & Supplier Ledger',
      ],
      idealFor: 'All Android Phones, Tablets, Touch POS Terminals & Web Desktops',
    },
    {
      id: 'bluetooth-printer',
      category: 'machines',
      name: 'NovaPOS 58mm / 80mm Wireless Bluetooth Thermal Printer',
      badge: 'SALE',
      offerTag: 'DIRECT PRINTING ACCESSORY',
      price: '₹1,999.00',
      originalPrice: '₹2,999.00',
      discount: '33% OFF',
      rating: '4.8',
      reviewsCount: 82,
      desc: 'Wireless Bluetooth & USB thermal receipt printer. 1-Tap instant printing from NovaPOS mobile app or computer without ink or ribbon.',
      image: null,
      icon: (
        <div className="w-full h-48 bg-gradient-to-tr from-amber-50 via-slate-50 to-indigo-50 rounded-xl flex items-center justify-center relative p-4 border border-amber-100">
          <div className="w-32 h-28 bg-slate-900 rounded-xl border-2 border-slate-700 shadow-md p-2.5 flex flex-col justify-between">
            <div className="w-full h-4 bg-slate-800 rounded border-b border-slate-600 flex items-center justify-center">
              <div className="w-14 h-1 bg-white/40 rounded-full"></div>
            </div>
            <div className="text-center text-[9px] text-emerald-400 font-mono font-bold">
              ESC/POS BT 58MM
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[7.5px] text-slate-400 font-mono font-bold">READY</span>
            </div>
          </div>
          <span className="absolute top-2 left-2 bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            Universal
          </span>
        </div>
      ),
      specs: [
        'High-Speed Thermal ESC/POS Print (90mm/s)',
        'Bluetooth 4.2 + USB Direct Connectivity',
        '2000 mAh Rechargeable Lithium Battery',
        'Compatible with Android Phones, Tablets & Windows PC',
        'Uses standard 58mm paper rolls (No ink/cartridge needed)',
        '1-Year Warranty & Free 2 Paper Rolls Included',
      ],
      idealFor: 'Kirana Shops, Small Cafes, Khata Receipts, Express Mobile Billing',
    },
  ];

  const filteredProducts = products.filter((p) => {
    if (activeTab === 'all') return true;
    return p.category === activeTab;
  });

  return (
    <section id="products" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            All Products & POS Machines
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Explore commercial-grade billing machines, software subscriptions, and hardware combos with transparent pricing.
          </p>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
            {[
              { id: 'all', label: 'All Products' },
              { id: 'combos', label: 'Machine + Software Combos' },
              { id: 'machines', label: 'Hardware Machines & Printers' },
              { id: 'software', label: 'Software Subscriptions (45% OFF)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="product-store-card p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-500 shadow-sm hover:shadow-xl transition-all"
            >
              <div>
                {/* Visual Graphic: Real Photo or Clean Vector Card */}
                {p.image ? (
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 relative group">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                      {p.badge}
                    </span>
                  </div>
                ) : (
                  p.icon
                )}

                {/* Offer Tag */}
                <div className="mt-4 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                    {p.offerTag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 leading-snug min-h-[44px]">
                  {p.name}
                </h3>

                {/* Star Rating */}
                <div className="flex items-center gap-1.5 my-2">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700">({p.reviewsCount})</span>
                </div>

                {/* Pricing Block */}
                <div className="flex items-baseline gap-2 my-3">
                  <span className="text-2xl font-black text-slate-900">{p.price}</span>
                  <span className="text-xs text-slate-400 line-through font-medium">{p.originalPrice}</span>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {p.discount}
                  </span>
                </div>

                {/* Specs List */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3 my-3">
                  {p.specs.slice(0, 4).map((spec, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{spec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <a
                  href={`https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20the%20${encodeURIComponent(
                    p.name
                  )}%20for%20${encodeURIComponent(p.price)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Order on WhatsApp</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 1 Year Pan-India Warranty Banner */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <b className="text-sm font-bold text-slate-900 block">1-Year Pan-India Replacement Warranty & Free Remote Setup</b>
              <p className="text-xs text-slate-600">
                100% Genuine commercial hardware with doorstep delivery and dedicated WhatsApp video technical support.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20inquire%20about%20hardware%20warranty%20and%20orders"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 border border-slate-300 transition-colors flex items-center gap-2 flex-shrink-0 shadow-xs"
          >
            <span>WhatsApp Orders: +91 9381563241</span>
          </a>
        </div>
      </div>
    </section>
  );
};
