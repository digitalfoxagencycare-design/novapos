import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  QrCode,
  MessageCircle,
} from 'lucide-react';
import type { CatalogItem } from '../screens/InventoryScreen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CatalogItem[];
  profileName: string;
  phone: string;
}

export const ShareMenuModal: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  profileName,
  phone,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format menu as beautiful WhatsApp message
  const menuCategories = Array.from(new Set(items.map((i) => i.categoryName)));
  let formattedText = `🍽️ *${profileName || 'Restaurant Menu'}*\n📍 For Orders: ${phone || ''}\n\n`;

  menuCategories.forEach((cat) => {
    const catItems = items.filter((i) => i.categoryName === cat);
    formattedText += `📋 *--- ${cat.toUpperCase()} ---*\n`;
    catItems.forEach((i) => {
      if (i.portions && i.portions.length > 0) {
        const portStr = i.portions.map((p) => `${p.name}: ₹${p.price}`).join(' | ');
        formattedText += `• *${i.name}* - ${portStr}\n`;
      } else {
        formattedText += `• *${i.name}* - ₹${(i.priceMinor / 100).toFixed(0)}\n`;
      }
    });
    formattedText += `\n`;
  });

  formattedText += `✨ *Thank you for dining with us!*`;

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(formattedText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profileName} Menu`,
        text: formattedText,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="menu-modal-overlay">
      <div className="menu-modal-sheet max-w-sm w-full bg-white rounded-3xl shadow-2xl p-5 border border-slate-200 animate-slide-up space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-black text-slate-900">Share Digital Menu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Share your live menu with prices and portions with customers via WhatsApp, QR code, or SMS!
        </p>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20BA5C] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Share via WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all border border-slate-200"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Menu Text'}</span>
          </button>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all border border-orange-200"
            >
              <Share2 className="w-4 h-4" />
              <span>More Sharing Options</span>
            </button>
          )}
        </div>

        {/* QR Code preview box */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
          <div className="w-20 h-20 bg-white border border-slate-300 rounded-xl mx-auto flex items-center justify-center p-2 shadow-sm">
            <QrCode className="w-16 h-16 text-slate-800" />
          </div>
          <span className="text-[11px] font-bold text-slate-600 block">
            Scan for Customer Digital Menu
          </span>
        </div>
      </div>
    </div>
  );
};
