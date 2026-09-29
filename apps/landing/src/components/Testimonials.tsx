import React from 'react';
import { Star, Store, MapPin, Quote } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: 'Venkatesh Rao',
      store: 'Sri Balaji Supermarket & Provisions',
      city: 'Hyderabad, Telangana',
      rating: 5,
      review: 'NovaPOS handheld billing machine is extremely fast! Our cashiers print GST receipts in 1-tap with Bluetooth printer and the dynamic UPI QR code stopped all QR fraud.',
      tag: 'Supermarket Owner',
    },
    {
      name: 'Rajesh Patel',
      store: 'Swagat Restaurant & Sweets',
      city: 'Ahmedabad, Gujarat',
      rating: 5,
      review: 'Table management and KOT printing to our kitchen works seamlessly even when the internet drops. The 1-Year software combo for ₹6,499 with machine is unmatched value.',
      tag: 'Restaurant Owner',
    },
    {
      name: 'Anand Sharma',
      store: 'Sharma Kirana & General Store',
      city: 'Jaipur, Rajasthan',
      rating: 5,
      review: 'Customer Khata and Udhaar reminder on WhatsApp helped us recover pending payments worth ₹45,000 in the first month itself. Very easy to use.',
      tag: 'Kirana Store',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span>Verified Customer Reviews</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Trusted by 5,000+ Retailers Across India
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            See how grocery stores, restaurants, bakeries, and retail counters are scaling their operations with NovaPOS machines.
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reviews.map((r, idx) => (
            <div
              key={idx}
              className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex text-amber-400">
                  {[...Array(r.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                  "{r.review}"
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between">
                <div>
                  <b className="text-xs font-bold text-slate-900 block">{r.name}</b>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Store className="w-3 h-3 text-orange-600" />
                    <span>{r.store}</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  {r.city.split(',')[0]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
