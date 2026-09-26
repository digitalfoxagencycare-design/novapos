import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { summarizeSales } from '../lib/business';

const money = (value: number) => value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
type Props = { orders: Parameters<typeof summarizeSales>[0]; soundEnabled: boolean; onToggleSound: () => void; onTestSound: () => void };

export function BusinessDashboard({ orders, soundEnabled, onToggleSound, onTestSound }: Props) {
  const [period, setPeriod] = useState<'today' | 'month'>('today');
  const [ranking, setRanking] = useState<'revenue' | 'quantity'>('revenue');
  const summary = summarizeSales(orders, new Date());
  const current = summary[period];
  const products = [...current.products].sort((a, b) => b[ranking] - a[ranking]).slice(0, 8);
  return <section className="analytics-page">
    <header className="analytics-heading"><div><h1>Business Analytics</h1><p>{new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</p></div><span className="analytics-source">Bills saved on this device</span></header>
    <div className="analytics-kpis">
      <article className="analytics-kpi featured"><span>Today's Revenue</span><strong>{money(summary.today.revenue)}</strong><small>{summary.today.bills} bills today</small></article>
      <article className="analytics-kpi"><span>Monthly Revenue / MTD Sales</span><strong>{money(summary.month.revenue)}</strong><small>Month to date, including today</small></article>
      <article className="analytics-kpi"><span>Total Bills Placed</span><strong>{summary.today.bills}<small> today</small></strong><small>{summary.month.bills} this month</small></article>
      <article className="analytics-kpi"><span>Average Order Value</span><strong>{money(summary.today.aov)}</strong><small>Today · {money(summary.month.aov)} this month</small></article>
    </div>
    <div className="analytics-heading"><h2>Sales breakdown</h2><div className="analytics-segments" aria-label="Report period">{(['today', 'month'] as const).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'today' ? 'Today' : 'This month'}</button>)}</div></div>
    <section className="analytics-panel"><h3>Payment Mode Breakdown</h3><div className="analytics-payments">{(['cash', 'upi', 'card'] as const).map((mode, i) => {
      const share = current.revenue ? current.payments[mode] / current.revenue * 100 : 0;
      return <div key={mode} className={`payment-stat payment-${mode}`}><span>{['Cash Collections', 'UPI / QR Collections', 'Card Collections'][i]}</span><strong>{money(current.payments[mode])}</strong><div className="share-track"><div style={{ width: `${share}%` }} /></div><small>{share.toFixed(1)}% of collections</small></div>;
    })}</div></section>
    <div className="analytics-details">
      <section className="analytics-panel"><div className="analytics-heading"><h3>Top Selling Products</h3><select aria-label="Rank products by" value={ranking} onChange={e => setRanking(e.target.value as typeof ranking)}><option value="revenue">By revenue</option><option value="quantity">By quantity</option></select></div>
        <p className="analytics-caption">Product sales before tax. Quantities shown in their selling unit.</p>
        {products.length ? <div className="analytics-table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th>Revenue</th></tr></thead><tbody>{products.map((product, i) => <tr key={`${product.name}:${product.uom}:${i}`}><td>{product.name}</td><td>{product.quantity} {product.uom}</td><td>{money(product.revenue)}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">Your best sellers will appear after your first bill.</p>}
      </section>
      <section className="analytics-panel"><h3>Sales by Category / Department</h3><p className="analytics-caption">Product sales before tax</p>
        {current.categories.length ? current.categories.map(category => <div className="category-stat" key={category.name}><div><span>{category.name}</span><strong>{money(category.revenue)}</strong></div><div className="share-track"><div style={{ width: `${current.categories[0].revenue ? category.revenue / current.categories[0].revenue * 100 : 0}%` }} /></div></div>) : <p className="analytics-empty">Category sales will appear here as you bill products.</p>}
      </section>
    </div>
    <section className="analytics-panel soundbox-panel"><div><h3>Soundbox Voice Alerts</h3><p className="analytics-caption">Announce payments at the counter.</p></div><div className="soundbox-actions"><button onClick={onToggleSound} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}{soundEnabled ? 'Soundbox: ON' : 'Soundbox: MUTED'}</button><button onClick={onTestSound}>Test Telugu Voice (₹250)</button></div></section>
  </section>;
}
