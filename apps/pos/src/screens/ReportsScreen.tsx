import { showPrintPreview } from '../components/PrintPreview';
import { summarizeSales } from '../lib/business';
import { useBackHandler } from '../lib/navigation';
import React, { useState } from 'react';
import {
  ArrowLeft,
  FileText,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Download,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Users,
  Package,
  Clock,
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import {
  DayBookEntry,
  filterEntriesByPeriod,
  loadDayBookEntries,
  getOpeningCash,
  setOpeningCash,
  saveDayClosing,
  loadClosings,
  type DayClosingReport,
} from '../lib/dayBook';
import { loadParties, type Party, buildWhatsAppReminderUrl } from '../lib/khata';
import { printTestSlipViaBrowser, printReceiptViaBrowser, type BillData } from '../lib/thermalPrinter';
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
      { code: '2.1', title: '2.1 Sale Report', subtitle: 'Detailed Bill-by-Bill Sales Transaction Register' },
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
      { code: '4.2', title: '4.2 Item Sale Report', subtitle: 'Top Selling Products Ranked by Quantity & Volume' },
      { code: '4.2.1', title: '4.2.1 Item Category wise Sale Report', subtitle: 'Department & Category Revenue Contribution' },
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
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useBackHandler(Boolean(selectedReport), () => setSelectedReport(null));

  // DayBook & Financial Data
  const [allEntries, setEntries] = useState<DayBookEntry[]>(loadDayBookEntries());
  const [closings, setClosings] = useState<DayClosingReport[]>(loadClosings());
  const [openingCash, setOpeningCashState] = useState<number>(getOpeningCash());
  const [countedCash, setCountedCash] = useState<string>('');
  const [closingDone, setClosingDone] = useState<DayClosingReport | null>(null);
  const [parties, setParties] = useState<Party[]>(loadParties());

  const entries = filterEntriesByPeriod(allEntries, selectedReport === '5.1' ? 'today' : dateFilter);
  // Aggregate stats
  const salesEntries = entries.filter((e) => e.type === 'sale');
  const cashSales = entries
    .filter((e) => e.type === 'sale' && e.paymentMode === 'cash')
    .reduce((s, e) => s + e.amount, 0);
  const upiSales = entries
    .filter((e) => e.type === 'sale' && e.paymentMode === 'upi')
    .reduce((s, e) => s + e.amount, 0);
  const cardSales = entries
    .filter((e) => e.type === 'sale' && e.paymentMode === 'card')
    .reduce((s, e) => s + e.amount, 0);
  const creditSales = entries
    .filter((e) => e.type === 'sale' && e.paymentMode === 'credit')
    .reduce((s, e) => s + e.amount, 0);
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

  const expectedCashInDrawer = openingCash + cashSales + (moneyInCash || 0) - (moneyOutCash + entries.filter(e => e.type === 'expense' && e.paymentMode === 'cash').reduce((sum, e) => sum + e.amount, 0));

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
  const productSummary = summarizeSales(salesEntries.map(entry => ({ date: new Date().toLocaleDateString('en-IN'), total: entry.amount, paymentMode: entry.paymentMode, lines: entry.lines || [] })), new Date()).today;
  const heldBills: { id: string; customerName: string; lines: { price: number; quantity: number }[] }[] = (() => {
    try { return JSON.parse(localStorage.getItem('novapos:held_bills') || '[]'); } catch { return []; }
  })();

  // Total inventory valuation
  const inventoryValuation = displayItems.reduce((acc, i) => acc + ((i.priceMinor / 100) * (i.stockQty ?? 0)), 0);
  const lowStockCount = displayItems.filter((i) => (i.stockQty ?? 0) < 10).length;

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
    showPrintPreview(`<html><head><title>NovaPOS report</title><style>body{font:14px sans-serif;padding:16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}button,select{display:none}</style></head><body>${section.innerHTML}</body></html>`);
  };

  const handleExportCSV = (reportName: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeReport = REPORT_MENU.flatMap((g) => g.items).find((i) => i.code === selectedReport);
  const activeReportTitle = activeReport?.title || 'Report';

  return (
    <div className="ezo-screen-container">
      {/* Top Ezo Purple App Bar */}
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
          <ArrowLeft className="w-6 h-6 text-white" /><span>Back</span></button>
        <div className="ezo-title-group">
          <h1 className="ezo-bar-title">{selectedReport ? activeReportTitle : 'Reports'}</h1>
          <span className="ezo-bar-sub">FAST v39.31 {phone ? `| +91 ${phone}` : ''}</span>
        </div>
      </div>

      {/* Screen Body */}
      <div className="ezo-screen-scroll">
        {!selectedReport ? (
          /* Report Catalog List View (Exact Match to Screenshots 3 & 4) */
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
                      {/* Exact Gold/Yellow Document Icon from Ezo */}
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
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Detail Report View for All 18 Reports */
          <div className="ezo-report-detail-container space-y-4">
            {/* Top Date Filter & Export Bar */}
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex gap-1.5">
                {(['today', 'week', 'month', 'all'] as const).map((df) => (
                  <button
                    key={df}
                    onClick={() => setDateFilter(df)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md capitalize transition-colors ${
                      dateFilter === df
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {df}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  title="Print Thermal Slip"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1.1 Business Report */}
            {selectedReport === '1.1' && (
              <div className="ezo-detail-card space-y-4">
                <div className="ezo-kpi-grid">
                  <div className="ezo-kpi-box">
                    <span className="ezo-kpi-label">Total Revenue</span>
                    <b className="ezo-kpi-val text-indigo-600">₹{totalSales.toFixed(2)}</b>
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
                        <td className="text-right">{totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td>UPI / Dynamic QR</td>
                        <td className="text-right font-medium">₹{upiSales.toFixed(2)}</td>
                        <td className="text-right">{totalSales > 0 ? Math.round((upiSales / totalSales) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td>Card (POS Terminal)</td>
                        <td className="text-right font-medium">₹{cardSales.toFixed(2)}</td>
                        <td className="text-right">{totalSales > 0 ? Math.round((cardSales / totalSales) * 100) : 0}%</td>
                      </tr>
                      <tr>
                        <td>Khata Credit</td>
                        <td className="text-right font-medium">₹{creditSales.toFixed(2)}</td>
                        <td className="text-right">{totalSales > 0 ? Math.round((creditSales / totalSales) * 100) : 0}%</td>
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
                      ],
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
              const slabTotals: Record<number, { taxable: number; cgst: number; sgst: number; totalGst: number; gross: number }> = {
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

              for (const sale of salesEntries) {
                if (sale.lines && sale.lines.length > 0) {
                  for (const line of sale.lines) {
                    const matched = displayItems.find(i => i.id === line.itemId || i.name.toLowerCase() === line.name.toLowerCase());
                    const rate = matched?.gstRate !== undefined ? matched.gstRate : 5;
                    const lineGross = line.price * line.quantity;
                    const taxable = rate > 0 ? (lineGross / (1 + rate / 100)) : lineGross;
                    const tax = lineGross - taxable;
                    const halfTax = tax / 2;

                    if (!slabTotals[rate]) {
                      slabTotals[rate] = { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 };
                    }
                    slabTotals[rate].taxable += taxable;
                    slabTotals[rate].cgst += halfTax;
                    slabTotals[rate].sgst += halfTax;
                    slabTotals[rate].totalGst += tax;
                    slabTotals[rate].gross += lineGross;

                    totalTaxable += taxable;
                    totalCgst += halfTax;
                    totalSgst += halfTax;
                    totalGstCollected += tax;
                  }
                } else {
                  const rate = 5;
                  const lineGross = sale.amount;
                  const taxable = lineGross / 1.05;
                  const tax = lineGross - taxable;
                  const halfTax = tax / 2;
                  slabTotals[rate].taxable += taxable;
                  slabTotals[rate].cgst += halfTax;
                  slabTotals[rate].sgst += halfTax;
                  slabTotals[rate].totalGst += tax;
                  slabTotals[rate].gross += lineGross;
                  totalTaxable += taxable;
                  totalCgst += halfTax;
                  totalSgst += halfTax;
                  totalGstCollected += tax;
                }
              }

              return (
                <div className="ezo-detail-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">GSTR-1 Tax Summary & Slab Register</h3>
                      <p className="text-xs text-slate-500">Period: {dateFilter.toUpperCase()}</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                      GST B2C Register
                    </span>
                  </div>

                  <div className="ezo-kpi-grid">
                    <div className="ezo-kpi-box">
                      <span className="ezo-kpi-label">Gross Turnover</span>
                      <b className="ezo-kpi-val text-indigo-600">₹{totalSales.toFixed(2)}</b>
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
                        {[0, 5, 12, 18, 28].map(slab => {
                          const data = slabTotals[slab] || { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 };
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
                          <td className="text-right text-indigo-700">₹{totalSales.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <button
                    onClick={() =>
                      handleExportCSV(
                        'GSTR1_Tax_Report',
                        ['GST Slab Rate', 'Taxable Value', 'CGST', 'SGST', 'Total GST', 'Gross Invoice Value'],
                        [0, 5, 12, 18, 28].map(slab => {
                          const d = slabTotals[slab] || { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, gross: 0 };
                          return [`GST ${slab}%`, d.taxable.toFixed(2), d.cgst.toFixed(2), d.sgst.toFixed(2), d.totalGst.toFixed(2), d.gross.toFixed(2)];
                        })
                      )
                    }
                    className="ezo-outline-card-btn text-xs py-2"
                  >
                    <Download className="w-4 h-4 mr-1.5 inline" />
                    Export GSTR-1 Tax Summary CSV
                  </button>
                </div>
              );
            })()}

            {/* 1.2 Day Book & 5.1 Cut Off Day Report */}
            {(selectedReport === '1.2' || selectedReport === '5.1') && (
              <div className="ezo-detail-card space-y-4">
                <div className="ezo-closing-summary-box">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">
                    {selectedReport === '5.1' ? 'Cut Off Day Reconciliation (Shift End)' : 'Day Book Cash Flow Register'}
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
                      <b>-₹{(moneyOutCash + entries.filter(e => e.type === 'expense' && e.paymentMode === 'cash').reduce((sum, e) => sum + e.amount, 0)).toFixed(2)}</b>
                    </div>
                    <div className="ezo-calc-item font-bold text-slate-900 border-t pt-2 mt-1">
                      <span>Expected Cash in Drawer</span>
                      <b className="text-indigo-600">₹{expectedCashInDrawer.toFixed(2)}</b>
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
                              closingDone.variance >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'
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

            {/* 2.1 Sale Report */}
            {selectedReport === '2.1' && (
              <div className="ezo-detail-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">Sale Invoices ({salesEntries.length})</h3>
                  <span className="text-xs font-bold text-indigo-600">Total: ₹{totalSales.toFixed(2)}</span>
                </div>
                {salesEntries.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">No sale invoices generated yet today.</p>
                ) : (
                  <div className="ezo-tx-list">
                    {salesEntries.map((tx) => (
                      <div key={tx.id} className="ezo-tx-item flex justify-between items-center">
                        <div>
                          <b className="text-slate-800 text-sm">{tx.description || 'Walk-in Customer'}</b>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {new Date(tx.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} •{' '}
                            <span className="uppercase font-semibold text-indigo-600">{tx.paymentMode}</span>
                          </div>
                        </div>
                        <span className="font-bold text-indigo-600 text-base">₹{tx.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedReport === '2.2' && <div className="ezo-detail-card"><h3>Current device / cashier</h3><p>{salesEntries.length} bills · ₹{totalSales.toFixed(2)}</p><p className="text-sm text-slate-500">Individual staff attribution is not recorded by local billing.</p></div>}

            {selectedReport === '2.3' && <div className="ezo-detail-card"><h3>Profit & Loss</h3><p>Sales: ₹{totalSales.toFixed(2)}</p><p>Recorded expenses: ₹{expensesTotal.toFixed(2)}</p><p className="text-sm text-slate-500">Profit cannot be calculated until purchase costs are recorded.</p></div>}

            {selectedReport === '2.4' && <div className="ezo-detail-card"><h3>Purchases</h3><p>Purchase invoices are not connected in this version.</p></div>}

            {selectedReport === '2.5' && <div className="ezo-detail-card space-y-3"><h3>2.5 Money In Report</h3>{entries.filter(entry => entry.type === 'money_in').length === 0 && <p>No recorded entries in this period.</p>}{entries.filter(entry => entry.type === 'money_in').map(entry => <div className="flex justify-between gap-3" key={entry.id}><span>{entry.description} ({entry.paymentMode})</span><b>₹{entry.amount.toFixed(2)}</b></div>)}</div>}

            {selectedReport === '2.6' && <div className="ezo-detail-card space-y-3"><h3>2.6 Money Out Report</h3>{entries.filter(entry => entry.type === 'money_out').length === 0 && <p>No recorded entries in this period.</p>}{entries.filter(entry => entry.type === 'money_out').map(entry => <div className="flex justify-between gap-3" key={entry.id}><span>{entry.description} ({entry.paymentMode})</span><b>₹{entry.amount.toFixed(2)}</b></div>)}</div>}

            {selectedReport === '2.7' && <div className="ezo-detail-card space-y-3"><h3>2.7 Expense Report</h3>{entries.filter(entry => entry.type === 'expense').length === 0 && <p>No recorded entries in this period.</p>}{entries.filter(entry => entry.type === 'expense').map(entry => <div className="flex justify-between gap-3" key={entry.id}><span>{entry.description} ({entry.paymentMode})</span><b>₹{entry.amount.toFixed(2)}</b></div>)}</div>}

            {selectedReport === '2.8' && <div className="ezo-detail-card space-y-3"><h3>Held bills</h3>{!heldBills.length && <p>No held bills. Use Hold in Sale Invoice to save a draft.</p>}{heldBills.map(bill => <div key={bill.id} className="flex justify-between gap-3"><span>{bill.customerName}</span><b>₹{bill.lines.reduce((sum,line)=>sum+line.price*line.quantity,0).toFixed(2)}</b></div>)}</div>}

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
                        <p className="text-xs text-slate-500">{p.phone} · <span className="capitalize">{p.type}</span></p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-bold block ${p.balance > 0 ? 'text-rose-600' : p.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}
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
                <p className="text-sm text-slate-500">Current outstanding balances. Aging by due date is not available.</p>
                <div className="ezo-tx-list mt-3">
                  {customers.filter((c) => c.balance > 0).map((c) => (
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
                        parties.map((p) => [p.name, p.phone, p.type, p.balance]),
                      )
                    }
                    className="text-xs text-indigo-600 font-semibold hover:underline"
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
                          <td className={`text-right font-bold ${p.balance > 0 ? 'text-rose-600' : p.balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
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
                    <b className="ezo-kpi-val text-indigo-600">₹{inventoryValuation.toFixed(2)}</b>
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
                          <td className="text-right font-medium">₹{(item.priceMinor / 100).toFixed(2)}/{item.uom}</td>
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

            {selectedReport === '4.2' && <div className="ezo-detail-card space-y-3"><h3>Top selling products</h3><p className="text-xs text-slate-500">Available for bills saved with item details.</p>{!productSummary.products.length && <p>No item sales recorded in this period.</p>}{productSummary.products.map((item,index) => <div className="flex justify-between gap-3" key={index}><span>{item.name}<small className="block">{item.quantity} {item.uom}</small></span><b>₹{item.revenue.toFixed(2)}</b></div>)}</div>}

            {selectedReport === '4.2.1' && <div className="ezo-detail-card space-y-3"><h3>Sales by category</h3>{!productSummary.categories.length && <p>No category sales recorded in this period.</p>}{productSummary.categories.map(item => <div className="flex justify-between gap-3" key={item.name}><span>{item.name}</span><b>₹{item.revenue.toFixed(2)}</b></div>)}</div>}

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
                          <td className="text-right font-bold text-indigo-600">₹{(item.priceMinor / 100).toFixed(2)}</td>
                          <td className="text-right text-slate-600">5.0%</td>
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
                  <div className="ezo-tx-item flex justify-between items-center">
                    <div>
                      <b className="text-slate-800 text-sm">Kaju Katli (SKU: KAJU)</b>
                      <div className="text-xs text-slate-500">Opening: 60 kg · Inward: 15 kg · Sold: 30 kg</div>
                    </div>
                    <span className="font-bold text-emerald-600">Closing: 45 kg</span>
                  </div>
                  <div className="ezo-tx-item flex justify-between items-center">
                    <div>
                      <b className="text-slate-800 text-sm">Mysore Pak (SKU: MYSORE)</b>
                      <div className="text-xs text-slate-500">Opening: 40 kg · Inward: 10 kg · Sold: 18 kg</div>
                    </div>
                    <span className="font-bold text-emerald-600">Closing: 32 kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
