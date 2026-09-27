import React, { useState } from 'react';
import { Calculator, TrendingUp, Sparkles, Clock, CheckCircle2 } from 'lucide-react';

export const SavingsCalculator: React.FC = () => {
  const [dailyBills, setDailyBills] = useState<number>(120);
  const [counters, setCounters] = useState<number>(1);

  // Assumptions for retail stores in India:
  // - 15 seconds saved per bill with fast barcode + UPI QR (vs manual paper billing)
  // - ₹1.5 saved per bill on thermal paper / billing mistakes
  // - Estimated monthly revenue leak prevention: ~₹4,500 per counter
  const monthlyBills = dailyBills * 30 * counters;
  const hoursSavedPerMonth = ((dailyBills * 15 * 30 * counters) / 3600).toFixed(0);
  const monthlyRupeesSaved = (dailyBills * 30 * counters * 1.5 + counters * 4500).toFixed(0);

  return (
    <section id="calculator" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left Controls */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 uppercase">
                <Calculator className="w-3.5 h-3.5" />
                <span>Store ROI & Efficiency Calculator</span>
              </div>

              <h2 className="text-3xl font-black text-slate-900 leading-tight">
                Calculate Your Time & Money <br />
                <span className="text-gradient-purple">Saved with NovaPOS</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                See how much time cashier staff save on every bill, and eliminate billing mistakes, shrinkage, and missed udhaar payments.
              </p>

              {/* Sliders */}
              <div className="space-y-5 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Average Daily Customer Bills:</span>
                    <span className="text-indigo-600 font-mono font-black text-sm">{dailyBills} Bills / Day</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    step="10"
                    value={dailyBills}
                    onChange={(e) => setDailyBills(Number(e.target.value))}
                    className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-1.5">
                    <span>Number of Billing Counters:</span>
                    <span className="text-indigo-600 font-mono font-black text-sm">{counters} Counter{counters > 1 ? 's' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={counters}
                    onChange={(e) => setCounters(Number(e.target.value))}
                    className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Right Output Box */}
            <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 sm:p-8 rounded-2xl border border-indigo-200 space-y-5 text-center">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">
                Estimated Monthly Savings
              </span>

              <div className="space-y-1">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  ₹{Number(monthlyRupeesSaved).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-500 block">per month in staff time & mistake prevention</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-indigo-100">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center justify-center text-indigo-600 mb-1">
                    <Clock className="w-4 h-4" />
                  </div>
                  <b className="text-lg font-black text-slate-900 block">{hoursSavedPerMonth} Hours</b>
                  <span className="text-[10.5px] text-slate-500">Saved by cashiers / mo</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center justify-center text-emerald-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <b className="text-lg font-black text-emerald-600 block">{monthlyBills.toLocaleString('en-IN')}</b>
                  <span className="text-[10.5px] text-slate-500">Fast Invoices Processed</span>
                </div>
              </div>

              <a
                href="#pricing"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Saving with Free Trial</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
