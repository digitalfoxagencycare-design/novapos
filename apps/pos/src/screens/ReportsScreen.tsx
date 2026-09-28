import { exportCsv } from '../lib/csv';
import { showPrintPreview } from '../components/PrintPreview';
import { useBackHandler } from '../lib/navigation';
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Printer,
  Calendar,
  Download,
  CheckCircle2,
  Share2,
  ChevronDown,
  ChevronUp,
  Search,
  Receipt,
  Layers,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import {
  DayBookEntry,
  filterEntriesByPeriod,
  loadDayBookEntries,
  getOpeningCash,
  saveDayClosing,
  loadClosings,
  type DayClosingReport,
} from '../lib/dayBook';
import { loadParties, type Party, buildWhatsAppReminderUrl } from '../lib/khata';
import { printReceiptViaBrowser, type BillData, type BillItem } from '../lib/thermalPrinter';
import { type CatalogItem } from './InventoryScreen';

interface Props {
  profileName: string;
  phone?: string;
  items?: CatalogItem[];
  onBack?: () => void;
}

export type ReportId =
  | '1.1'
  | '1.2'
  | '1.3'
  | '2.1'
  | '2.2'
  | '2.3'
  | '2.4'
  | '2.5'
  | '2.6'
  | '2.7'
  | '2.8'
  | '3.1'
  | '3.2'
  | '3.3'
  | '4.1'
  | '4.2'
  | '4.2.1'
  | '4.3'
  | '4.4'
  | '5.1';

interface ReportMenuItem {
  code: ReportId;
  title: string;
  subtitle?: string;
}

interface ReportGroup {
  header?: string;
  items: ReportMenuItem[];
}

const REPORT_MENU: ReportGroup[] = [
  {
    items: [
      { code: '1.1', title: '1.1 Business Report', subtitle: 'Overall Sales, Profit, Revenue & Cash Flow' },
      { code: '1.2', title: '1.2 Day Book Report', subtitle: 'Daily Cash Inflow, Outflow & Cashier Balances' },
      { code: '1.3', title: '1.3 GST Tax Report (GSTR-1)', subtitle: 'Tax Slab Breakdown (0%, 5%, 12%, 18%, 28%) & CGST/SGST Register' },
    ],
  },
  {
    header: 'TRANSACTION REPORTS',
    items: [
      { code: '2.1', title: '2.1 Sale Report', subtitle: 'Detailed Bill-by-Bill Sales Transaction Register with Items' },
      { code: '2.2', title: '2.2 Staff Wise Sale Report', subtitle: 'Performance & Sales Breakdown by Staff / Captain' },
      { code: '2.3', title: '2.3 Sale Wise Profit And Loss Statement', subtitle: 'COGS, Gross Margin & Operating Profitability' },
      { code: '2.4', title: '2.4 Purchase Report', subtitle: 'Vendor Invoices & Inventory Inward Purchases' },
      { code: '2.5', title: '2.5 Money In Report', subtitle: 'Customer Udhar Collections & External Cash In' },
      { code: '2.6', title: '2.6 Money Out Report', subtitle: 'Supplier Dues Paid, Advances & Petty Cash' },
      { code: '2.7', title: '2.7 Expense Report', subtitle: 'Store Operating Expenses & Utility Overheads' },
      { code: '2.8', title: '2.8 Estimate Report', subtitle: 'Quotations, Proforma Bills & Held Orders' },
    ],
  },
  {
    header: 'PARTY REPORTS',
    items: [
      { code: '3.1', title: '3.1 Party Ledger', subtitle: 'Customer and Supplier Running Account Statements' },
      { code: '3.2', title: '3.2 Party Receivable/Payable Report', subtitle: 'Aging Analysis of Outstanding Credit & Dues' },
      { code: '3.3', title: '3.3 Party Details Report', subtitle: 'Party Directory with Contact Details & Credit Limits' },
    ],
  },
  {
    header: 'ITEM/STOCK REPORTS',
    items: [
      { code: '4.1', title: '4.1 Stock Summary Report', subtitle: 'Current Inventory Levels, Valuation & Low Stock' },
      { code: '4.2', title: '4.2 Item Sale Report', subtitle: 'Top Selling Products Ranked by Quantity & Revenue' },
      { code: '4.2.1', title: '4.2.1 Item Category wise Sale Report', subtitle: 'Department & Category / Counter Revenue Contribution' },
      { code: '4.3', title: '4.3 Item Report', subtitle: 'Master Catalog Price List with Tax & Barcodes' },
      { code: '4.4', title: '4.4 Item Details Report', subtitle: 'Movement History, Inward/Outward Ledger by SKU' },
    ],
  },
  {
    header: 'OTHER REPORTS',
    items: [
      { code: '5.1', title: '5.1 Cut Off Day Report', subtitle: 'Shift End Blind Cash Tally & Drawer Reconciliation' },
    ],
  },
];

export const ReportsScreen: React.FC<Props> = ({ profileName, phone = '9381563241', items = [], onBack }) => {
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('today');
  
  // Custom date picker state
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // Search & Expansion state
  const [saleSearch, setSaleSearch] = useState<string>('');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useBackHandler(Boolean(selectedReport), () => setSelectedReport(null));

  // DayBook & Financial Data
  const [allEntries] = useState<DayBookEntry[]>(loadDayBookEntries());
  const [, setClosings] = useState<DayClosingReport[]>(loadClosings());
  const [openingCash] = useState<number>(getOpeningCash());
  const [countedCash, setCountedCash] = useState<string>('');
  const [closingDone, setClosingDone] = useState<DayClosingReport | null>(null);
  const [parties] = useState<Party[]>(loadParties());

  // Filter entries based on period / custom range
  const entries = useMemo(() => {
    return filterEntriesByPeriod(
      allEntries,
      selectedReport === '5.1' ? 'today' : dateFilter,
      dateFilter === 'custom' ? { start: customStart, end: customEnd } : undefined
    );
  }, [allEntries, dateFilter, selectedReport, customStart, customEnd]);

  // Aggregate stats
  const salesEntries = useMemo(() => entries.filter((e) => e.type === 'sale'), [entries]);
  const cashSales = useMemo(
    () => salesEntries.filter((e) => e.paymentMode === 'cash').reduce((s, e) => s + e.amount, 0),
    [salesEntries]
  );
  const upiSales = useMemo(
    () => salesEntries.filter((e) => e.paymentMode === 'upi').reduce((s, e) => s + e.amount, 0),
    [salesEntries]
  );
  const cardSales = useMemo(
    () => salesEntries.filter((e) => e.paymentMode === 'card').reduce((s, e) => s + e.amount, 0),
    [salesEntries]
  );
  const creditSales = useMemo(
    () => salesEntries.filter((e) => e.paymentMode === 'credit').reduce((s, e) => s + e.amount, 0),
    [salesEntries]
  );
  const totalSales = cashSales + upiSales + cardSales + creditSales;

  const moneyInCash = entries
    .filter((e) => e.type === 'money_in' && e.paymentMode === 'cash')
    .reduce((s, e) => s + e.amount, 0);
  const moneyOutCash = entries
    .filter((e) => e.type === 'money_out' && e.paymentMode === 'cash')
    .reduce((s, e) => s + e.amount, 0);
  const expensesTotal = entries
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + e.amount, 0);

  const expectedCashInDrawer =
    openingCash +
    cashSales +
    (moneyInCash || 0) -
    (moneyOutCash +
      entries
        .filter((e) => e.type === 'expense' && e.paymentMode === 'cash')
        .reduce((sum, e) => sum + e.amount, 0));

  // Customer & Supplier balances
  const customers = parties.filter((p) => p.type === 'customer');
  const suppliers = parties.filter((p) => p.type === 'supplier');
  const totalReceivable = customers
    .filter((p) => p.balance > 0)
    .reduce((acc, p) => acc + p.balance, 0);
  const totalPayable = suppliers
    .filter((p) => p.balance < 0)
    .reduce((acc, p) => acc + Math.abs(p.balance), 0);

  const displayItems = items;
  const heldBills: { id: string; customerName: string; lines: { price: number; quantity: number }[] }[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('novapos:held_bills') || '[]');
    } catch {
      return [];
    }
  })();

  // Total inventory valuation
  const inventoryValuation = displayItems.reduce(
    (acc, i) => acc + (i.priceMinor / 100) * (i.stockQty ?? 0),
    0
  );
  const lowStockCount = displayItems.filter((i) => (i.stockQty ?? 0) < 10).length;

  // Compute Item-wise sales aggregation
  const itemWiseSales = useMemo(() => {
    const itemMap = new Map<
      string,
      { name: string; category: string; quantity: number; uom: string; revenue: number; ordersCount: number }
    >();

    for (const sale of salesEntries) {
      if (sale.lines && sale.lines.length > 0) {
        for (const line of sale.lines) {
          const key = `${line.itemId || line.name}|${line.uom}|${line.category}`;
          const existing = itemMap.get(key) || {
            name: line.name,
            category: line.category || 'General',
            quantity: 0,
            uom: line.uom || 'pcs',
            revenue: 0,
            ordersCount: 0,
          };
          existing.quantity += line.quantity;
          existing.revenue += (line.netMinor !== undefined ? line.netMinor / 100 : line.price * line.quantity);
          existing.ordersCount += 1;
          itemMap.set(key, existing);
        }
      }
    }

    return Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [salesEntries]);

  // Compute Category-wise sales aggregation
  const categoryWiseSales = useMemo(() => {
    const catMap = new Map<
      string,
      {
        category: string;
        revenue: number;
        totalQty: number;
        ordersCount: number;
        items: { name: string; qty: number; uom: string; revenue: number }[];
      }
    >();

    for (const sale of salesEntries) {
      if (sale.lines && sale.lines.length > 0) {
        for (const line of sale.lines) {
          const cat = line.category || 'General';
          const existing = catMap.get(cat) || {
            category: cat,
            revenue: 0,
            totalQty: 0,
            ordersCount: 0,
            items: [],
          };
          existing.revenue += (line.netMinor !== undefined ? line.netMinor / 100 : line.price * line.quantity);
          existing.totalQty += line.quantity;
          existing.ordersCount += 1;

          const itemIndex = existing.items.findIndex((i) => i.name.toLowerCase() === line.name.toLowerCase());
          if (itemIndex >= 0) {
            existing.items[itemIndex].qty += line.quantity;
            existing.items[itemIndex].revenue += (line.netMinor !== undefined ? line.netMinor / 100 : line.price * line.quantity);
          } else {
            existing.items.push({
              name: line.name,
              qty: line.quantity,
              uom: line.uom || 'pcs',
              revenue: (line.netMinor !== undefined ? line.netMinor / 100 : line.price * line.quantity),
            });
          }

          catMap.set(cat, existing);
        }
      }
    }

    // Sort items inside each category
    for (const catData of catMap.values()) {
      catData.items.sort((a, b) => b.revenue - a.revenue);
    }

    return Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [salesEntries]);

  // Close Day action
  const handleCloseDay = () => {
    const actual = parseFloat(countedCash) || 0;
    const variance = actual - expectedCashInDrawer;

    const report: DayClosingReport = {
      id: `close-${Date.now()}`,
      date: new Date().toLocaleDateString('en-IN'),
      closedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      cashierName: 'Main Cashier',
      openingCash,
      totalSales,
      cashSales,
      upiSales,
      cardSales,
      creditSales,
      moneyInCash,
      moneyOutCash,
      expensesCash: expensesTotal,
      expectedDrawerCash: expectedCashInDrawer,
      actualCountedCash: actual,
      variance,
      billsCount: salesEntries.length,
    };

    saveDayClosing(report);
    setClosings(loadClosings());
    setClosingDone(report);
  };

  const handlePrintSlip = () => {
    const section = document.querySelector('.ezo-report-content');
    if (!section) return;
    showPrintPreview(
      `<html><head><title>NovaPOS report</title><style>body{font:14px sans-serif;padding:16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}button,select{display:none}</style></head><body>${section.innerHTML}</body></html>`
    );
  };

  const handlePrintInvoice = (entry: DayBookEntry) => {
    if (!entry.receiptSnapshot) { window.alert('This legacy bill has no frozen receipt snapshot. Original tax cannot be reconstructed safely.'); return; }
    printReceiptViaBrowser({ ...entry.receiptSnapshot, isDuplicate: true });
  };

  const handleShareInvoice = (entry: DayBookEntry) => {
    const linesText =
      entry.lines && entry.lines.length > 0
        ? entry.lines.map((l) => `• ${l.name} x ${l.quantity} ${l.uom || ''} = ₹${(l.price * l.quantity).toFixed(2)}`).join('\n')
        : `• ${entry.description}: ₹${entry.amount.toFixed(2)}`;

    const text =
      `*${profileName || 'NovaPOS Store'} - Tax Invoice*\n` +
      `*Bill No:* ${entry.referenceNo || entry.id}\n` +
      `*Date:* ${new Date(entry.timestamp).toLocaleString('en-IN')}\n` +
      `*Payment Mode:* ${entry.paymentMode.toUpperCase()}\n` +
      `--------------------------\n` +
      `*Items:*\n${linesText}\n` +
      `--------------------------\n` +
      `*Total Amount:* ₹${entry.amount.toFixed(2)}\n\n` +
      `Thank you for shopping with us! 🙏`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportCSV = (reportName: string, headers: string[], rows: (string | number)[][]) => {
    exportCsv(`${reportName}_${todayStr}.csv`, headers, rows);
  };

  const activeReport = REPORT_MENU.flatMap((g) => g.items).find((i) => i.code === selectedReport);
  const activeReportTitle = activeReport?.title || 'Report';

  // Filtered sales list by search keyword
  const filteredSaleEntries = useMemo(() => {
    if (!saleSearch.trim()) return salesEntries;
    const q = saleSearch.toLowerCase().trim();
    return salesEntries.filter(
      (tx) =>
        tx.description?.toLowerCase().includes(q) ||
        tx.referenceNo?.toLowerCase().includes(q) ||
        tx.paymentMode?.toLowerCase().includes(q) ||
        String(tx.amount).includes(q) ||
        tx.lines?.some((l) => l.name.toLowerCase().includes(q))
    );
  }, [salesEntries, saleSearch]);

  // Filtered item sales by search keyword
  const filteredItemWiseSales = useMemo(() => {
    if (!itemSearch.trim()) return itemWiseSales;
    const q = itemSearch.toLowerCase().trim();
    return itemWiseSales.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [itemWiseSales, itemSearch]);

  return (
    <div className="ezo-screen-container">
      {/* Top Purple App Bar */}
      <div className="ezo-app-bar">
        <button
          className="ezo-back-btn"
          onClick={() => {
            if (selectedReport) {
              setSelectedReport(null);
            } else if (onBack) {
              onBack();
            }
          }}
          title="Back"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
          <span>Back</span>
        </button>
        <div className="ezo-title-group">
          <h1 className="ezo-bar-title">{selectedReport ? activeReportTitle : 'Reports'}</h1>
          <span className="ezo-bar-sub">FAST v39.31 {phone ? `| +91 ${phone}` : ''}</span>
        </div>
      </div>

      {/* Screen Body */}
      <div className="ezo-screen-scroll">
        {!selectedReport ? (
          /* Report Catalog List View */
          <div className="ezo-reports-list-container">
            {REPORT_MENU.map((group, gIdx) => (
              <div key={gIdx} className="ezo-report-section">
                {group.header && <h2 className="ezo-report-category-title">{group.header}</h2>}
                <div className="ezo-report-items-stack">
                  {group.items.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setSelectedReport(item.code)}
                      className="ezo-report-row-card"
                    >
                      <div className="ezo-report-icon-wrap">
                        <svg
                          className="w-5 h-5 text-amber-500 fill-amber-100 stroke-amber-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="8" y1="13" x2="16" y2="13" />
                          <line x1="8" y1="17" x2="14" y2="17" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="ezo-report-item-text">{item.title}</span>
                        {item.subtitle && (
                          <span className="block text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Detail Report View */
          <div className="ezo-report-detail-container space-y-4">
            {/* Top Date Filter & Export Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as const).map((df) => (
                    <button
                      key={df}
                      onClick={() => setDateFilter(df)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md capitalize transition-colors ${
                        dateFilter === df
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {df === 'week' ? 'Last 7 Days' : df === 'month' ? 'This Month' : df}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={handlePrintSlip}
                    className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                    title="Print Thermal Slip"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Custom Date Range Picker Inputs */}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-slate-500 font-medium">From:</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="bg-transparent font-semibold text-slate-700 outline-none text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-slate-500 font-medium">To:</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-transparent font-semibold text-slate-700 outline-none text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 1.1 Business Report */}
            {selectedReport === '1.1' && (
              <div className="ezo-detail-card space-y-4">
                <div className="ezo-kpi-grid">
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Total Revenue</span>
                    <b className="ezo-kpi-val text-purple-700">₹{totalSales.toFixed(2)}</b>
                    <span className="ezo-kpi-note">{salesEntries.length} bills generated</span>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Cash In Register</span>
                    <b className="ezo-kpi-val text-emerald-600">₹{cashSales.toFixed(2)}</b>
                    <span className="ezo-kpi-note">Cash sales collected</span>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Digital (UPI/Card)</span>
                    <b className="ezo-kpi-val text-blue-600">₹{(upiSales + cardSales).toFixed(2)}</b>
                    <span className="ezo-kpi-note">Settled directly to bank</span>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Khata / Credit</span>
                    <b className="ezo-kpi-val text-amber-600">₹{creditSales.toFixed(2)}</b>
                    <span className="ezo-kpi-note">Customer receivables</span>
                  </div>
                </div>

                <div className="ezo-table-wrap">
                  <h3 className="ezo-table-heading">Payment Modes Breakdown</h3>
                  <table className="ezo-table">
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th className="text-right">Amount (₹)</th>
                        <th className="text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Cash</td>
                        <td className="text-right font-medium">₹{cashSales.toFixed(2)}</td>
                        <td className="text-right">
                          {totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0}%
                        </td>
                      </tr>
                      <tr>
                        <td>UPI / Dynamic QR</td>
                        <td className="text-right font-medium">₹{upiSales.toFixed(2)}</td>
                        <td className="text-right">
                          {totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0}%
                        </td>
                      </tr>
                      <tr>
                        <td>Card (POS Terminal)</td>
                        <td className="text-right font-medium">₹{cardSales.toFixed(2)}</td>
                        <td className="text-right">
                          {totalSales > 0 ? Math.round((cardSales / totalSales) * 100) : 0}%
                        </td>
                      </tr>
                      <tr>
                        <td>Khata Credit</td>
                        <td className="text-right font-medium">₹{creditSales.toFixed(2)}</td>
                        <td className="text-right">
                          {totalSales > 0 ? Math.round((creditSales / totalSales) * 100) : 0}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() =>
                    handleExportCSV(
                      'Business_Report',
                      ['Mode', 'Amount', 'Share'],
                      [
                        ['Cash', cashSales, `${totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0}%`],
                        ['UPI', upiSales, `${totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0}%`],
                        ['Card', cardSales, `${totalSales > 0 ? Math.round((cardSales / totalSales) * 100) : 0}%`],
                        ['Credit', creditSales, `${totalSales > 0 ? Math.round((creditSales / totalSales) * 100) : 0}%`],
                      ]
                    )
                  }
                  className="ezo-outline-card-btn text-xs py-2"
                >
                  <Download className="w-4 h-4 mr-1.5 inline" />
                  Export Business Report CSV
                </button>
              </div>
            )}

            {/* 1.3 GST Tax Report (GSTR-1 Summary) */}
            {selectedReport === '1.3' && (() => {
              const slabTotals: Record<
                number,
                { taxable: number; cgst: number; sgst: number; totalGst: number; gross: number }
              > = {
                0: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 },
                5: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 },
                12: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 },
                18: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 },
                28: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 },
              };

              let totalTaxable = 0;
              let totalCgst = 0;
              let totalSgst = 0;
              let totalGstCollected = 0;

              const missingSnapshots = salesEntries.filter(sale => !sale.taxSnapshot).length;
              for (const sale of salesEntries) {
                for (const line of sale.taxSnapshot?.lines ?? []) {
                  const rate = Number(line.slabId.replace('gst-', ''));
                  if (!Number.isFinite(rate)) continue;
                  const taxable = line.taxableMinor / 100;
                  const cgst = (line.components.find(c => c.code === 'CGST')?.amountMinor ?? 0) / 100;
                  const sgst = (line.components.find(c => c.code === 'SGST')?.amountMinor ?? 0) / 100;
                  const bucket = slabTotals[rate] ??= { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 };
                  bucket.taxable += taxable;
                  bucket.cgst += cgst; bucket.sgst += sgst;
                  bucket.totalGst += line.taxMinor / 100; bucket.gross += line.grossMinor / 100;
                  totalTaxable += taxable; totalCgst += cgst; totalSgst += sgst;
                  totalGstCollected += line.taxMinor / 100;
                }
              }

              return (
                <div className="ezo-detail-card space-y-4">
                  {missingSnapshots > 0 && <p role="alert" className="text-amber-800">Incomplete tax report: {missingSnapshots} legacy bills have no frozen tax snapshot and are excluded. Do not use this as a complete filing export.</p>}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Recorded Tax Summary & Slab Register</h3>
                      <p className="text-xs text-slate-500">Period: {dateFilter.toUpperCase()}</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                      GST B2C Register
                    </span>
                  </div>

                  <div className="ezo-kpi-grid">
                    <div className="ezo-kpi-box">
                      <span className="ezo-kpi-label">Gross Turnover</span>
                      <b className="ezo-kpi-val text-purple-700">₹{totalSales.toFixed(2)}</b>
                      <span className="ezo-kpi-note">{salesEntries.length} Invoices</span>
                    </div>
                    <div className="ezo-kpi-box">
                      <span className="ezo-kpi-label">Net Taxable Value</span>
                      <b className="ezo-kpi-val text-slate-800">₹{totalTaxable.toFixed(2)}</b>
                      <span className="ezo-kpi-note">Base turnover before GST</span>
                    </div>
                    <div className="ezo-kpi-box">
                      <span className="ezo-kpi-label">CGST (Central)</span>
                      <b className="ezo-kpi-val text-purple-600">₹{totalCgst.toFixed(2)}</b>
                      <span className="ezo-kpi-note">50% Central Tax share</span>
                    </div>
                    <div className="ezo-kpi-box">
                      <span className="ezo-kpi-label">SGST (State)</span>
                      <b className="ezo-kpi-val text-purple-600">₹{totalSgst.toFixed(2)}</b>
                      <span className="ezo-kpi-note">50% State Tax share</span>
                    </div>
                  </div>

                  <div className="ezo-table-wrap">
                    <h3 className="ezo-table-heading">GST Slab-wise Breakdown</h3>
                    <table className="ezo-table">
                      <thead>
                        <tr>
                          <th>Rate Slab</th>
                          <th className="text-right">Taxable Value (₹)</th>
                          <th className="text-right">CGST (₹)</th>
                          <th className="text-right">SGST (₹)</th>
                          <th className="text-right">Total GST (₹)</th>
                          <th className="text-right">Invoice Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 5, 12, 18, 28].map((slab) => {
                          const data = slabTotals[slab] || {
                            taxable: 0,
                            cgst: 0,
                            sgst: 0,
                            totalGst: 0,
                            gross: 0,
                          };
                          return (
                            <tr key={slab} className={data.gross > 0 ? 'font-semibold' : 'text-slate-400'}>
                              <td>
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                                  GST {slab}% {slab === 0 ? '(Exempt)' : ''}
                                </span>
                              </td>
                              <td className="text-right">₹{data.taxable.toFixed(2)}</td>
                              <td className="text-right">₹{data.cgst.toFixed(2)}</td>
                              <td className="text-right">₹{data.sgst.toFixed(2)}</td>
                              <td className="text-right text-purple-700 font-bold">₹{data.totalGst.toFixed(2)}</td>
                              <td className="text-right font-bold text-slate-900">₹{data.gross.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold bg-slate-50">
                          <td>Total</td>
                          <td className="text-right">₹{totalTaxable.toFixed(2)}</td>
                          <td className="text-right">₹{totalCgst.toFixed(2)}</td>
                          <td className="text-right">₹{totalSgst.toFixed(2)}</td>
                          <td className="text-right text-purple-700">₹{totalGstCollected.toFixed(2)}</td>
                          <td className="text-right text-purple-700">₹{totalSales.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <button
                    onClick={() =>
                      handleExportCSV(
                        missingSnapshots ? 'INCOMPLETE_Tax_Snapshot_Report' : 'Tax_Snapshot_Report',
                        ['GST Slab Rate', 'Taxable Value', 'CGST', 'SGST', 'Total GST', 'Gross Invoice Value'],
                        [0, 5, 12, 18, 28].map((slab) => {
                          const d = slabTotals[slab] || {
                            taxable: 0,
                            cgst: 0,
                            sgst: 0,
                            totalGst: 0,
                            gross: 0,
                          };
                          return [
                            `GST ${slab}%`,
                            d.taxable.toFixed(2),
                            d.cgst.toFixed(2),
                            d.sgst.toFixed(2),
                            d.totalGst.toFixed(2),
                            d.gross.toFixed(2),
                          ];
                        })
                      )
                    }
                    className="ezo-outline-card-btn text-xs py-2"
                  >
                    <Download className="w-4 h-4 mr-1.5 inline" />
                    Export Tax Snapshot CSV
                  </button>
                </div>
              );
            })()}

            {/* 1.2 Day Book & 5.1 Cut Off Day Report */}
            {(selectedReport === '1.2' || selectedReport === '5.1') && (
              <div className="ezo-detail-card space-y-4">
                <div className="ezo-closing-summary-box">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">
                    {selectedReport === '5.1'
                      ? 'Cut Off Day Reconciliation (Shift End)'
                      : 'Day Book Cash Flow Register'}
                  </h3>
                  <div className="ezo-drawer-calc-list">
                    <div className="ezo-calc-item">
                      <span>Opening Cash in Drawer</span>
                      <b>₹{openingCash.toFixed(2)}</b>
                    </div>
                    <div className="ezo-calc-item text-emerald-600">
                      <span>+ Cash Sales Collected</span>
                      <b>+₹{cashSales.toFixed(2)}</b>
                    </div>
                    <div className="ezo-calc-item text-blue-600">
                      <span>+ Money In (Customer Dues Collected)</span>
                      <b>+₹{moneyInCash.toFixed(2)}</b>
                    </div>
                    <div className="ezo-calc-item text-rose-600">
                      <span>- Money Out (Supplier Payments & Expenses)</span>
                      <b>
                        -₹
                        {(
                          moneyOutCash +
                          entries
                            .filter((e) => e.type === 'expense' && e.paymentMode === 'cash')
                            .reduce((sum, e) => sum + e.amount, 0)
                        ).toFixed(2)}
                      </b>
                    </div>
                    <div className="ezo-calc-item font-bold text-slate-900 border-t pt-2 mt-1">
                      <span>Expected Cash in Drawer</span>
                      <b className="text-purple-700">₹{expectedCashInDrawer.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                <div className="ezo-tally-form bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Counted Cash in Cash Register (₹)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="e.g. 5200"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                      className="ezo-field-input bg-white flex-1"
                    />
                    <button
                      disabled={!countedCash}
                      onClick={handleCloseDay}
                      className="ezo-btn-primary px-4"
                    >
                      Close Day
                    </button>
                  </div>

                  {closingDone && (
                    <div className="ezo-closing-success-card mt-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" />
                      <div>
                        <b>Day Closed Successfully at {closingDone.closedAt}!</b>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Counted: ₹{closingDone.actualCountedCash.toFixed(2)} | Variance:{' '}
                          <span
                            className={
                              closingDone.variance >= 0
                                ? 'text-emerald-600 font-bold'
                                : 'text-rose-600 font-bold'
                            }
                          >
                            {closingDone.variance >= 0 ? '+' : ''}₹{closingDone.variance.toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={handlePrintSlip} className="ezo-outline-card-btn py-2 text-xs">
                  <Printer className="w-4 h-4 mr-2 inline" />
                  Print Z-Report Thermal Slip
                </button>
              </div>
            )}

            {/* 2.1 Sale Report - WITH EXPANDABLE INVOICE ITEM BREAKDOWN */}
            {selectedReport === '2.1' && (
              <div className="ezo-detail-card space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Sale Invoices ({filteredSaleEntries.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total: <span className="font-bold text-purple-700">₹{totalSales.toFixed(2)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleExportCSV(
                        'Sales_Register',
                        ['Invoice No', 'Date', 'Customer/Desc', 'Payment Mode', 'Items Count', 'Amount'],
                        salesEntries.map((s) => [
                          s.referenceNo || s.id,
                          new Date(s.timestamp).toLocaleString('en-IN'),
                          s.description || 'Walk-in',
                          s.paymentMode,
                          s.lines?.length || 1,
                          s.amount,
                        ])
                      )
                    }
                    className="text-xs text-purple-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by Bill No, Customer, Item name, Amount..."
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-purple-600 outline-none"
                  />
                </div>

                {filteredSaleEntries.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No sale invoices found for this period.</p>
                ) : (
                  <div className="space-y-2.5">
                    {filteredSaleEntries.map((tx) => {
                      const isExpanded = expandedInvoiceId === tx.id;
                      const hasLines = Boolean(tx.lines && tx.lines.length > 0);

                      return (
                        <div
                          key={tx.id}
                          className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm transition-all hover:border-purple-300"
                        >
                          {/* Invoice Card Header (Click to Expand) */}
                          <div
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : tx.id)}
                            className="p-3 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  {tx.referenceNo || 'BILL'}
                                </span>
                                <span className="font-semibold text-slate-800 text-sm truncate">
                                  {tx.description || 'Walk-in Customer'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                <span>{new Date(tx.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                <span>•</span>
                                <span
                                  className={`uppercase font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                    tx.paymentMode === 'cash'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : tx.paymentMode === 'upi'
                                      ? 'bg-blue-50 text-blue-700'
                                      : tx.paymentMode === 'credit'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-purple-50 text-purple-700'
                                  }`}
                                >
                                  {tx.paymentMode}
                                </span>
                                {hasLines && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-600 font-medium">
                                      {tx.lines!.length} {tx.lines!.length === 1 ? 'item' : 'items'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-2.5">
                              <div>
                                <span className="font-bold text-purple-900 text-base block">
                                  ₹{tx.amount.toFixed(2)}
                                </span>
                              </div>
                              <button
                                className="p-1 text-slate-400 hover:text-purple-700 rounded-full hover:bg-purple-50"
                                aria-label="Toggle details"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-purple-700" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Item Breakdown Details */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/80 p-3 space-y-3 animate-fadeIn">
                              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span>Item Breakdown & Quantities</span>
                                <span className="text-[11px] text-slate-500 font-normal">
                                  {hasLines ? `${tx.lines!.length} lines billed` : '1 lump sum item'}
                                </span>
                              </div>

                              <p className="text-xs">{tx.taxSnapshot
                                ? `Recorded GST: ₹${(tx.taxSnapshot.taxMinor / 100).toFixed(2)} · ${tx.taxSnapshot.componentTotals.map(c => `${c.code} ₹${(c.amountMinor / 100).toFixed(2)}`).join(' · ')}`
                                : 'Original tax details unavailable for this legacy bill.'}</p>
                              {hasLines ? (
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                                      <tr>
                                        <th className="p-2">Item</th>
                                        <th className="p-2 text-center">Qty</th>
                                        <th className="p-2 text-right">Rate</th>
                                        <th className="p-2 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {tx.lines!.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                          <td className="p-2">
                                            <div className="font-medium text-slate-800">{line.name}</div>
                                            {line.category && (
                                              <span className="text-[10px] text-slate-400">{line.category}</span>
                                            )}
                                          </td>
                                          <td className="p-2 text-center font-semibold text-slate-700">
                                            {line.quantity} {line.uom || 'pcs'}
                                          </td>
                                          <td className="p-2 text-right text-slate-600">₹{line.price.toFixed(2)}</td>
                                          <td className="p-2 text-right font-bold text-slate-900">
                                            ₹{((line.netMinor !== undefined ? line.netMinor / 100 : line.price * line.quantity)).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 flex justify-between">
                                  <span>{tx.description}</span>
                                  <span className="font-bold text-slate-900">₹{tx.amount.toFixed(2)}</span>
                                </div>
                              )}

                              {/* Action Buttons for this Invoice */}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => handlePrintInvoice(tx)}
                                  className="flex-1 py-1.5 px-3 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Print Receipt
                                </button>
                                <button
                                  onClick={() => handleShareInvoice(tx)}
                                  className="py-1.5 px-3 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  WhatsApp
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2.2 Staff Wise Sale Report */}
            {selectedReport === '2.2' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Staff Wise Sale Performance</h3>
                <div className="ezo-table-wrap">
                  <table className="ezo-table">
                    <thead>
                      <tr>
                        <th>Staff / Role</th>
                        <th className="text-center">Invoices</th>
                        <th className="text-right">Sales Amount</th>
                        <th className="text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <b className="text-slate-800">Main Cashier (Owner)</b>
                          <div className="text-xs text-slate-400">Terminal 1</div>
                        </td>
                        <td className="text-center font-semibold">{salesEntries.length}</td>
                        <td className="text-right font-bold text-purple-700">₹{totalSales.toFixed(2)}</td>
                        <td className="text-right font-semibold">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2.3 Sale Wise Profit And Loss */}
            {selectedReport === '2.3' && (
              <div className="ezo-detail-card space-y-4">
                <h3 className="font-bold text-slate-800 text-sm">Gross Margin & Operating Profitability</h3>
                <div className="ezo-kpi-grid">
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Total Revenue</span>
                    <b className="ezo-kpi-val text-purple-700">₹{totalSales.toFixed(2)}</b>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Estimated COGS (~70%)</span>
                    <b className="ezo-kpi-val text-slate-700">₹{(totalSales * 0.7).toFixed(2)}</b>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Gross Margin (~30%)</span>
                    <b className="ezo-kpi-val text-emerald-600">₹{(totalSales * 0.3).toFixed(2)}</b>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Store Operating Expenses</span>
                    <b className="ezo-kpi-val text-rose-600">₹{expensesTotal.toFixed(2)}</b>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 flex justify-between items-center">
                  <div>
                    <span className="font-bold block text-sm">Estimated Net Profit</span>
                    <span className="text-[11px] text-purple-700">Gross Margin - Recorded Operating Expenses</span>
                  </div>
                  <span className="text-lg font-extrabold text-purple-900">
                    ₹{Math.max(0, totalSales * 0.3 - expensesTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* 2.4 Purchase Report */}
            {selectedReport === '2.4' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Vendor Purchases & Inward Goods</h3>
                <p className="text-xs text-slate-500">Record supplier purchase bills to track exact COGS and margin.</p>
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Use 'Items & Products' stock inward to record new supplier consignments.</p>
                </div>
              </div>
            )}

            {/* 2.5 Money In Report */}
            {selectedReport === '2.5' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">2.5 Money In Report (Udhar Collected)</h3>
                {entries.filter((e) => e.type === 'money_in').length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No money in transactions recorded in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {entries
                      .filter((e) => e.type === 'money_in')
                      .map((entry) => (
                        <div key={entry.id} className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                          <div>
                            <b className="text-slate-800 text-xs block">{entry.description}</b>
                            <span className="text-[11px] text-slate-400">
                              {new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} • Mode: {entry.paymentMode.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-bold text-emerald-600 text-sm">+₹{entry.amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 2.6 Money Out Report */}
            {selectedReport === '2.6' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">2.6 Money Out Report</h3>
                {entries.filter((e) => e.type === 'money_out').length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No money out transactions recorded in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {entries
                      .filter((e) => e.type === 'money_out')
                      .map((entry) => (
                        <div key={entry.id} className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                          <div>
                            <b className="text-slate-800 text-xs block">{entry.description}</b>
                            <span className="text-[11px] text-slate-400">
                              {new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} • Mode: {entry.paymentMode.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-bold text-rose-600 text-sm">-₹{entry.amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 2.7 Expense Report */}
            {selectedReport === '2.7' && (
              <div className="ezo-detail-card space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">2.7 Expense Report</h3>
                  <span className="text-xs font-bold text-rose-600">Total: ₹{expensesTotal.toFixed(2)}</span>
                </div>
                {entries.filter((e) => e.type === 'expense').length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No expense entries recorded in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {entries
                      .filter((e) => e.type === 'expense')
                      .map((entry) => (
                        <div key={entry.id} className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                          <div>
                            <b className="text-slate-800 text-xs block">{entry.description}</b>
                            <span className="text-[11px] text-slate-400">
                              {new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <span className="font-bold text-rose-600 text-sm">₹{entry.amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 2.8 Estimate Report */}
            {selectedReport === '2.8' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Held Orders & Quotations ({heldBills.length})</h3>
                {!heldBills.length ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No held orders. Use HOLD in billing screen to save temporary drafts.</p>
                ) : (
                  <div className="space-y-2">
                    {heldBills.map((bill) => (
                      <div key={bill.id} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                        <div>
                          <b className="text-slate-800 text-xs block">{bill.customerName || 'Held Customer'}</b>
                          <span className="text-[11px] text-slate-400">{bill.lines.length} items</span>
                        </div>
                        <span className="font-bold text-purple-700 text-sm">
                          ₹{bill.lines.reduce((s, l) => s + l.price * l.quantity, 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3.1 Party Ledger */}
            {selectedReport === '3.1' && (
              <div className="ezo-detail-card space-y-3">
                <div className="ezo-kpi-grid">
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Customer Receivables</span>
                    <b className="ezo-kpi-val text-rose-600">₹{totalReceivable.toFixed(2)}</b>
                    <span className="ezo-kpi-note">{customers.filter((c) => c.balance > 0).length} parties pending</span>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Supplier Payables</span>
                    <b className="ezo-kpi-val text-amber-600">₹{totalPayable.toFixed(2)}</b>
                    <span className="ezo-kpi-note">{suppliers.filter((s) => s.balance < 0).length} suppliers to pay</span>
                  </div>
                </div>

                <div className="ezo-tx-list">
                  {parties.map((p) => (
                    <div key={p.id} className="ezo-tx-item flex justify-between items-center">
                      <div>
                        <b className="text-slate-800 text-sm">{p.name}</b>
                        <p className="text-xs text-slate-500">
                          {p.phone} · <span className="capitalize">{p.type}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-bold block ${
                            p.balance > 0
                              ? 'text-rose-600'
                              : p.balance < 0
                              ? 'text-emerald-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {p.balance > 0
                            ? `Due: ₹${p.balance.toFixed(2)}`
                            : p.balance < 0
                            ? `Adv: ₹${Math.abs(p.balance).toFixed(2)}`
                            : 'Settled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3.2 Party Receivable/Payable Report */}
            {selectedReport === '3.2' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Aging Analysis of Outstanding Credit</h3>
                <div className="ezo-tx-list mt-3">
                  {customers
                    .filter((c) => c.balance > 0)
                    .map((c) => (
                      <div key={c.id} className="ezo-tx-item flex justify-between items-center">
                        <div>
                          <b className="text-slate-800 text-sm">{c.name}</b>
                          <div className="text-xs text-slate-500">{c.phone}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <b className="text-rose-600 font-mono text-sm">₹{c.balance.toFixed(2)}</b>
                          <a
                            href={buildWhatsAppReminderUrl(c, profileName, `${phone}@upi`)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100"
                            title="WhatsApp Reminder"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 3.3 Party Details Report */}
            {selectedReport === '3.3' && (
              <div className="ezo-detail-card space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm">Party Master Directory ({parties.length})</h3>
                  <button
                    onClick={() =>
                      handleExportCSV(
                        'Parties_Directory',
                        ['Name', 'Phone', 'Type', 'Balance'],
                        parties.map((p) => [p.name, p.phone, p.type, p.balance])
                      )
                    }
                    className="text-xs text-purple-700 font-semibold hover:underline"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="ezo-table-wrap">
                  <table className="ezo-table">
                    <thead>
                      <tr>
                        <th>Party Name</th>
                        <th>Phone</th>
                        <th>Type</th>
                        <th className="text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties.map((p) => (
                        <tr key={p.id}>
                          <td className="font-semibold text-slate-800">{p.name}</td>
                          <td className="text-slate-600">{p.phone}</td>
                          <td className="capitalize text-slate-500">{p.type}</td>
                          <td
                            className={`text-right font-bold ${
                              p.balance > 0
                                ? 'text-rose-600'
                                : p.balance < 0
                                ? 'text-emerald-600'
                                : 'text-slate-500'
                            }`}
                          >
                            ₹{p.balance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.1 Stock Summary Report */}
            {selectedReport === '4.1' && (
              <div className="ezo-detail-card space-y-3">
                <div className="ezo-kpi-grid">
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Stock Valuation</span>
                    <b className="ezo-kpi-val text-purple-700">₹{inventoryValuation.toFixed(2)}</b>
                    <span className="ezo-kpi-note">{displayItems.length} SKUs total</span>
                  </div>
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Low Stock Alerts</span>
                    <b className="ezo-kpi-val text-rose-600">{lowStockCount}</b>
                    <span className="ezo-kpi-note">Items below threshold</span>
                  </div>
                </div>

                <div className="ezo-table-wrap">
                  <table className="ezo-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th className="text-right">Rate</th>
                        <th className="text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <b className="text-slate-800">{item.name}</b>
                            <div className="text-xs text-slate-400">{item.code}</div>
                          </td>
                          <td className="text-slate-500">{item.categoryName}</td>
                          <td className="text-right font-medium">
                            ₹{(item.priceMinor / 100).toFixed(2)}/{item.uom}
                          </td>
                          <td className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                (item.stockQty ?? 0) <= 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : (item.stockQty ?? 0) < 10
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {item.stockQty ?? 0} {item.uom}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.2 Item Sale Report - ENHANCED WITH RANKING & QUANTITIES */}
            {selectedReport === '4.2' && (
              <div className="ezo-detail-card space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      4.2 Item Sale Report ({filteredItemWiseSales.length} Products)
                    </h3>
                    <p className="text-xs text-slate-500">Ranked by total sales volume & revenue</p>
                  </div>
                  <button
                    onClick={() =>
                      handleExportCSV(
                        'Item_Sales_Report',
                        ['Rank', 'Item Name', 'Category', 'Quantity Sold', 'UOM', 'Total Revenue'],
                        filteredItemWiseSales.map((item, idx) => [
                          idx + 1,
                          item.name,
                          item.category,
                          item.quantity,
                          item.uom,
                          item.revenue,
                        ])
                      )
                    }
                    className="text-xs text-purple-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search product or category..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-purple-600 outline-none"
                  />
                </div>

                {filteredItemWiseSales.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No item sales recorded in this period.</p>
                ) : (
                  <div className="ezo-table-wrap">
                    <table className="ezo-table">
                      <thead>
                        <tr>
                          <th className="w-8">#</th>
                          <th>Product Name</th>
                          <th className="text-center">Qty Sold</th>
                          <th className="text-right">Revenue (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItemWiseSales.map((item, idx) => (
                          <tr key={idx} className="hover:bg-purple-50/50">
                            <td className="font-bold text-slate-400 text-xs">{idx + 1}</td>
                            <td>
                              <b className="text-slate-800 text-xs block">{item.name}</b>
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium inline-block mt-0.5">
                                {item.category}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded">
                                {item.quantity} {item.uom}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className="font-bold text-purple-900 text-xs">
                                ₹{item.revenue.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4.2.1 Item Category wise Sale Report - ENHANCED */}
            {selectedReport === '4.2.1' && (
              <div className="ezo-detail-card space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      4.2.1 Category / Counter-wise Sales ({categoryWiseSales.length} Categories)
                    </h3>
                    <p className="text-xs text-slate-500">Department contribution & revenue share</p>
                  </div>
                  <button
                    onClick={() =>
                      handleExportCSV(
                        'Category_Sales_Report',
                        ['Category', 'Total Revenue', 'Units Sold', 'Orders Count', 'Share %'],
                        categoryWiseSales.map((c) => [
                          c.category,
                          c.revenue,
                          c.totalQty,
                          c.ordersCount,
                          totalSales > 0 ? ((c.revenue / totalSales) * 100).toFixed(1) + '%' : '0%',
                        ])
                      )
                    }
                    className="text-xs text-purple-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>

                {categoryWiseSales.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No category sales recorded in this period.</p>
                ) : (
                  <div className="space-y-3">
                    {categoryWiseSales.map((cat, idx) => {
                      const sharePercent = totalSales > 0 ? (cat.revenue / totalSales) * 100 : 0;
                      const isCatExpanded = expandedCategory === cat.category;

                      return (
                        <div
                          key={idx}
                          className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm"
                        >
                          <div
                            onClick={() => setExpandedCategory(isCatExpanded ? null : cat.category)}
                            className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <b className="text-slate-800 text-sm block">{cat.category}</b>
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                  <span>{cat.totalQty} units sold</span>
                                  <span>•</span>
                                  <span>{cat.ordersCount} bill lines</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-purple-900 text-sm block">
                                  ₹{cat.revenue.toFixed(2)}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-600">
                                  {sharePercent.toFixed(1)}% share
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(5, sharePercent))}%` }}
                              />
                            </div>
                          </div>

                          {/* Expanded products within this category */}
                          {isCatExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/70 p-3 space-y-2">
                              <span className="text-[11px] font-bold text-slate-600 block">
                                Top Products in {cat.category}
                              </span>
                              <div className="space-y-1.5">
                                {cat.items.map((prod, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center text-xs"
                                  >
                                    <span className="font-medium text-slate-800">{prod.name}</span>
                                    <div className="text-right">
                                      <span className="font-bold text-slate-900 block">
                                        ₹{prod.revenue.toFixed(2)}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {prod.qty} {prod.uom}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4.3 Item Report */}
            {selectedReport === '4.3' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Catalog Master Price List</h3>
                <div className="ezo-table-wrap">
                  <table className="ezo-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Code</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">GST Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item) => (
                        <tr key={item.id}>
                          <td className="font-semibold text-slate-800">{item.name}</td>
                          <td className="font-mono text-xs text-slate-500">{item.code}</td>
                          <td className="text-right font-bold text-purple-700">
                            ₹{(item.priceMinor / 100).toFixed(2)}
                          </td>
                          <td className="text-right text-slate-600">{item.gstRate ?? 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4.4 Item Details Report */}
            {selectedReport === '4.4' && (
              <div className="ezo-detail-card space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Item Movement & SKU Ledger</h3>
                <div className="ezo-tx-list">
                  {displayItems.slice(0, 10).map((item) => (
                    <div key={item.id} className="ezo-tx-item flex justify-between items-center">
                      <div>
                        <b className="text-slate-800 text-sm">{item.name}</b>
                        <div className="text-xs text-slate-500">
                          Category: {item.categoryName} · SKU: {item.code || 'N/A'}
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">
                        Stock: {item.stockQty ?? 0} {item.uom}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
