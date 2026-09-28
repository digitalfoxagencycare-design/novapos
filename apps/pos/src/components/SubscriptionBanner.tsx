import { useBackHandler } from '../lib/navigation';
import React, { useState } from 'react';
import { useSubscriptionDetails } from '../lib/subscription';
import { Clock, CheckCircle2, AlertTriangle, Phone, MessageSquare, ShieldCheck, X, Sparkles } from 'lucide-react';

interface Props {
  storeName?: string;
  phone?: string;
}

export const SubscriptionBanner: React.FC<Props> = ({ storeName = 'My Store', phone = '' }) => {
  const details = useSubscriptionDetails();
  const [modalOpen, setModalOpen] = useState(false);
  useBackHandler(modalOpen, () => setModalOpen(false));

  const supportNumber = '9381563241';
  const whatsappUrl = `https://wa.me/91${supportNumber}?text=${encodeURIComponent(
    `Hi NovaPOS Support,\nI want to activate/extend the license subscription for my store:\n• Store Name: ${storeName}\n• Registered Phone: +91 ${phone}\n• Current Plan: ${details.plan}\n• Expiry: ${details.formattedExpiresAt}`
  )}`;

  return (
    <>
      {/* Top Banner Bar */}
      <div
        role="button" tabIndex={0} aria-label="Manage subscription"
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setModalOpen(true); } }}
        onClick={() => setModalOpen(true)}
        className={`w-full px-3 py-1.5 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors shadow-xs ${
          details.isExpired
            ? 'bg-rose-600 text-white animate-pulse'
            : details.isTrial
            ? 'bg-purple-900 text-purple-100 border-b border-purple-800'
            : 'bg-emerald-800 text-emerald-100 border-b border-emerald-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {details.isExpired ? (
            <AlertTriangle className="w-3.5 h-3.5 text-white flex-shrink-0" />
          ) : details.isTrial ? (
            <Clock className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
          )}

          <span className="truncate">
            {details.isExpired
              ? 'License Expired · Contact Support to Continue Billing'
              : details.isTrial
              ? `Free trial · ${details.daysRemaining > 1 ? `${details.daysRemaining} days` : details.countdown} remaining`
              : `Active Subscription · Valid till ${details.formattedExpiresAt}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-[11px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full font-bold">
            {details.isExpired ? 'Contact Support' : 'Manage license'}
          </span>
        </div>
      </div>

      {(details.isExpired || details.daysRemaining <= 2) && <div className="flex gap-4 px-3 py-2 bg-amber-50 text-amber-950 text-sm">
        <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp support</a>
        <a href="tel:+919381563241">Call +91 9381563241</a>
      </div>}
      {/* Subscription / Support Dialog */}
      {modalOpen && (
        <div role="dialog" aria-modal="true" aria-label="License and subscription" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[85dvh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header */}
            <div className="p-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">NovaPOS License & Subscription</h3>
                  <span className="text-xs text-purple-200">Official Cloud Billing Support</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-full hover:bg-purple-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs text-slate-700">
              {/* Status Box */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  details.isExpired
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : details.isTrial
                    ? 'bg-purple-50 border-purple-200 text-purple-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold block uppercase tracking-wide opacity-75">
                    Current Plan
                  </span>
                  <b className="text-base font-extrabold">
                    {details.isTrial ? '7-Day Free Trial' : details.plan}
                  </b>
                  <p className="text-xs mt-0.5">
                    {details.isExpired
                      ? 'Expired — Contact admin to activate'
                      : `Expires on: ${details.formattedExpiresAt} (${details.countdown})`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      details.isExpired
                        ? 'bg-rose-200 text-rose-900'
                        : details.isTrial
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-emerald-200 text-emerald-900'
                    }`}
                  >
                    {details.isExpired ? 'EXPIRED' : 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Features Included */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="font-bold text-slate-800 block text-xs">
                  ✨ What’s Included in Your License:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-600">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Unlimited Fast Barcode & Voice Billing</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Staff access setup requires the authenticated staff service</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Thermal Printer & Multi-language Invoicing</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>All 18 Sales, GST & Khata Ledger Reports</span>
                  </li>
                </ul>
              </div>

              {/* Direct Support & Activation Box */}
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-3">
                <div>
                  <b className="text-xs font-bold text-purple-900 block">
                    📞 Contact for Subscription & Activation:
                  </b>
                  <p className="text-[11px] text-purple-700 mt-0.5">
                    Contact our executive directly via WhatsApp or Phone call to activate your license.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </a>

                  <a
                    href={`tel:+91${supportNumber}`}
                    className="py-2.5 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Call +91 {supportNumber}
                  </a>
                </div>
              </div>

              <div className="text-center pt-1">
                <span className="text-[10px] text-slate-400">
                  Registered Phone: +91 {phone} · Store: {storeName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
