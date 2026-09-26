import React, { useState } from 'react';
import { Calculator, TrendingUp, Clock, IndianRupee, Sparkles } from 'lucide-react';

export const SavingsCalculator: React.FC = () => {
  const [billsPerDay, setBillsPerDay] = useState(80);
  const [avgBillValue, setAvgBillValue] = useState(350);

  // Calculations
  const monthlyRevenue = billsPerDay * avgBillValue * 30;
  const hoursSavedPerMonth = Math.round((billsPerDay * 2 * 30) / 60); // 2 minutes saved per bill vs manual
  const leakagesSavedPerMonth = Math.round(monthlyRevenue * 0.03); // 3% saved from billing errors & unpaid udhar

  return (
    <section id="calculator" className="py-20 md:py-32 relative bg-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <span>Interactive ROI Estimator</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Calculate Your Store's <span className="text-gradient-purple">Monthly Time & Money Savings</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            See how much faster billing, zero calculation errors, and automated UPI QR collection will save your business every single month.
          </p>
        </div>

        <div className="max-w-4xl mx-auto glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left Inputs */}
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                  <span>Average Invoices / Bills Per Day:</span>
                  <span className="text-indigo-400 text-base">{billsPerDay} Bills</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="10"
                  value={billsPerDay}
                  onChange={(e) => setBillsPerDay(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-white/10 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>20 Bills</span>
                  <span>250 Bills</span>
                  <span>500+ Bills</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                  <span>Average Bill Amount (₹):</span>
                  <span className="text-emerald-400 text-base">₹{avgBillValue}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="3000"
                  step="50"
                  value={avgBillValue}
                  onChange={(e) => setAvgBillValue(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-white/10 rounded-lg cursor-pointer h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>₹50</span>
                  <span>₹1,500</span>
                  <span>₹3,000+</span>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1 text-xs text-slate-300">
                <span className="text-indigo-300 font-bold block">Estimated Monthly Store Turnover:</span>
                <span className="text-2xl font-black text-white">₹{monthlyRevenue.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Right Results */}
            <div className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 p-6 sm:p-8 rounded-2xl border border-indigo-500/30 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold block">Estimated Value Generated</span>
                  <b className="text-xl text-white">Your Monthly Return</b>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-black/30 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Time Saved</span>
                  </div>
                  <span className="text-xl font-black text-indigo-300">{hoursSavedPerMonth} Hours</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Faster Counter Rush</span>
                </div>

                <div className="p-3.5 bg-black/30 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Leakage Prevented</span>
                  </div>
                  <span className="text-xl font-black text-emerald-300">₹{leakagesSavedPerMonth.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">0 Math & Stock Errors</span>
                </div>
              </div>

              <a
                href="#pricing"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 font-black text-xs text-white text-center flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Free Trial (Save ₹{leakagesSavedPerMonth.toLocaleString('en-IN')}/mo)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
