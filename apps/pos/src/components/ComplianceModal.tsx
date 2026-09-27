import React, { useState } from 'react';
import { X, Shield, FileText, Building2, ExternalLink, CheckCircle2, Lock, Scale, AlertTriangle } from 'lucide-react';
import { useBackHandler } from '../lib/navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms' | 'about';
}

export const ComplianceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'about'>(defaultTab);

  useBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <Scale className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide text-white">Legal, Privacy & Compliance</h2>
              <p className="text-[11px] text-slate-400">Google Play Store & Indian Regulatory Standards</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Terms of Service</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>App & Publisher</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-900">
                <b className="text-xs font-bold block mb-1">Google Play Data Safety & Privacy Policy</b>
                NovaPOS Pro is committed to protecting merchant business data and customer transaction privacy.
                Last updated: September 2026.
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">1. Information We Collect</h3>
                <p>
                  • <b>Merchant Account Data:</b> Mobile number (for OTP authentication), Store Name, Address, GSTIN, FSSAI number, and UPI ID for invoicing.<br />
                  • <b>Billing & Inventory Data:</b> Product catalogs, prices, sales invoices, customer khata ledger entries, and daily sales summaries.<br />
                  • <b>Hardware Device Permissions:</b> Bluetooth / USB connectivity permissions solely for discovering and printing to ESC/POS thermal printers.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">2. How Data is Used & Secured</h3>
                <p>
                  • We do not sell or rent merchant or customer data to third-party advertising networks.<br />
                  • All transaction records are encrypted during transit (HTTPS / TLS 1.3) and stored in secure cloud datastores with local offline cache support.<br />
                  • Payment transactions via Razorpay / UPI are tokenized and processed through RBI-authorized payment aggregators.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">3. Data Retention & Account Deletion</h3>
                <p>
                  Merchants retain 100% ownership of their ledger and sales history. To request full deletion of store records and cloud backups, contact our grievance desk at <a href="mailto:privacy@novapos.in" className="text-indigo-600 font-bold underline">privacy@novapos.in</a>. Requests are completed within 7 business days.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-amber-900">
                <b className="text-xs font-bold block mb-1">Terms of Service & SaaS Licensing Agreement</b>
                By downloading, installing, or using NovaPOS Pro, you agree to the following terms and conditions.
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">1. SaaS Subscription & Service Activation</h3>
                <p>
                  • Registered merchants receive access to POS billing, barcode scanning, thermal printing, and reporting upon account activation.<br />
                  • Merchants may subscribe to either the Starter Monthly (₹499/mo) or Pro Annual (₹4,999/yr) plan to maintain continuous live billing, multi-counter synchronization, and cloud backup.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">2. Tax & Legal Compliance (GST / FSSAI)</h3>
                <p>
                  • NovaPOS provides standard GST calculation tools and GSTR-1 format reporting. The merchant is solely responsible for ensuring accurate tax slab assignment, filing statutory returns, and maintaining valid business licenses.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">3. Refund & Cancellation Policy</h3>
                <p>
                  Subscription fees paid via Razorpay or direct UPI are non-refundable once activated. In the event of duplicate billing or gateway errors, refunds are issued back to original payment source within 5–7 bank working days.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">App Name</span>
                    <b className="text-slate-800">NovaPOS Pro</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Package ID</span>
                    <b className="text-slate-800 font-mono">com.novapos.terminal</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Android Version</span>
                    <b className="text-emerald-700 font-bold">API Level 35 (Android 15)</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Version Code / Name</span>
                    <b className="text-slate-800">v4.4 (Build 31)</b>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">Developer & Publisher</h3>
                <p className="space-y-1">
                  <b>Digital Fox Agency & NovaPOS Technologies India</b><br />
                  Registered Entity for Software Publishing & POS Solutions<br />
                  Compliant with Consumer Protection (E-Commerce) Rules, 2020.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">Grievance & Customer Support Desk</h3>
                <p>
                  • <b>Helpline:</b> +91 9701463241 / +91 9381563241<br />
                  • <b>Support Email:</b> <a href="mailto:support@novapos.in" className="text-indigo-600 font-bold underline">support@novapos.in</a><br />
                  • <b>Operating Hours:</b> Mon – Sat, 9:00 AM – 8:00 PM IST
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
