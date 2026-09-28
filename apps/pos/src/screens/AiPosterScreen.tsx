import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Share2,
  Download,
  CheckCircle2,
  Store,
  Phone,
  Tag,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';

interface Props {
  storeName: string;
  phone: string;
  onBack: () => void;
}

const TEMPLATES = [
  {
    id: 'sale',
    title: 'Super Flash Sale',
    tagline: 'Mega Discount On All Daily Essentials!',
    discount: 'UP TO 40% OFF',
    bgGradient: 'from-amber-500 via-orange-600 to-red-600',
    accentColor: '#F59E0B',
    emoji: '🔥',
  },
  {
    id: 'festival',
    title: 'Festive Season Greetings',
    tagline: 'Wishing all our valued customers joy and prosperity!',
    discount: 'SPECIAL FESTIVE COMBO',
    bgGradient: 'from-orange-600 via-amber-600 to-red-600',
    accentColor: '#8B5CF6',
    emoji: '✨',
  },
  {
    id: 'grocery',
    title: 'Fresh Arrivals & Best Quality',
    tagline: 'Farm fresh staples, grains, dairy & spices directly to you.',
    discount: 'LOWEST MARKET PRICE',
    bgGradient: 'from-emerald-600 via-teal-700 to-cyan-800',
    accentColor: '#10B981',
    emoji: '🌾',
  },
  {
    id: 'offer',
    title: 'Weekend Special Offer',
    tagline: 'Exclusive in-store discounts this weekend only!',
    discount: 'BUY 2 GET 1 FREE',
    bgGradient: 'from-pink-600 via-rose-600 to-red-700',
    accentColor: '#EC4899',
    emoji: '🎉',
  },
];

export const AiPosterScreen: React.FC<Props> = ({ storeName, phone, onBack }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [customTitle, setCustomTitle] = useState(selectedTemplate.title);
  const [customTagline, setCustomTagline] = useState(selectedTemplate.tagline);
  const [customDiscount, setCustomDiscount] = useState(selectedTemplate.discount);
  const [sharedToast, setSharedToast] = useState(false);

  const handleSelectTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTemplate(tpl);
    setCustomTitle(tpl.title);
    setCustomTagline(tpl.tagline);
    setCustomDiscount(tpl.discount);
  };

  const handleShareWhatsApp = () => {
    const text = `📢 *${customTitle}* at *${storeName}*!\n\n🏷️ *Offer:* ${customDiscount}\n💬 *Details:* ${customTagline}\n\n📍 Visit us today or order by calling +91 ${phone}!\n_Generated via Ezo AI Poster_`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 2500);
  };

  return (
    <div className="ezo-subscreen-container">
      {/* Top Header */}
      <header className="ezo-subscreen-header">
        <button onClick={onBack} className="ezo-subscreen-back-btn">
          <ArrowLeft className="w-5 h-5 text-white" /><span>Back</span></button>
        <div className="ezo-subscreen-title-wrap">
          <h2 className="ezo-subscreen-title">AI Viral Poster Creator</h2>
          <span className="ezo-subscreen-sub">
            Generate and share marketing banners for WhatsApp & Instagram
          </span>
        </div>
      </header>

      {sharedToast && (
        <div className="ezo-sync-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-1.5" />
          WhatsApp Share Initiated!
        </div>
      )}

      <div className="ezo-subscreen-body">
        {/* Template Selector Row */}
        <div className="p-3 bg-white border-b border-slate-200">
          <label className="text-xs font-bold text-slate-700 mb-2 block uppercase tracking-wider">
            Choose Poster Style
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTemplate.id === tpl.id
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="mr-1">{tpl.emoji}</span>
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Live Poster Card Preview */}
        <div className="p-4 flex flex-col items-center">
          <div
            className={`w-full max-w-sm rounded-2xl p-6 text-white shadow-xl bg-gradient-to-br ${selectedTemplate.bgGradient} relative overflow-hidden transition-all duration-300`}
            style={{ minHeight: '340px' }}
          >
            {/* Background decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-xl pointer-events-none" />

            {/* Poster Header */}
            <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-white" />
                <span className="font-extrabold text-sm uppercase tracking-wide">
                  {storeName || 'My Store'}
                </span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                PROMO
              </span>
            </div>

            {/* Main Discount Tag */}
            <div className="text-center my-3">
              <span className="inline-block bg-yellow-400 text-slate-900 font-black text-sm px-4 py-1 rounded-full shadow-md uppercase tracking-wider mb-2">
                {customDiscount}
              </span>
              <h1 className="text-2xl font-black leading-tight text-white drop-shadow">
                {customTitle}
              </h1>
              <p className="text-xs text-white/90 mt-2 font-medium leading-relaxed max-w-xs mx-auto">
                {customTagline}
              </p>
            </div>

            {/* Poster Footer Call to Action */}
            <div className="mt-6 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-yellow-300" />
                <span>+91 {phone}</span>
              </div>
              <span className="bg-white text-slate-900 text-[10px] font-black px-2.5 py-1 rounded-md">
                VISIT TODAY
              </span>
            </div>
          </div>

          {/* Quick Edit Inputs */}
          <div className="w-full max-w-sm mt-4 bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Headline</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Offer Badge</label>
              <input
                type="text"
                value={customDiscount}
                onChange={(e) => setCustomDiscount(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Subtext</label>
              <input
                type="text"
                value={customTagline}
                onChange={(e) => setCustomTagline(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-sm flex gap-3 mt-4">
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              Share on WhatsApp
            </button>
            <button
              onClick={() => {
                alert('Poster saved! You can share it to your WhatsApp status or Instagram story.');
              }}
              className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <Download className="w-4 h-4 mr-1" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
