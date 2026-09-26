import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send, CheckCircle2, Store, Sparkles, MessageSquare } from 'lucide-react';

export const ContactForm: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState('Kirana / Supermarket');
  const [requirement, setRequirement] = useState('Handheld Touch POS Machine + Software');
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
    <section id="contact" className="py-20 md:py-32 relative bg-slate-950/90 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Info */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400 uppercase">
              <span>Book Machine Demo & Inquiry</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Get Your Store Automated with <br />
              <span className="text-gradient-purple">NovaPOS Today</span>
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              Have questions about which POS terminal fits your outlet? Our billing experts provide free live video demonstrations, hardware recommendations, and custom quotes.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Helpline & WhatsApp</span>
                  <a href="tel:9381563241" className="text-sm font-bold text-white hover:text-indigo-400">
                    +91 9381563241 / +91 9701463241
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Support & Sales Email</span>
                  <a href="mailto:support@novapos.in" className="text-sm font-bold text-white hover:text-indigo-400">
                    support@novapos.in / care@digitalfox.in
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-bold block">Headquarters & Supply Center</span>
                  <span className="text-xs font-bold text-white">
                    Digital Fox Agency & NovaPOS Technologies, India
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/10 shadow-2xl">
            {submitted ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-white">Inquiry Received!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  We have forwarded your details to our WhatsApp team. A POS specialist will connect with you within 15 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-lg font-black text-white">Request Demo & Hardware Quote</h3>
                  <span className="text-[11px] text-emerald-400 font-bold">Fast Response</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">WhatsApp Mobile *</label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">City / State *</label>
                    <input
                      type="text"
                      placeholder="e.g. Hyderabad, Telangana"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Business Category</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Kirana / Supermarket">Kirana / Supermarket</option>
                      <option value="Restaurant / Cafe / KOT">Restaurant / Cafe / KOT</option>
                      <option value="Bakery / Sweets">Bakery / Sweets</option>
                      <option value="Garments / Retail Shop">Garments / Retail Shop</option>
                      <option value="Wholesale / Distributor">Wholesale / Distributor</option>
                      <option value="Other Business">Other Business</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Select Hardware / Software Requirement</label>
                  <select
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Handheld Touch POS Machine + Inbuilt Thermal Printer">
                      Handheld Touch POS Machine + Inbuilt Thermal Printer (₹11,999)
                    </option>
                    <option value="Desktop Dual-Screen 15.6 Inch Supermarket Terminal">
                      Desktop Dual-Screen 15.6" Supermarket Terminal (₹18,999)
                    </option>
                    <option value="Standalone Bluetooth Thermal Receipt Printer (58mm / 80mm)">
                      Standalone Bluetooth Thermal Receipt Printer (₹2,499)
                    </option>
                    <option value="Pro Annual Software License (₹4,999/yr)">
                      Pro Annual Software License (₹4,999/yr)
                    </option>
                    <option value="Free 3-Day Trial Setup Support">
                      Free 3-Day Trial Setup Support
                    </option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:brightness-110 font-black text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
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
