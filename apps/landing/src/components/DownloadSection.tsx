import React from 'react';
import { Download, Smartphone, ShieldCheck, CheckCircle2, Play, Sparkles } from 'lucide-react';

export const DownloadSection: React.FC = () => {
  return (
    <section id="download" className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-lg max-w-5xl mx-auto relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left Content */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 uppercase">
                <span>Direct Android APK & Web POS</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
                Download NovaPOS Mobile App <br />
                <span className="text-gradient-purple">for Android Phones & POS Terminals</span>
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Turn your Android smartphone, tablet, or touch POS device into a high-speed billing counter in less than 60 seconds. Supports Bluetooth thermal slip printing and instant SMS login.
              </p>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Instant 7-Day Free Trial Activated on Install</span></div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>10 Pre-loaded Merchant Test Stores</span></div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Target SDK 35 (Android 15) Ready & Verified</span></div>
              </div>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="/novapos-latest.apk"
                  download="NovaPOS-Mobile-v4.5-Razorpay-Release.apk"
                  className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download APK (v4.5 · 5.18 MB)</span>
                </a>

                <a
                  href="https://play.google.com/store"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-all"
                >
                  <Play className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                  <span>Google Play Store</span>
                </a>
              </div>
            </div>

            {/* Right Card / Device Details */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <b className="text-slate-900">App Release Specifications</b>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                  v4.5 (Build 32)
                </span>
              </div>

              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between"><span>Package ID:</span><b className="text-slate-900 font-mono">com.novapos.terminal</b></div>
                <div className="flex justify-between"><span>Target API:</span><b className="text-emerald-700 font-bold">API Level 35 (Android 15)</b></div>
                <div className="flex justify-between"><span>Download Size:</span><b className="text-slate-900">5.18 MB (Ultra Fast)</b></div>
                <div className="flex justify-between"><span>Minimum OS:</span><b className="text-slate-900">Android 7.0 & Higher</b></div>
                <div className="flex justify-between"><span>Printers Supported:</span><b className="text-slate-900">58mm / 80mm ESC/POS (Bluetooth / USB)</b></div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-[11px] text-indigo-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>Web POS access also available on Chrome, Safari & Windows PC.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
