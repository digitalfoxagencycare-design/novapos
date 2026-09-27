import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { HardwareShowcase } from './components/HardwareShowcase';
import { SoftwareFeatures } from './components/SoftwareFeatures';
import { Pricing } from './components/Pricing';
import { SavingsCalculator } from './components/SavingsCalculator';
import { Testimonials } from './components/Testimonials';
import { DownloadSection } from './components/DownloadSection';
import { ContactForm } from './components/ContactForm';
import { Footer } from './components/Footer';
import { X, Lock, FileText, Building2, Scale } from 'lucide-react';

export function App() {
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms' | 'about' | null>(null);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col antialiased">
      <Navbar
        onOpenPrivacy={() => setLegalModalTab('privacy')}
        onOpenTerms={() => setLegalModalTab('terms')}
      />

      <main className="flex-1">
        <Hero />
        <HardwareShowcase />
        <SoftwareFeatures />
        <Pricing />
        <SavingsCalculator />
        <Testimonials />
        <DownloadSection />
        <ContactForm />
      </main>

      <Footer
        onOpenPrivacy={() => setLegalModalTab('privacy')}
        onOpenTerms={() => setLegalModalTab('terms')}
        onOpenAbout={() => setLegalModalTab('about')}
      />

      {/* In-Page Legal & Compliance Modal */}
      {legalModalTab && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLegalModalTab(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden text-slate-700 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">NovaPOS Legal & Regulatory Disclosures</h3>
                  <span className="text-[11px] text-slate-500">novasaas.net / novapos.in · Compliant with Google Play Data Safety</span>
                </div>
              </div>
              <button
                onClick={() => setLegalModalTab(null)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 pt-2 gap-2">
              <button
                onClick={() => setLegalModalTab('privacy')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  legalModalTab === 'privacy'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Privacy Policy</span>
              </button>

              <button
                onClick={() => setLegalModalTab('terms')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  legalModalTab === 'terms'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Terms of Service</span>
              </button>

              <button
                onClick={() => setLegalModalTab('about')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  legalModalTab === 'about'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Publisher & Grievance</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
              {legalModalTab === 'privacy' && (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                    <b>Google Play Store Data Safety & Privacy Policy</b><br />
                    NovaPOS does not sell, rent, or commercialize merchant transaction records or customer telephone numbers.
                  </div>
                  <p>
                    <b>1. Collected Information:</b> We collect merchant store name, mobile number for SMS OTP verification, GSTIN, and billing records for cloud backup and invoice generation.
                  </p>
                  <p>
                    <b>2. Device Hardware Permissions:</b> Bluetooth / USB access is requested solely to discover and send ESC/POS print commands to thermal receipt printers.
                  </p>
                  <p>
                    <b>3. Data Retention & Erasure:</b> Store owners can request complete deletion of their account and database backups by emailing <a href="mailto:privacy@novapos.in" className="text-indigo-600 underline font-bold">privacy@novapos.in</a>.
                  </p>
                </div>
              )}

              {legalModalTab === 'terms' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                    <b>Terms of Service & Hardware Sale Agreement</b>
                  </div>
                  <p>
                    <b>1. SaaS Subscription:</b> Every new store registration receives a 7-Day Free Trial with complete Pro features. Continued service requires 1-Year Pro Software (₹2,999/yr).
                  </p>
                  <p>
                    <b>2. Hardware Warranty:</b> All NovaPOS Handheld and Desktop POS machines include a 1-year replacement warranty covering manufacturing defects.
                  </p>
                  <p>
                    <b>3. Statutory Compliance:</b> The merchant is responsible for accurate tax slab assignments and statutory GST return filing.
                  </p>
                </div>
              )}

              {legalModalTab === 'about' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-slate-500 text-[10px] uppercase font-bold block">Brand Name:</span><b className="text-slate-900">NovaPOS & NovaSaaS</b></div>
                      <div><span className="text-slate-500 text-[10px] uppercase font-bold block">Official Domain:</span><b className="text-indigo-600 font-mono">novasaas.net</b></div>
                      <div><span className="text-slate-500 text-[10px] uppercase font-bold block">Publisher Entity:</span><b className="text-slate-900">Digital Fox Agency & NovaPOS Technologies India</b></div>
                      <div><span className="text-slate-500 text-[10px] uppercase font-bold block">Target Android API:</span><b className="text-emerald-700 font-bold">API Level 35 (Android 15)</b></div>
                    </div>
                  </div>
                  <p>
                    <b>Customer Support & Grievance Desk:</b><br />
                    • Phone / WhatsApp: +91 9381563241 / +91 9701463241<br />
                    • Email: support@novapos.in / care@digitalfox.in<br />
                    • Operational Office: Hyderabad / India
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setLegalModalTab(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
