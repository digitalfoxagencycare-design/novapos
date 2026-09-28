import { Capacitor, registerPlugin } from '@capacitor/core';

export interface CheckoutResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
export interface CheckoutOrder { orderId: string; keyId: string; amount: number; currency: string; planName: string }
const NativeCheckout = registerPlugin<{ open(options: Record<string, unknown>): Promise<CheckoutResult> }>('NovaCheckout');
let scriptPromise: Promise<void> | undefined;

function loadWebCheckout() {
  if ((window as any).Razorpay) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); scriptPromise = undefined; reject(new Error('Cannot load payment gateway. Check your connection and retry.')); };
    const timer = window.setTimeout(fail, 15000);
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => { clearTimeout(timer); if ((window as any).Razorpay) resolve(); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function openSubscriptionCheckout(order: CheckoutOrder, name: string, phone: string): Promise<CheckoutResult> {
  if (!/^order_[a-zA-Z0-9]+$/.test(order.orderId) || !order.keyId || !Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== 'INR') {
    throw new Error('Invalid payment order. Retry after signing in online.');
  }
  const options = {
    key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
    name: 'NovaPOS', description: order.planName,
    prefill: { name, contact: phone ? `+91${phone.replace(/\D/g, '').slice(-10)}` : '' },
    theme: { color: '#EA580C' },
  };
  if (Capacitor.getPlatform() === 'android') {
    if (!Capacitor.isPluginAvailable('NovaCheckout')) throw new Error('Update the Android app to use secure native checkout.');
    return NativeCheckout.open(options);
  }
  await loadWebCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new (window as any).Razorpay({ ...options,
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Checkout closed. Refresh license status if your account was debited.')) },
    });
    checkout.on('payment.failed', (response: any) => {
      checkout.close();
      reject(new Error(response.error?.description || 'Payment failed. Retry with another available method.'));
    });
    checkout.open();
  });
}
