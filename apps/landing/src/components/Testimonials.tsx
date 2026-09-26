import React from 'react';
import { Star, Quote, Store, UtensilsCrossed, ShoppingCart } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: 'Ramesh Balaji',
      business: 'Sri Balaji Supermarket & Provisions, Hyderabad',
      type: 'Supermarket (2 Counters)',
      icon: <Store className="w-5 h-5 text-indigo-400" />,
      rating: 5,
      comment:
        'We shifted from bulky desktop systems to NovaPOS Handheld Smart POS. Counter billing speed tripled during peak hours, and customers love the dynamic UPI QR on the screen.',
    },
    {
      name: 'Mohammed Irfan',
      business: 'Hyderabad Biryani House & Cafe, Gachibowli',
      type: 'Restaurant & Takeaway (15 Tables)',
      icon: <UtensilsCrossed className="w-5 h-5 text-purple-400" />,
      rating: 5,
      comment:
        'The Table management and instant Bluetooth KOT kitchen printing saved us from ordering mixups. Offline billing ensures we never stop billing during WiFi drops.',
    },
    {
      name: 'Suresh Kumar',
      business: 'Karachi Bakery & Sweets Outlet, Vijayawada',
      type: 'Bakery & Confectionery',
      icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />,
      rating: 5,
      comment:
        'Very clean GST tax reports and DayBook. We bought 2 Touch POS machines with 58mm thermal printers. Pan-India delivery was fast and setup took under 5 minutes.',
    },
  ];

  return (
    <section className="py-20 md:py-32 relative bg-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <span>Customer Testimonials</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Trusted by Over <span className="text-gradient-purple">2,500+ Retail Stores</span> across India
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Here is what grocery store owners, restaurant managers, and retail merchants say about NovaPOS hardware and cloud software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((r, idx) => (
            <div
              key={idx}
              className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-400">
                    {[...Array(r.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "{r.comment}"
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  {r.icon}
                </div>
                <div>
                  <b className="text-xs font-bold text-white block">{r.name}</b>
                  <span className="text-[11px] text-slate-400 block">{r.business}</span>
                  <span className="text-[10px] text-indigo-400 font-medium">{r.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
