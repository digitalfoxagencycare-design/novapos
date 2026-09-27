import React, { useState } from 'react';
import {
  X,
  LayoutDashboard,
  Receipt,
  Calculator,
  UtensilsCrossed,
  Users,
  Package,
  BarChart3,
  User,
  Sliders,
  Sparkles,
  Printer,
  LogOut,
  ChevronRight,
  Store,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { type BusinessProfile, PROFILES } from '../lib/business';
import { ComplianceModal } from './ComplianceModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  profile: BusinessProfile;
  profileName: string;
  phone: string;
  onOpenPrinterModal: () => void;
  onLogout: () => void;
}

export const SideDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeScreen,
  onNavigate,
  profile,
  profileName,
  phone,
  onOpenPrinterModal,
  onLogout,
}) => {
  const [complianceOpen, setComplianceOpen] = useState(false);

  if (!isOpen && !complianceOpen) return null;

  const allMenuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      subtitle: 'Sales overview & quick actions',
      icon: <LayoutDashboard className="w-5 h-5 text-indigo-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'billing',
      label: 'Sale Invoice',
      subtitle: 'Fast retail & barcode billing',
      icon: <Receipt className="w-5 h-5 text-emerald-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'calculator',
      label: 'Calculator Billing',
      subtitle: 'Express cash & rapid keypad',
      icon: <Calculator className="w-5 h-5 text-amber-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'tables',
      label: 'Tables & KOT',
      subtitle: 'Dine-in, takeaway & kitchen orders',
      icon: <UtensilsCrossed className="w-5 h-5 text-orange-600" />,
      forProfiles: ['restaurant'], // ONLY shown for Restaurant / Cafe profile
    },
    {
      id: 'party',
      label: 'Party / Khata Book',
      subtitle: 'Customer udhar, suppliers & credit',
      icon: <Users className="w-5 h-5 text-blue-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'inventory',
      label: 'Items & Products',
      subtitle: 'Products, prices, stock & barcodes',
      icon: <Package className="w-5 h-5 text-purple-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'reports',
      label: 'All 18 Reports',
      subtitle: 'Day book, GST, sales & analytics',
      icon: <BarChart3 className="w-5 h-5 text-cyan-600" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'profile',
      label: 'Business Profile',
      subtitle: 'GST, address, bank & UPI QR',
      icon: <User className="w-5 h-5 text-slate-700" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
    {
      id: 'settings',
      label: 'Settings (34 Controls)',
      subtitle: 'Bill layout, print, tax & hardware',
      icon: <Sliders className="w-5 h-5 text-slate-700" />,
      forProfiles: ['kirana', 'bakery', 'restaurant', 'retail'],
    },
  ];

  const menuItems = allMenuItems.filter((item) => item.forProfiles.includes(profile));

  return (
    <div className="ezo-drawer-overlay" onClick={onClose}>
      <aside
        className="ezo-drawer-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="ezo-drawer-header">
          <div className="ezo-drawer-brand">
            <div className="ezo-drawer-logo">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div className="ezo-drawer-brand-text">
              <h2 className="ezo-drawer-store-name">{profileName || 'kirana'}</h2>
              <span className="ezo-drawer-store-meta">
                +91 {phone} · {PROFILES[profile]}
              </span>
              <span className="ezo-drawer-badge">
                <ShieldCheck className="w-3 h-3 mr-1 inline" />
                Cloud POS · FAST v39.31
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ezo-drawer-close-btn"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Drawer Scrollable Navigation Links */}
        <nav className="ezo-drawer-nav">
          <div className="ezo-drawer-section-title">MAIN NAVIGATION</div>
          {menuItems.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`ezo-drawer-item ${isActive ? 'active' : ''}`}
              >
                <div className="ezo-drawer-item-icon">{item.icon}</div>
                <div className="ezo-drawer-item-text">
                  <span className="ezo-drawer-item-title">{item.label}</span>
                  <span className="ezo-drawer-item-sub">{item.subtitle}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </button>
            );
          })}

          <div className="ezo-drawer-section-title">DEVICES & SESSION</div>

          {/* Connect Printer Shortcut */}
          <button
            onClick={() => {
              onClose();
              onOpenPrinterModal();
            }}
            className="ezo-drawer-item"
          >
            <div className="ezo-drawer-item-icon">
              <Printer className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="ezo-drawer-item-text">
              <span className="ezo-drawer-item-title">Thermal Printer Setup</span>
              <span className="ezo-drawer-item-sub">
                Bluetooth / USB (58mm / 80mm)
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          </button>

          {/* Legal, Privacy & Compliance */}
          <button
            type="button"
            onClick={() => {
              setComplianceOpen(true);
            }}
            className="ezo-drawer-item"
          >
            <div className="ezo-drawer-item-icon">
              <Scale className="w-5 h-5 text-slate-700" />
            </div>
            <div className="ezo-drawer-item-text">
              <span className="ezo-drawer-item-title">Privacy Policy & Legal</span>
              <span className="ezo-drawer-item-sub">
                Play Store Data Safety & Compliance
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
          </button>

          {/* Logout / Switch Store */}
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="ezo-drawer-item ezo-drawer-logout"
          >
            <div className="ezo-drawer-item-icon">
              <LogOut className="w-5 h-5 text-rose-600" />
            </div>
            <div className="ezo-drawer-item-text">
              <span className="ezo-drawer-item-title text-rose-600 font-bold">
                Logout / Switch Store
              </span>
              <span className="ezo-drawer-item-sub">
                Change phone or business account
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400 ml-auto" />
          </button>
        </nav>

        {/* Drawer Footer */}
        <div className="ezo-drawer-footer">
          <p className="text-[11px] text-slate-400 text-center font-medium">
            NovaPOS Pro · Licensed to +91 {phone}
          </p>
        </div>
      </aside>

      {/* Compliance / Privacy Policy Modal */}
      <ComplianceModal
        isOpen={complianceOpen}
        onClose={() => setComplianceOpen(false)}
      />
    </div>
  );
};
