/** Domain types shared by the API, POS, admin dashboard and mobile app. */

export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_BILL';

export type OrderStatus =
  | 'DRAFT'      // being built at the POS, not yet fired to kitchen
  | 'OPEN'       // fired, running tab
  | 'BILLED'     // bill printed, awaiting payment
  | 'PAID'
  | 'VOIDED';

export type KotStatus = 'PLACED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'CREDIT' | 'VOUCHER';

export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'VOIDED';

export type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILLED' | 'CLEANING';

export type DiscountType = 'PERCENT' | 'FIXED';

/** Every permission the RBAC layer knows about. Roles map onto these. */
export const PERMISSIONS = [
  'order:create', 'order:read', 'order:update', 'order:void', 'order:discount',
  'payment:create', 'payment:refund',
  'kot:read', 'kot:update', 'kot:reprint',
  'menu:read', 'menu:write',
  'inventory:read', 'inventory:write',
  'staff:read', 'staff:write',
  'outlet:read', 'outlet:write',
  'report:read', 'report:export',
  'customer:read', 'customer:write',
  'settings:read', 'settings:write',
  'tenant:admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  OWNER: [...PERMISSIONS],
  MANAGER: [
    'order:create', 'order:read', 'order:update', 'order:void', 'order:discount',
    'payment:create', 'payment:refund',
    'kot:read', 'kot:update', 'kot:reprint',
    'menu:read', 'menu:write',
    'inventory:read', 'inventory:write',
    'staff:read',
    'outlet:read',
    'report:read', 'report:export',
    'customer:read', 'customer:write',
    'settings:read',
  ],
  CASHIER: [
    'order:create', 'order:read', 'order:update',
    'payment:create',
    'kot:read',
    'menu:read',
    'customer:read', 'customer:write',
    'report:read',
  ],
  WAITER: [
    'order:create', 'order:read', 'order:update',
    'kot:read',
    'menu:read',
    'customer:read',
  ],
  KITCHEN: ['kot:read', 'kot:update', 'kot:reprint', 'order:read', 'menu:read'],
};

export interface JwtClaims {
  sub: string;          // staff id
  tenantId: string;
  outletId: string | null;
  role: StaffRole;
  perms: Permission[];
  supportSessionId?: string;
  platformAdminId?: string;
  iat?: number;
  exp?: number;
}

/** A line as the client sends it — server recomputes all money from menu prices. */
export interface OrderLineInput {
  /** Client-generated id so an offline POS can dedupe on replay. */
  clientLineId: string;
  itemId: string;
  variantId?: string | null;
  quantity: number;
  modifierIds?: string[];
  notes?: string | null;
  /** Line-level discount, applied before tax. */
  discount?: { type: DiscountType; value: number; reason?: string } | null;
  /** Kitchen station override; normally derived from the item's category. */
  stationId?: string | null;
}

export interface OrderInput {
  /**
   * Stable identity of the order on the device. An upsert targets this, so
   * sending it again with different lines is a legitimate *edit* — a waiter
   * adding a course — not a replay.
   */
  clientOrderId: string;
  /**
   * Idempotency key for this particular write attempt.
   *
   * Distinct from `clientOrderId` on purpose. If the two were the same value,
   * the server could not tell "the network dropped, resend the same thing"
   * from "the guest ordered another naan", and one of those two entirely
   * normal situations would have to be rejected.
   *
   * When omitted, the server derives one from the request content: an
   * identical resend is deduplicated, a changed one is applied as an edit.
   */
  clientRequestId?: string;
  channel: OrderChannel;
  tableIds?: string[];
  customerId?: string | null;
  guestCount?: number;
  lines: OrderLineInput[];
  orderDiscount?: { type: DiscountType; value: number; reason?: string } | null;
  /** Service charge percent, e.g. 10 for 10%. Taxable in most jurisdictions. */
  serviceChargePercent?: number;
  /** Non-taxable gratuity in minor units. */
  tipMinor?: number;
  deliveryChargeMinor?: number;
  notes?: string | null;
  /** Device clock at creation — used for offline conflict resolution. */
  placedAt?: string;
}

export interface PaymentInput {
  clientPaymentId: string;
  method: PaymentMethod;
  amountMinor: number;
  tenderedMinor?: number;
  reference?: string | null;
  gateway?: string | null;
}
