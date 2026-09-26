export type SubscriptionPlan = 'TRIAL' | 'STARTER' | 'PRO';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  startedAt: number;
  expiresAt: number;
  paymentId?: string;
  orderId?: string;
}

const STORAGE_KEY = 'novapos:saas_subscription';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Loads current SaaS subscription state or initializes a 3-Day Free Trial.
 */
export function getSubscriptionState(): SubscriptionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }

  // Initialize fresh 3-Day Free Trial
  const now = Date.now();
  const initialTrial: SubscriptionState = {
    plan: 'TRIAL',
    startedAt: now,
    expiresAt: now + THREE_DAYS_MS,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTrial));
  } catch {
    // ignore
  }

  return initialTrial;
}

/**
 * Calculates remaining days and expiry status.
 */
export function getSubscriptionDetails(): {
  plan: SubscriptionPlan;
  daysRemaining: number;
  isExpired: boolean;
  isTrial: boolean;
  formattedExpiresAt: string;
} {
  const state = getSubscriptionState();
  const now = Date.now();
  const diffMs = state.expiresAt - now;
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  const isExpired = diffMs <= 0;
  const isTrial = state.plan === 'TRIAL';

  const dateObj = new Date(state.expiresAt);
  const formattedExpiresAt = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return {
    plan: state.plan,
    daysRemaining,
    isExpired,
    isTrial,
    formattedExpiresAt,
  };
}

/**
 * Activates or extends subscription after successful Razorpay payment.
 */
export function applyPaidSubscription(
  planKey: 'starter_monthly' | 'pro_yearly',
  paymentId: string
): SubscriptionState {
  const currentState = getSubscriptionState();
  const now = Date.now();
  const baseTime = currentState.expiresAt > now ? currentState.expiresAt : now;

  const addedMs =
    planKey === 'pro_yearly'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

  const updatedState: SubscriptionState = {
    plan: planKey === 'pro_yearly' ? 'PRO' : 'STARTER',
    startedAt: currentState.startedAt || now,
    expiresAt: baseTime + addedMs,
    paymentId,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
  } catch {
    // ignore
  }

  return updatedState;
}
