import React from 'react';
import {
  Smartphone,
  Printer,
  Scan,
  Monitor,
  Check,
  ShieldCheck,
  Cpu,
  Wifi,
  BatteryCharging,
  Zap,
  Phone,
} from 'lucide-react';

export const HardwareShowcase: React.FC = () => {
  const hardwareProducts = [
    {
      id: 'handheld-pos',
      name: 'NovaPOS Pro Handheld Smart POS',
      tag: 'MOST POPULAR FOR RETAIL & RESTAURANTS',
      price: '₹11,999',
      originalPrice: '₹14,999',
      badge: 'Best Seller',
      desc: 'All-in-one Android touch handheld terminal with in-built 58mm high-speed thermal receipt printer, 4G SIM + WiFi, and 5000mAh battery.',
      specs: [
        '5.5" IPS Capacitive High-Res HD Touchscreen',
        'In-Built 58mm ESC/POS Thermal Printer (70mm/s)',
        '4G LTE SIM Slot + Dual-Band 5GHz/2.4GHz WiFi',
        '5000 mAh All-Day Heavy Duty Battery (14+ Hrs)',
        'Integrated 5MP Auto-Focus Barcode Camera Scanner',
        'Pre-Loaded NovaPOS Pro Software (Offline & Cloud)',
      ],
      idealFor: 'Kirana Stores, Bakeries, Food Trucks, Delivery, Restaurants & Cafes',
    },
    {
      id: 'desktop-pos',
      name: 'NovaPOS Dual-Screen Desktop Terminal',
      tag: 'SUPERMARKETS & HIGH-VOLUME OUTLETS',
      price: '₹18,999',
      originalPrice: '₹24,999',
      badge: 'Flagship Performance',
      desc: 'Heavy-duty 15.6" Full HD operator touchscreen with 10.1" customer-facing dynamic UPI QR display and external auto-cut thermal printer.',
      specs: [
        '15.6" Full HD Main Display + 10.1" Customer Screen',
        'Octa-Core High-Speed Processor with 4GB RAM / 64GB ROM',
        '80mm USB / Ethernet High-Speed Thermal Auto-Cutter',
        'Supports Heavy-Duty Electronic Cash Drawer (RJ11)',
        'Multiple USB 3.0 & RS232 Ports for Weighing Scales',
        'Lifetime Multi-Terminal Cloud Synchronization',
      ],
      idealFor: 'Supermarkets, Hypermarkets, Garments, Sweet Shops, Pharmacy & Bars',
    },
    {
      id: 'thermal-printers',
      name: 'NovaPOS Bluetooth Thermal Receipt Printers',
      tag: '58MM (2-INCH) & 80MM (3-INCH)',
      price: '₹2,499',
      originalPrice: '₹3,499',
      badge: 'Universal Hardware',
      desc: 'Wireless Bluetooth + USB direct ESC/POS printers. Prints clean GST bills, barcodes, and receipts directly from any Android phone or PC.',
      specs: [
        '58mm (2") and 80mm (3") Models with Auto-Cut options',
        'Bluetooth 4.2 BLE + High-Speed USB Interface',
        'Supports Standard 58mm Paper Rolls (Available Everywhere)',
        'Built-in 2000mAh Rechargeable Lithium Battery',
        '1-Tap Direct Printing from Calculator & Sales Invoices',
        'Compatible with Android, iOS, Windows, Mac & Linux',
      ],
      idealFor: 'Mobile Retail Billing, Khata Receipts, Express Counters',
    },
    {
      id: 'barcode-scanners',
      name: 'NovaPOS 2D Laser Barcode & QR Scanners',
      tag: 'HANDHELD & OMNIDIRECTIONAL DESKTOP',
      price: '₹1,499',
      originalPrice: '₹2,299',
      badge: 'High Speed',
      desc: 'Instant 0.05s scanning for all 1D retail barcodes and 2D QR codes (even damaged or printed on mobile screens). Plug & Play USB.',
      specs: [
        'Reads EAN-13, UPC, Code-128, QR Code, DataMatrix',
        'Wireless 2.4GHz + USB Wired Dual-Mode Connection',
        'Scan rate: 300 scans/sec with shockproof rubber casing',
        'Automatic continuous scan mode & trigger mode',
        'Plug & Play — No driver installation required',
        'Supports 50-meter wireless transmission distance',
      ],
      idealFor: 'Fast Grocery Scanning, Stock Inventory Audits, Wholesale',
    },
  ];

  return (
    <section id="hardware" className="py-20 md:py-32 relative bg-slate-950/60 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400 uppercase tracking-wider">
            <span>Hardware Billing Machines</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Commercial-Grade POS Hardware & <span className="text-gradient-purple">Billing Terminals</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Engineered for non-stop, 365-day heavy billing in Indian retail stores. Backed by a 1-year replacement warranty, free pan-India shipping, and remote installation.
          </p>
        </div>

        {/* Hardware Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {hardwareProducts.map((p) => (
            <div
              key={p.id}
              className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-white/10 hover:border-indigo-500/40 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {p.badge}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 line-through mr-2">{p.originalPrice}</span>
                    <span className="text-2xl font-black text-emerald-400">{p.price}</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {p.name}
                </h3>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mt-0.5">
                  {p.tag}
                </span>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {p.desc}
                </p>

                {/* Specs List */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Key Specifications:
                  </span>
                  {p.specs.map((spec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-400">
                  <b className="text-indigo-300">Ideal For:</b> {p.idealFor}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={`https://wa.me/919381563241?text=Hi%20NovaPOS%2C%20I%20want%20to%20order%20the%20${encodeURIComponent(
                    p.name
                  )}%20(${p.price})`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 font-bold text-xs text-white text-center flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Order on WhatsApp / Book Demo</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 1 Year Warranty Banner */}
        <div className="mt-12 glass-panel p-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <b className="text-sm font-bold text-white block">100% Pan-India Hardware Warranty & Onsite Setup</b>
              <p className="text-xs text-slate-400">
                1-Year replacement warranty on all Touch POS machines and thermal printers with instant video call tech support.
              </p>
            </div>
          </div>
          <a
            href="tel:9701463241"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <span>Hardware Helpline: +91 9701463241</span>
          </a>
        </div>
      </div>
    </section>
  );
};
