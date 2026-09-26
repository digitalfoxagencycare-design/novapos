import React from 'react';
import {
  Receipt,
  UtensilsCrossed,
  Layers,
  BarChart3,
  WifiOff,
  Cloud,
  QrCode,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const SoftwareFeatures: React.FC = () => {
  const features = [
    {
      icon: <Receipt className="w-6 h-6 text-indigo-400" />,
      title: 'Full GST & Non-GST Retail Invoicing',
      desc: 'Automatic CGST/SGST tax calculation, composition vs regular schemes, backward MRP-inclusive tax split, itemized thermal print slips, and GSTR-1 JSON export.',
    },
    {
      icon: <UtensilsCrossed className="w-6 h-6 text-purple-400" />,
      title: 'Restaurant Tables, KOT & Kitchen Display',
      desc: 'Manage dine-in tables, parcel takeaways, split billing, Captain ordering, and instantaneous thermal KOT print in the kitchen with item notes and modifiers.',
    },
    {
      icon: <WifiOff className="w-6 h-6 text-emerald-400" />,
      title: '100% Offline-First Architecture',
      desc: 'Never stop billing even when internet or WiFi goes down. Local high-speed SQLite and IndexedDB database stores all items and sales, syncing automatically upon reconnecting.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-cyan-400" />,
      title: '1-Tap Dynamic UPI QR & Cards',
      desc: 'Generate real-time UPI QR codes with exact bill amount embedded. Direct deep-link integration with Google Pay, PhonePe, Paytm, BHIM, and Razorpay Gateway.',
    },
    {
      icon: <Users className="w-6 h-6 text-amber-400" />,
      title: 'Customer Khata / Udhar & Supplier Ledger',
      desc: 'Track customer credit balances (Jama / Udhaar), send automatic WhatsApp payment reminders with UPI pay links, and maintain supplier purchase ledgers.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-rose-400" />,
      title: '18 Comprehensive Business Reports',
      desc: 'Daily DayBook, Item-wise sales, Fast/Slow moving stock, Category profit margins, Hourly peak sales analytics, and Cash-drawer balancing.',
    },
    {
      icon: <Cloud className="w-6 h-6 text-blue-400" />,
      title: 'Multi-Terminal & Multi-Counter Sync',
      desc: 'Run 10+ billing counters simultaneously in a single store. Sales, inventory deduction, and price changes sync in real-time across all terminals.',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-yellow-400" />,
      title: '3-Day Free Trial with 10 Merchant Demos',
      desc: 'Instant access without credit card required. Preloaded with sample catalogs for Kirana, Supermarket, Restaurant, Bakery, Garments, and Footwear.',
    },
  ];

  return (
    <section id="software" className="py-20 md:py-32 relative bg-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-400 uppercase tracking-wider">
            <span>SaaS POS Software Suite</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Designed specifically for <span className="text-gradient-purple">Indian Merchants & Retailers</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            From single-counter small shops to 5-counter high volume supermarkets — NovaPOS handles all your inventory, GST billing, thermal printing, and UPI collection in one unified system.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl p-6 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  {f.icon}
                </div>
                <b className="text-base text-white block font-bold leading-snug">
                  {f.title}
                </b>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
