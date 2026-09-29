interface Overview {
  landingVisits: number;
  trialSignups: number;
  trialConversions: number;
  conversionRate: number;
}
interface SeriesPoint {
  day: string;
  landingVisits: number;
  trialSignups: number;
  trialConversions: number;
}
interface StorePulse {
  tenantId: string;
  name: string;
  lastBillAt: string | null;
  billsLast24h: number;
  billsLast72h: number;
  healthStatus: string;
  churnWarning: boolean;
}

export function PlatformTelemetryView({ overview, series, pulse }: {
  overview: Overview | null; series: SeriesPoint[]; pulse: StorePulse[];
}) {
  const atRisk = pulse.filter(store => store.churnWarning).length;
  const maxVisits = Math.max(1, ...series.map(day => day.landingVisits));
  return (
    <section className="platform-telemetry">
      <header><h2>Platform telemetry</h2><p>Acquisition funnel and merchant activity over the last 30 days.</p></header>
      <div className="platform-kpis">
        <article><small>Landing visits</small><strong>{overview?.landingVisits ?? '—'}</strong></article>
        <article><small>Trial sign-ups</small><strong>{overview?.trialSignups ?? '—'}</strong></article>
        <article><small>Paid conversions</small><strong>{overview?.trialConversions ?? '—'}</strong></article>
        <article><small>Visit conversion rate</small><strong>{overview ? `${(overview.conversionRate * 100).toFixed(1)}%` : '—'}</strong></article>
      </div>
      <section className="platform-drawer-section">
        <h3>Daily acquisition funnel</h3>
        {series.length ? <div className="platform-telemetry-chart" aria-label="Daily visits, sign-ups, and conversions">
          {series.map(day => <div className="platform-telemetry-day" key={day.day} title={`${day.day}: ${day.landingVisits} visits, ${day.trialSignups} sign-ups, ${day.trialConversions} conversions`}>
            <span className="visits" style={{ height: `${Math.max(2, day.landingVisits / maxVisits * 100)}%` }} />
            <span className="signups" style={{ height: `${Math.max(2, day.trialSignups / maxVisits * 100)}%` }} />
            <span className="conversions" style={{ height: `${Math.max(2, day.trialConversions / maxVisits * 100)}%` }} />
          </div>)}
        </div> : <p>No telemetry events have been recorded in this period.</p>}
        <p className="platform-note">Visits, sign-ups, and conversions</p>
      </section>
      <section className="platform-drawer-section">
        <div className="platform-drawer-section-heading">
          <h3>Store pulse</h3><span>{atRisk} stores at risk</span>
        </div>
        <div className="platform-table"><table><thead><tr><th>Store</th><th>Health</th><th>Last bill</th><th>Bills · 24h</th><th>Bills · 72h</th></tr></thead>
          <tbody>{pulse.slice(0, 50).map(store => <tr key={store.tenantId}>
            <td>{store.name}</td><td>{store.healthStatus.replace('_', ' ')}</td>
            <td>{store.lastBillAt ? new Date(store.lastBillAt).toLocaleString('en-IN') : 'No bills yet'}</td>
            <td>{store.billsLast24h}</td><td>{store.billsLast72h}</td>
          </tr>)}</tbody></table>
          {!pulse.length && <p>No merchant activity data available.</p>}
        </div>
      </section>
    </section>
  );
}
