import React from 'react';
import { Download, Smartphone, ShieldCheck, CheckCircle2, Play, Sparkles, Monitor } from 'lucide-react';

export const DownloadSection: React.FC = () => {
  return (
    <section id="download" className="py-20 md:py-32 relative bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 sm:p-14 border border-indigo-500/30 max-w-5xl mx-auto relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 uppercase">
                <span>Direct Android APK & Web POS</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Download NovaPOS Mobile App <br />
                <span className="text-gradient-purple">for Android Phones & Tablets</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Turn your Android smartphone or tablet into a fully functional retail billing counter in less than 60 seconds. Supports Bluetooth thermal slip printing and native SMS authentication.
              </p>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Instant 3-Day Free Trial Activated on Install</span></div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>10 Pre-loaded Merchant Test Accounts</span></div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span>Target SDK 35 (Android 15) Ready & Play Store Verified</span></div>
              </div>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="/NovaPOS-Mobile-v4.4-Target35-Release.apk"
                  download="NovaPOS-Mobile-v4.4-Target35-Release.apk"
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download APK (v4.4 · 4.79 MB)</span>
                </a>

                <a
                  href="https://play.google.com/store"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3.5 rounded-xl glass-panel hover:bg-white/10 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all"
                >
                  <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
                  <span>Google Play Store</span>
                </a>
              </div>
            </div>

            {/* Right Card / Device Details */}
            <div className="p-6 bg-slate-900/80 rounded-2xl border border-white/10 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <b className="text-white">App Release Specifications</b>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                  v4.4 (Build 31)
                </span>
              </div>

              <div className="space-y-2 text-slate-400">
                <div className="flex justify-between"><span>Package ID:</span><b className="text-slate-200 font-mono">com.novapos.terminal</b></div>
                <div className="flex justify-between"><span>Target API:</span><b className="text-emerald-400 font-bold">API Level 35 (Android 15)</b></div>
                <div className="flex justify-between"><span>Download Size:</span><b className="text-slate-200">4.79 MB (Ultra Lightweight)</b></div>
                <div className="flex justify-between"><span>Minimum OS:</span><b className="text-slate-200">Android 7.0 (Nougat) & Higher</b></div>
                <div className="flex justify-between"><span>Payment Engine:</span><b className="text-slate-200">Razorpay Live + Dual UPI Fast Pay</b></div>
                <div className="flex justify-between"><span>Printers:</span><b className="text-slate-200">58mm / 80mm ESC/POS (Bluetooth / USB)</b></div>
              </div>

              <div className="p-3 bg-indigo-950/60 rounded-xl border border-indigo-500/30 text-[11px] text-indigo-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>Web POS access also supported on Chrome, Safari & Windows.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
