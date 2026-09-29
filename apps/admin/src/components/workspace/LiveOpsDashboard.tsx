import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  BellOff,
  Plus,
  Printer,
  CheckCircle2,
  Clock,
  ChefHat,
  Utensils,
  Bike,
  AlertCircle,
  Search,
  Check,
  X,
  RefreshCw,
  QrCode,
  DollarSign,
  TrendingUp,
  LayoutGrid,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  Flame,
  ArrowRight
} from 'lucide-react';
import type { AdminApi } from '../../lib/api';
import type { WorkspaceOutlet } from './types';

export interface LiveOpsDashboardProps {
  api: AdminApi;
  outlet: WorkspaceOutlet | null;
  onOpenPunchModal?: () => void;
}

export type OrderStage = 'incoming' | 'preparing' | 'ready' | 'completed';
export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'ZOMATO' | 'SWIGGY' | 'DIRECT';

export interface LiveOrderItem {
  id: string;
  name: string;
  qty: number;
  rateMinor: number;
  station: string;
  notes?: string;
  taxSlab?: string;
}

export interface LiveOrder {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  tableNumber?: string;
  customerName: string;
  customerPhone?: string;
  stage: OrderStage;
  items: LiveOrderItem[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  paymentMode: 'UPI' | 'CASH' | 'CARD' | 'PENDING';
  createdAt: Date;
  prepMinutes: number;
  elapsedSeconds: number;
}

export interface DiningTable {
  id: string;
  code: string;
  name: string;
  section: 'AC Hall' | 'Non-AC' | 'Garden' | 'Rooftop';
  capacity: number;
  status: 'vacant' | 'occupied' | 'billed' | 'reserved';
  currentOrderId?: string;
  currentAmountMinor?: number;
  pax?: number;
}

// Initial Mock Data demonstrating real-time live ops
const INITIAL_ORDERS: LiveOrder[] = [
  {
    id: 'ord-101',
    orderNumber: 'NP-8491',
    channel: 'DINE_IN',
    tableNumber: 'T-04',
    customerName: 'Vikram Sharma',
    customerPhone: '+91 98451 22345',
    stage: 'incoming',
    items: [
      { id: 'item-1', name: 'Hyderabadi Chicken Dum Biryani', qty: 2, rateMinor: 28000, station: 'Biryani Counter' },
      { id: 'item-2', name: 'Butter Naan', qty: 3, rateMinor: 4500, station: 'Tandoor' },
      { id: 'item-3', name: 'Masala Chai', qty: 2, rateMinor: 3000, station: 'Beverages' },
    ],
    subtotalMinor: 75500,
    taxMinor: 3775,
    totalMinor: 79275,
    paymentMode: 'PENDING',
    createdAt: new Date(Date.now() - 45 * 1000),
    prepMinutes: 18,
    elapsedSeconds: 45,
  },
  {
    id: 'ord-102',
    orderNumber: 'NP-8490',
    channel: 'ZOMATO',
    customerName: 'Priya Reddy (Zomato #4812)',
    stage: 'preparing',
    items: [
      { id: 'item-4', name: 'Paneer Butter Masala', qty: 1, rateMinor: 22000, station: 'Curry Station', notes: 'Medium Spicy' },
      { id: 'item-5', name: 'Garlic Naan', qty: 2, rateMinor: 5500, station: 'Tandoor' },
      { id: 'item-6', name: 'Gulab Jamun (2 pcs)', qty: 1, rateMinor: 6000, station: 'Dessert' },
    ],
    subtotalMinor: 39000,
    taxMinor: 1950,
    totalMinor: 40950,
    paymentMode: 'UPI',
    createdAt: new Date(Date.now() - 480 * 1000),
    prepMinutes: 15,
    elapsedSeconds: 480,
  },
  {
    id: 'ord-103',
    orderNumber: 'NP-8489',
    channel: 'DINE_IN',
    tableNumber: 'T-02',
    customerName: 'Karthik Raja',
    stage: 'ready',
    items: [
      { id: 'item-7', name: 'Crispy Corn Pepper Salt', qty: 1, rateMinor: 18000, station: 'Appetizers' },
      { id: 'item-8', name: 'Fresh Lime Soda (Sweet & Salt)', qty: 2, rateMinor: 4500, station: 'Beverages' },
    ],
    subtotalMinor: 27000,
    taxMinor: 1350,
    totalMinor: 28350,
    paymentMode: 'PENDING',
    createdAt: new Date(Date.now() - 850 * 1000),
    prepMinutes: 12,
    elapsedSeconds: 850,
  },
  {
    id: 'ord-104',
    orderNumber: 'NP-8488',
    channel: 'TAKEAWAY',
    customerName: 'Ananya Gupta',
    customerPhone: '+91 98840 99123',
    stage: 'completed',
    items: [
      { id: 'item-9', name: 'Mutton Rogan Josh', qty: 1, rateMinor: 34000, station: 'Curry Station' },
      { id: 'item-10', name: 'Jeera Rice', qty: 1, rateMinor: 14000, station: 'Rice' },
    ],
    subtotalMinor: 48000,
    taxMinor: 2400,
    totalMinor: 50400,
    paymentMode: 'UPI',
    createdAt: new Date(Date.now() - 1500 * 1000),
    prepMinutes: 20,
    elapsedSeconds: 1500,
  },
];

const INITIAL_TABLES: DiningTable[] = [
  { id: 'tbl-1', code: 'T-01', name: 'Table 1', section: 'AC Hall', capacity: 2, status: 'vacant' },
  { id: 'tbl-2', code: 'T-02', name: 'Table 2', section: 'AC Hall', capacity: 4, status: 'occupied', currentOrderId: 'ord-103', currentAmountMinor: 28350, pax: 3 },
  { id: 'tbl-3', code: 'T-03', name: 'Table 3', section: 'AC Hall', capacity: 4, status: 'vacant' },
  { id: 'tbl-4', code: 'T-04', name: 'Table 4', section: 'AC Hall', capacity: 6, status: 'occupied', currentOrderId: 'ord-101', currentAmountMinor: 79275, pax: 5 },
  { id: 'tbl-5', code: 'T-05', name: 'Table 5', section: 'Garden', capacity: 4, status: 'billed', currentAmountMinor: 45000, pax: 4 },
  { id: 'tbl-6', code: 'T-06', name: 'Table 6', section: 'Garden', capacity: 8, status: 'reserved', pax: 6 },
  { id: 'tbl-7', code: 'T-07', name: 'Table 7', section: 'Rooftop', capacity: 2, status: 'vacant' },
  { id: 'tbl-8', code: 'T-08', name: 'Table 8', section: 'Rooftop', capacity: 4, status: 'vacant' },
];

export function LiveOpsDashboard({ outlet, onOpenPunchModal }: LiveOpsDashboardProps) {
  const [orders, setOrders] = useState<LiveOrder[]>(INITIAL_ORDERS);
  const [tables, setTables] = useState<DiningTable[]>(INITIAL_TABLES);
  const [viewTab, setViewTab] = useState<'kanban' | 'tables'>('kanban');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<LiveOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeStatus, setStoreStatus] = useState<'ONLINE' | 'BUSY' | 'PAUSED'>('ONLINE');
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play synthetic chime for incoming orders
  const playChime = () => {
    if (!audioEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio not permitted yet
    }
  };

  // Keyboard shortcut listener (F2 for new punch, P for print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        onOpenPunchModal?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenPunchModal]);

  // Real-time second counter for order elapsed times
  useEffect(() => {
    const timer = setInterval(() => {
      setOrders(prev =>
        prev.map(ord => ({
          ...ord,
          elapsedSeconds: ord.elapsedSeconds + 1,
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update Order Stage
  const moveOrderStage = (orderId: string, nextStage: OrderStage) => {
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id === orderId) {
          return { ...ord, stage: nextStage };
        }
        return ord;
      })
    );
  };

  // Void/Cancel Order with Reason
  const voidOrder = (orderId: string) => {
    const reason = window.prompt('Audit Compliance: Enter reason for voiding order:', 'Customer changed mind');
    if (reason) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const totalSalesMinor = orders.reduce((sum, o) => sum + o.totalMinor, 0);
    const activeCount = orders.filter(o => o.stage !== 'completed').length;
    const occupiedTables = tables.filter(t => t.status === 'occupied').length;
    const occupancyRate = Math.round((occupiedTables / tables.length) * 100);
    return {
      todaySales: `₹${(totalSalesMinor / 100).toLocaleString('en-IN')}`,
      activeOrders: activeCount,
      occupancyRate: `${occupancyRate}%`,
      avgTicket: `₹${Math.round(totalSalesMinor / (orders.length || 1) / 100).toLocaleString('en-IN')}`,
    };
  }, [orders, tables]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.tableNumber && o.tableNumber.toLowerCase().includes(q)) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  const stages: { key: OrderStage; label: string; count: number; color: string; badgeBg: string }[] = [
    { key: 'incoming', label: 'Incoming Orders', count: orders.filter(o => o.stage === 'incoming').length, color: 'text-orange-500', badgeBg: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    { key: 'preparing', label: 'Preparing (KOT)', count: orders.filter(o => o.stage === 'preparing').length, color: 'text-amber-500', badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    { key: 'ready', label: 'Ready for Dispatch', count: orders.filter(o => o.stage === 'ready').length, color: 'text-blue-500', badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    { key: 'completed', label: 'Completed & Billed', count: orders.filter(o => o.stage === 'completed').length, color: 'text-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* ── Top Industrial Status Header ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25">
            <Flame size={26} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {outlet?.name || 'Store Operations'}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
                storeStatus === 'ONLINE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                storeStatus === 'BUSY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                <span className={`h-2 w-2 rounded-full ${storeStatus === 'ONLINE' ? 'bg-emerald-500 animate-ping' : storeStatus === 'BUSY' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                {storeStatus}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Live Zomato-Style Kitchen Dispatch & Real-Time POS Engine · Outlet Code: <span className="font-mono font-semibold text-slate-700">{outlet?.code || 'OUTLET-01'}</span>
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Store Mode Toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['ONLINE', 'BUSY', 'PAUSED'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStoreStatus(status)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                  storeStatus === status ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Sound Chime Toggle */}
          <button
            onClick={() => {
              setAudioEnabled(v => !v);
              if (!audioEnabled) playChime();
            }}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              audioEnabled ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
            title="Toggle Order Incoming Sound"
          >
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{audioEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>

          {/* Quick Punch Button */}
          <button
            onClick={onOpenPunchModal}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 px-4 text-xs font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-amber-700 hover:shadow-lg active:scale-95"
          >
            <Plus size={16} />
            <span>Punch Order</span>
            <kbd className="hidden rounded bg-orange-700/50 px-1.5 py-0.5 font-mono text-[10px] sm:inline">F2</kbd>
          </button>
        </div>
      </div>

      {/* ── Top Metrics Bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Live Revenue</span>
            <DollarSign size={16} className="text-orange-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{metrics.todaySales}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <TrendingUp size={13} /> +14.2% vs yesterday
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active KOTs</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{metrics.activeOrders}</p>
          <span className="text-[11px] text-slate-500">Live order queue</span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Table Occupancy</span>
            <Utensils size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{metrics.occupancyRate}</p>
          <span className="text-[11px] text-slate-500">{tables.filter(t => t.status === 'occupied').length} of {tables.length} tables filled</span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Ticket</span>
            <CreditCard size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{metrics.avgTicket}</p>
          <span className="text-[11px] text-slate-500">Per billing transaction</span>
        </div>
      </div>

      {/* ── Sub-Nav & Search Switcher ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          <button
            onClick={() => setViewTab('kanban')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              viewTab === 'kanban' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChefHat size={16} />
            <span>Kitchen & Order Kanban</span>
          </button>
          <button
            onClick={() => setViewTab('tables')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              viewTab === 'tables' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid size={16} />
            <span>Dining Table Floor Plan</span>
          </button>
        </div>

        {/* Real-time Order Search */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search order #, table, customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
      </div>

      {/* ── View 1: 4-Column Live Kanban Board (Zomato Merchant Standard) ── */}
      {viewTab === 'kanban' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stages.map(stage => {
            const stageOrders = filteredOrders.filter(o => o.stage === stage.key);
            return (
              <div key={stage.key} className="flex flex-col rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
                {/* Stage Header */}
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.color.replace('text-', 'bg-')}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{stage.label}</h3>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${stage.badgeBg}`}>
                    {stage.count}
                  </span>
                </div>

                {/* Orders Card Stack */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {stageOrders.length === 0 ? (
                    <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center">
                      <p className="text-xs font-medium text-slate-400">No tickets in {stage.label.toLowerCase()}</p>
                    </div>
                  ) : (
                    stageOrders.map(order => (
                      <div
                        key={order.id}
                        className="group relative flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
                      >
                        {/* Ticket Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm font-bold text-slate-900">{order.orderNumber}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                order.channel === 'DINE_IN' ? 'bg-emerald-50 text-emerald-700' :
                                order.channel === 'ZOMATO' ? 'bg-red-50 text-red-700' :
                                order.channel === 'SWIGGY' ? 'bg-orange-50 text-orange-700' :
                                'bg-blue-50 text-blue-700'
                              }`}>
                                {order.channel} {order.tableNumber ? `· ${order.tableNumber}` : ''}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{order.customerName}</p>
                          </div>

                          {/* Time Elapsed Ticker */}
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Clock size={12} />
                            <span>{Math.floor(order.elapsedSeconds / 60)}m</span>
                          </div>
                        </div>

                        {/* Item Lines */}
                        <div className="my-3 space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-start justify-between text-xs">
                              <span className="text-slate-700">
                                <span className="font-bold text-orange-600">{item.qty}x</span> {item.name}
                                {item.notes && <span className="block text-[10px] text-amber-600 italic">★ {item.notes}</span>}
                              </span>
                              <span className="font-mono text-slate-500">₹{(item.rateMinor * item.qty) / 100}</span>
                            </div>
                          ))}
                        </div>

                        {/* Amount & Status Strip */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            Total: ₹{(order.totalMinor / 100).toLocaleString('en-IN')}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            order.paymentMode === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {order.paymentMode}
                          </span>
                        </div>

                        {/* Action Buttons depending on stage */}
                        <div className="mt-3 flex items-center gap-1.5 pt-1">
                          {order.stage === 'incoming' && (
                            <>
                              <button
                                onClick={() => moveOrderStage(order.id, 'preparing')}
                                className="flex-1 rounded-lg bg-orange-500 py-1.5 text-center text-xs font-bold text-white transition-colors hover:bg-orange-600"
                              >
                                Accept & Send KOT
                              </button>
                              <button
                                onClick={() => voidOrder(order.id)}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Reject Order"
                              >
                                <X size={15} />
                              </button>
                            </>
                          )}

                          {order.stage === 'preparing' && (
                            <>
                              <button
                                onClick={() => moveOrderStage(order.id, 'ready')}
                                className="flex-1 rounded-lg bg-amber-500 py-1.5 text-center text-xs font-bold text-white transition-colors hover:bg-amber-600"
                              >
                                Mark Food Ready
                              </button>
                              <button
                                onClick={() => setSelectedOrderForPrint(order)}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                title="Print KOT"
                              >
                                <Printer size={15} />
                              </button>
                            </>
                          )}

                          {order.stage === 'ready' && (
                            <>
                              <button
                                onClick={() => moveOrderStage(order.id, 'completed')}
                                className="flex-1 rounded-lg bg-blue-600 py-1.5 text-center text-xs font-bold text-white transition-colors hover:bg-blue-700"
                              >
                                Dispatch / Served
                              </button>
                              <button
                                onClick={() => setSelectedOrderForPrint(order)}
                                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                                title="Print Bill"
                              >
                                <Printer size={15} />
                              </button>
                            </>
                          )}

                          {order.stage === 'completed' && (
                            <button
                              onClick={() => setSelectedOrderForPrint(order)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Printer size={14} />
                              <span>Reprint Receipt</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View 2: Dining Table Floor Plan ── */}
      {viewTab === 'tables' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Restaurant Dining Sections</h2>
              <p className="text-xs text-slate-500">Live occupancy, active running bills and seating status</p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Vacant</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Occupied / KOT Active</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Billed / Settle Pending</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Reserved</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tables.map(tbl => {
              const isOccupied = tbl.status === 'occupied';
              const isBilled = tbl.status === 'billed';
              const isReserved = tbl.status === 'reserved';
              return (
                <div
                  key={tbl.id}
                  onClick={() => {
                    if (isOccupied && tbl.currentOrderId) {
                      const ord = orders.find(o => o.id === tbl.currentOrderId);
                      if (ord) setSelectedOrderForPrint(ord);
                    } else if (tbl.status === 'vacant') {
                      onOpenPunchModal?.();
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all hover:scale-[1.02] hover:shadow-md ${
                    isOccupied ? 'border-orange-300 bg-orange-50/50' :
                    isBilled ? 'border-amber-300 bg-amber-50/50' :
                    isReserved ? 'border-blue-300 bg-blue-50/50' :
                    'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-extrabold text-slate-900">{tbl.code}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      isOccupied ? 'bg-orange-500' :
                      isBilled ? 'bg-amber-500' :
                      isReserved ? 'bg-blue-500' :
                      'bg-emerald-500'
                    }`} />
                  </div>

                  <div className="my-3">
                    <p className="text-xs font-semibold text-slate-600">{tbl.section}</p>
                    <p className="text-[11px] text-slate-400">Capacity: {tbl.capacity} Pax</p>
                  </div>

                  {tbl.currentAmountMinor ? (
                    <div className="rounded bg-white/80 p-1.5 text-center font-mono text-xs font-bold text-slate-900 border border-slate-200/60">
                      ₹{(tbl.currentAmountMinor / 100).toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div className="text-center text-[11px] font-medium text-emerald-600">
                      Vacant · Ready
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 80mm Thermal Receipt Print Preview Modal ── */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-orange-600" />
                <h3 className="font-bold text-slate-900">80mm Thermal Receipt</h3>
              </div>
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Monospace Paper Output */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs text-slate-800 shadow-inner">
                {/* Store Header */}
                <div className="text-center">
                  <h4 className="text-sm font-bold uppercase">{outlet?.name || 'NOVAPOS RESTAURANT'}</h4>
                  <p className="text-[10px] text-slate-600">FSSAI Lic: 13624014000321</p>
                  <p className="text-[10px] text-slate-600">GSTIN: 36ABCDE1234F1Z5</p>
                  <p className="text-[10px] text-slate-600">Main Road, Financial District, Hyd</p>
                  <div className="my-2 border-b border-dashed border-slate-400" />
                </div>

                {/* Ticket Details */}
                <div className="text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Invoice: {selectedOrderForPrint.orderNumber}</span>
                    <span>{selectedOrderForPrint.channel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: {new Date().toLocaleDateString('en-IN')}</span>
                    <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {selectedOrderForPrint.tableNumber && (
                    <div className="font-bold">Table: {selectedOrderForPrint.tableNumber}</div>
                  )}
                  <div className="my-2 border-b border-dashed border-slate-400" />
                </div>

                {/* Itemized Table */}
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-dashed border-slate-400 text-left">
                      <th className="pb-1">Item</th>
                      <th className="pb-1 text-center">Qty</th>
                      <th className="pb-1 text-right">Rate</th>
                      <th className="pb-1 text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderForPrint.items.map((item, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-1 pr-1 truncate max-w-[120px]">{item.name}</td>
                        <td className="py-1 text-center">{item.qty}</td>
                        <td className="py-1 text-right">₹{item.rateMinor / 100}</td>
                        <td className="py-1 text-right">₹{(item.rateMinor * item.qty) / 100}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* GST & Totals */}
                <div className="my-2 border-b border-dashed border-slate-400" />
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Sub Total:</span>
                    <span>₹{(selectedOrderForPrint.subtotalMinor / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (2.5%):</span>
                    <span>₹{(selectedOrderForPrint.taxMinor / 200).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (2.5%):</span>
                    <span>₹{(selectedOrderForPrint.taxMinor / 200).toFixed(2)}</span>
                  </div>
                  <div className="my-1 border-b border-dashed border-slate-400" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>NET TOTAL:</span>
                    <span>₹{(selectedOrderForPrint.totalMinor / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Payment Mode:</span>
                    <span className="font-bold">{selectedOrderForPrint.paymentMode}</span>
                  </div>
                </div>

                {/* QR Code / Footer */}
                <div className="mt-4 flex flex-col items-center justify-center border-t border-dashed border-slate-400 pt-3 text-center">
                  <div className="mb-2 flex h-20 w-20 items-center justify-center rounded border border-slate-300 bg-slate-50">
                    <QrCode size={48} className="text-slate-800" />
                  </div>
                  <p className="text-[10px] font-bold">Scan & Pay via UPI / PhonePe / GPay</p>
                  <p className="mt-1 text-[9px] text-slate-500">Thank you! Visit again.</p>
                  <p className="text-[8px] text-slate-400">Powered by NovaPOS Cloud SaaS</p>
                </div>
              </div>
            </div>

            {/* Print Action Buttons */}
            <div className="flex items-center gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600"
              >
                <Printer size={15} />
                <span>Print Bill (80mm)</span>
              </button>
              <button
                onClick={() => setSelectedOrderForPrint(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
