import { useEffect, useState } from 'react';
import { cloudApi } from './cloudSession';
import { getSetting, setSetting } from './db';

export type SubscriptionPlan = 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export interface SubscriptionState {
  tenantId: string;
  plan: SubscriptionPlan;
  startedAt: number;
  expiresAt: number;
  serverTime: number;
  receivedAt: number;
  lastSeenAt: number;
  active: boolean;
}
const EVENT = 'novapos:subscription-changed';
const keyFor = (tenantId: string) => `novapos:entitlement:v2:${tenantId}`;
const empty: SubscriptionState = { tenantId: '', plan: 'TRIAL', startedAt: 0, expiresAt: 0, serverTime: 0, receivedAt: 0, lastSeenAt: 0, active: false };

function valid(value: any, tenantId: string): value is SubscriptionState {
  return value?.tenantId === tenantId && ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'].includes(value.plan) &&
    ['startedAt', 'expiresAt', 'serverTime', 'receivedAt', 'lastSeenAt'].every(key => Number.isFinite(value[key])) && typeof value.active === 'boolean';
}

export function getSubscriptionState(): SubscriptionState {
  const tenantId = cloudApi.sessionScope?.tenantId;
  if (!tenantId) return empty;
  try {
    const state = JSON.parse(localStorage.getItem(keyFor(tenantId)) ?? 'null');
    return valid(state, tenantId) ? state : empty;
  } catch { return empty; }
}

export function getSubscriptionDetails() {
  const state = getSubscriptionState();
  const now = Date.now();
  // Cache is not a tamper-proof security boundary. Detect ordinary clock rollback.
  const clockRollback = now < state.lastSeenAt - 60000 || now < state.receivedAt - 60000;
  const effectiveNow = state.serverTime + Math.max(0, now - state.receivedAt);
  const remainingMs = state.active && !clockRollback ? Math.max(0, state.expiresAt - effectiveNow) : 0;
  if (state.tenantId && now > state.lastSeenAt) {
    try { localStorage.setItem(keyFor(state.tenantId), JSON.stringify({ ...state, lastSeenAt: now })); } catch { /* storage unavailable */ }
  }
  return {
    plan: state.plan, isTrial: state.plan === 'TRIAL', isExpired: remainingMs <= 0,
    daysRemaining: Math.ceil(remainingMs / 86400000), remainingMs, clockRollback,
    countdown: `${Math.floor(remainingMs / 3600000)}h ${Math.floor(remainingMs / 60000) % 60}m`,
    formattedExpiresAt: state.expiresAt ? new Date(state.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Connect to verify',
  };
}

export async function refreshSubscription(): Promise<void> {
  const tenantId = cloudApi.sessionScope?.tenantId;
  if (!tenantId) throw new Error('Sign in online to verify your license.');
  const status = await cloudApi.subscriptionStatus();
  if (cloudApi.sessionScope?.tenantId !== tenantId || status.tenantId !== tenantId) return;
  const state: SubscriptionState = {
    tenantId, plan: status.isTrial ? 'TRIAL' : status.plan === 'pro_yearly' ? 'PRO' : status.plan === 'enterprise_yearly' ? 'ENTERPRISE' : 'STARTER',
    startedAt: Date.parse(status.startedAt), expiresAt: Date.parse(status.validUntil), serverTime: Date.parse(status.serverTime),
    receivedAt: Date.now(), lastSeenAt: Date.now(), active: !status.isExpired && ['TRIAL', 'ACTIVE'].includes(status.status),
  };
  if (!valid(state, tenantId)) throw new Error('Invalid license response. Contact support.');
  localStorage.setItem(keyFor(tenantId), JSON.stringify(state));
  window.dispatchEvent(new Event(EVENT));
  await setSetting(keyFor(tenantId), state);
}

export async function restoreSubscriptionCache() {
  const tenantId = cloudApi.sessionScope?.tenantId;
  if (!tenantId || getSubscriptionState().tenantId) return;
  const state = await getSetting<SubscriptionState | null>(keyFor(tenantId), null);
  if (cloudApi.sessionScope?.tenantId === tenantId && valid(state, tenantId)) {
    localStorage.setItem(keyFor(tenantId), JSON.stringify(state));
    window.dispatchEvent(new Event(EVENT));
  }
}

export function useSubscriptionDetails() {
  const [details, setDetails] = useState(getSubscriptionDetails);
  useEffect(() => {
    const update = () => setDetails(getSubscriptionDetails());
    const timer = window.setInterval(update, 1000);
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    update();
    return () => { clearInterval(timer); window.removeEventListener(EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return details;
}
