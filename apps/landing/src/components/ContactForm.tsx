import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send, CheckCircle2, Store, Sparkles, MessageSquare } from 'lucide-react';

export const ContactForm: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState('Kirana / Supermarket');
  const [requirement, setRequirement] = useState('NovaPOS Bada Billing Machine with 1-Year Software (₹6,499)');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    const message = encodeURIComponent(
      `Hello NovaPOS! I want to inquire about POS Machine & Software.\n\nName: ${name}\nPhone: +91 ${cleanPhone}\nCity: ${city}\nBusiness: ${businessType}\nRequirement: ${requirement}`
    );

    window.open(`https://wa.me/919381563241?text=${message}`, '_blank');
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Info */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 uppercase">
              <span>Book Machine Demo & Inquiry</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Get Your Store Automated with <br />
              <span className="text-gradient-purple">NovaPOS Today</span>
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
              Have questions about which POS terminal or software plan fits your outlet? Our billing specialists provide free live video demonstrations, hardware recommendations, and custom quotes.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">Helpline & WhatsApp Orders</span>
                  <a href="https://wa.me/919381563241" target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-900 hover:text-indigo-600">
                    +91 9381563241
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">Support & Inquiries Email</span>
                  <a href="mailto:support@novapos.in" className="text-sm font-bold text-slate-900 hover:text-indigo-600">
                    support@novapos.in / care@digitalfox.in
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">Headquarters & Supply Center</span>
                  <span className="text-xs font-bold text-slate-900">
                    Digital Fox Agency & NovaPOS Technologies, India
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            {submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Inquiry Received!</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  We have forwarded your details to our WhatsApp sales team. A POS specialist will connect with you within 15 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="border-b border-slate-200 pb-2.5">
                  <h3 className="text-base font-black text-slate-900">Request Demo & Hardware Quote</h3>
                  <span className="text-[11px] text-emerald-600 font-bold">Fast Response via WhatsApp</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Your Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">WhatsApp Number *</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">City / State *</label>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Business Category</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Kirana / Supermarket">Kirana / Supermarket</option>
                      <option value="Restaurant / Cafe / KOT">Restaurant / Cafe / KOT</option>
                      <option value="Bakery / Sweets">Bakery / Sweets</option>
                      <option value="Garments / Retail">Garments / Retail</option>
                      <option value="Wholesale / Distributor">Wholesale / Distributor</option>
                      <option value="Other Business">Other Business</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Selected Product / Plan</label>
                  <select
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="NovaPOS Bada Billing Machine with 1-Year Software (₹6,499)">
                      NovaPOS Bada Billing Machine with 1-Year Software (₹6,499)
                    </option>
                    <option value="NovaPOS Smart Touch POS Hardware Machine Standalone (₹2,999)">
                      NovaPOS Smart Touch POS Hardware Machine Standalone (₹2,999)
                    </option>
                    <option value="NovaPOS 1-Year Cloud SaaS Software Subscription (₹2,999)">
                      NovaPOS 1-Year Cloud SaaS Software Subscription (₹2,999 · 45% OFF)
                    </option>
                    <option value="NovaPOS Bluetooth Thermal Receipt Printer (₹1,999)">
                      NovaPOS Bluetooth Thermal Receipt Printer (₹1,999)
                    </option>
                    <option value="Free 7-Day Trial Setup Assistance">
                      Free 7-Day Trial Setup Assistance
                    </option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-300" />
                  <span>Connect with Sales on WhatsApp</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
