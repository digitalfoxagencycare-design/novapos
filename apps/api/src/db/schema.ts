/**
 * NovaPOS database schema.
 *
 * ── Tenancy model ──────────────────────────────────────────────────────────
 * Every business-owned table carries `tenantId`, and isolation is enforced by
 * Postgres row-level security rather than by application code remembering to
 * add a filter. The API connects as a role with RLS enforced and sets
 * `app.current_tenant` per transaction; a query that forgets its tenant
 * returns nothing rather than returning everything. See docs/database.md.
 *
 * ── Money ──────────────────────────────────────────────────────────────────
 * All monetary columns are integers in the currency's minor unit (paise,
 * cents). Floating point never touches money anywhere in this system.
 *
 * ── Uniqueness ─────────────────────────────────────────────────────────────
 * Business keys are unique *per tenant*, never globally, so two restaurants
 * can both have an item coded "TEA".
 */

import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb,
  numeric, index, uniqueIndex, primaryKey, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* ─────────────────────────────  Enums  ───────────────────────────── */

export const tenantStatus = pgEnum('tenant_status', ['ACTIVE', 'SUSPENDED', 'CANCELLED']);
export const staffRole = pgEnum('staff_role', ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']);
export const orderChannel = pgEnum('order_channel', ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QUICK_BILL']);
export const orderStatus = pgEnum('order_status', ['DRAFT', 'OPEN', 'BILLED', 'PAID', 'VOIDED']);
export const orderLineStatus = pgEnum('order_line_status', ['PENDING', 'FIRED', 'READY', 'SERVED', 'VOIDED']);
export const discountType = pgEnum('discount_type', ['PERCENT', 'FIXED']);
export const tableStatus = pgEnum('table_status', ['FREE', 'OCCUPIED', 'RESERVED', 'BILLED', 'CLEANING']);
export const stationMode = pgEnum('station_mode', ['PRINT', 'SCREEN', 'BOTH']);
export const kotKind = pgEnum('kot_kind', ['NEW', 'MODIFIED', 'CANCELLED']);
export const kotStatus = pgEnum('kot_status', ['PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']);
export const kotLineChange = pgEnum('kot_line_change', ['NEW', 'ADDED', 'VOIDED', 'QTY_CHANGED']);
export const paymentMethod = pgEnum('payment_method', ['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'CREDIT', 'VOUCHER']);
export const paymentStatus = pgEnum('payment_status', ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']);
export const printerConnection = pgEnum('printer_connection', ['NETWORK', 'BLUETOOTH', 'USB', 'BROWSER']);
export const printerRole = pgEnum('printer_role', ['RECEIPT', 'KOT', 'REPORT', 'LABEL']);
export const printJobType = pgEnum('print_job_type', ['RECEIPT', 'KOT', 'KOT_CANCEL', 'REPORT', 'DRAWER_KICK']);
export const printJobStatus = pgEnum('print_job_status', ['QUEUED', 'PRINTING', 'DONE', 'FAILED', 'CANCELLED']);
export const stockReason = pgEnum('stock_movement_reason', [
  'SALE', 'VOID_RESTOCK', 'PURCHASE', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING',
]);
export const dealerTier = pgEnum('dealer_tier', ['silver', 'gold', 'platinum']);
export const dealerAllocationStatus = pgEnum('dealer_allocation_status', ['active', 'exhausted', 'revoked']);
export const dealerCommissionStatus = pgEnum('dealer_commission_status', ['accrued', 'invoiced', 'settled', 'reversed']);
export const dealerPayoutStatus = pgEnum('dealer_payout_status', ['pending', 'paid', 'failed']);
export const telemetryEventType = pgEnum('telemetry_event_type', [
  'landing_visit', 'pricing_view', 'trial_signup', 'trial_converted', 'pos_activated', 'store_churned',
]);
export const storeHealthStatus = pgEnum('store_health_status', ['healthy', 'idle', 'at_risk', 'churned']);

/* ────────────────────────  Tenancy & identity  ──────────────────────── */

export const dealers = pgTable('dealers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), phone: text('phone').notNull().unique(),
  email: text('email').notNull().unique(), passwordHash: text('password_hash').notNull(),
  dealerCode: text('dealer_code').notNull().unique(),
  commissionPercent: integer('commission_percent').notNull().default(20),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull().default('0.2000'),
  tier: dealerTier('tier').notNull().default('silver'),
  territory: text('territory'),
  city: text('city'),
  country: text('country').notNull().default('IN'),
  onboardingDate: date('onboarding_date').notNull().default(sql`CURRENT_DATE`),
  bankAccountMask: text('bank_account_mask'),
  authVersion: integer('auth_version').notNull().default(0),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  commissionRange: check('dealers_commission_range', sql`${t.commissionPercent} between 0 and 100`),
  validStatus: check('dealers_status_valid', sql`${t.status} in ('ACTIVE','SUSPENDED')`),
}));
export const platformAdmins = pgTable('platform_admins', {
  id: uuid('id').primaryKey().defaultRandom(), name: text('name').notNull(),
  email: text('email').notNull().unique(), phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(), role: text('role').notNull().default('SUPER_ADMIN'),
  authVersion: integer('auth_version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ validRole: check('platform_admin_role', sql`${t.role} = 'SUPER_ADMIN'`) }));
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  dealerId: uuid('dealer_id').references(() => dealers.id),
  dealerCode: text('dealer_code'),
  /** Business tax identifier printed on invoices (GSTIN, VAT no, EIN). */
  taxId: text('tax_id'),
  country: text('country').notNull().default('IN'),
  defaultLocale: text('default_locale').notNull().default('en-IN'),
  defaultCurrency: text('default_currency').notNull().default('INR'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  /** Key of the tax rule set this tenant bills under. */
  taxRuleSetKey: text('tax_rule_set_key').notNull().default('IN-GST'),
  status: tenantStatus('status').notNull().default('ACTIVE'),
  /** Feature flags, branding, preferred payment gateway. */
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => ({ byDealerCode: index('tenants_dealer_code_idx').on(t.dealerCode), byDealer: index('tenants_dealer_id_idx').on(t.dealerId) }));

export const licenseActivations = pgTable('license_activations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  dealerId: uuid('dealer_id').references(() => dealers.id),
  actorId: uuid('actor_id').notNull(), actorRole: text('actor_role').notNull(),
  action: text('action').notNull(), plan: text('plan').notNull(),
  amountMinor: integer('amount_minor').notNull().default(0),
  commissionMinor: integer('commission_minor').notNull().default(0),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ byDealerMonth: index('license_activations_dealer_month_idx').on(t.dealerId,t.createdAt) }));

export const dealerAllocations = pgTable('dealer_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'restrict' }),
  grantedSeats: integer('granted_seats').notNull(),
  consumedSeats: integer('consumed_seats').notNull().default(0),
  remainingSeats: integer('remaining_seats').generatedAlwaysAs(sql`granted_seats - consumed_seats`),
  status: dealerAllocationStatus('status').notNull().default('active'),
  grantedBy: uuid('granted_by').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  note: text('note'),
}, t => ({
  byDealer: index('dealer_allocations_dealer_idx').on(t.dealerId, t.status),
}));

export const dealerStoreAttribution = pgTable('dealer_store_attribution', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'restrict' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  allocationId: uuid('allocation_id').references(() => dealerAllocations.id, { onDelete: 'restrict' }),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }).notNull().defaultNow(),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  isActivePaid: boolean('is_active_paid').notNull().default(false),
}, t => ({
  tenantUnique: uniqueIndex('dealer_store_attribution_tenant_uq').on(t.tenantId),
  byDealerCohort: index('dealer_store_attribution_cohort_idx').on(t.dealerId, t.onboardedAt),
}));

export const dealerPayouts = pgTable('dealer_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'restrict' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  grossCommissionMinor: integer('gross_commission_minor').notNull(),
  adjustmentsMinor: integer('adjustments_minor').notNull().default(0),
  netPayableMinor: integer('net_payable_minor').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: dealerPayoutStatus('status').notNull().default('pending'),
  utrReference: text('utr_reference'),
  bankAccountMask: text('bank_account_mask'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  settledBy: uuid('settled_by'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  dealerPeriodUnique: uniqueIndex('dealer_payouts_dealer_period_uq').on(t.dealerId, t.periodStart, t.periodEnd),
  byStatus: index('dealer_payouts_status_idx').on(t.status),
  utrUnique: uniqueIndex('dealer_payouts_utr_uq').on(t.utrReference),
}));

export const dealerCommissionEntries = pgTable('dealer_commission_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealerId: uuid('dealer_id').notNull().references(() => dealers.id, { onDelete: 'restrict' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
  activationId: uuid('activation_id').notNull().references(() => licenseActivations.id, { onDelete: 'restrict' }),
  grossAmountMinor: integer('gross_amount_minor').notNull(),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
  commissionAmountMinor: integer('commission_amount_minor').notNull(),
  periodMonth: text('period_month').notNull(),
  status: dealerCommissionStatus('status').notNull().default('accrued'),
  payoutId: uuid('payout_id').references(() => dealerPayouts.id, { onDelete: 'restrict' }),
  accruedAt: timestamp('accrued_at', { withTimezone: true }).notNull().defaultNow(),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  reversalReason: text('reversal_reason'),
}, t => ({
  activationUnique: uniqueIndex('dealer_commission_activation_uq').on(t.activationId),
  byDealerPeriod: index('dealer_commission_dealer_period_idx').on(t.dealerId, t.periodMonth),
  byPayout: index('dealer_commission_payout_idx').on(t.payoutId),
}));

export const platformTelemetry = pgTable('platform_telemetry', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: telemetryEventType('event_type').notNull(),
  sessionId: text('session_id'),
  visitorId: text('visitor_id'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  country: text('country'),
  city: text('city'),
  referrer: text('referrer'),
  deviceType: text('device_type'),
  path: text('path'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  byEventType: index('platform_telemetry_event_idx').on(t.eventType, t.occurredAt),
  bySource: index('platform_telemetry_source_idx').on(t.utmSource),
}));

export const storeHealthSnapshots = pgTable('store_health_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  lastBillAt: timestamp('last_bill_at', { withTimezone: true }),
  billsLast24h: integer('bills_last_24h').notNull().default(0),
  billsLast72h: integer('bills_last_72h').notNull().default(0),
  healthStatus: storeHealthStatus('health_status').notNull().default('healthy'),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  tenantUnique: uniqueIndex('store_health_snapshots_tenant_uq').on(t.tenantId),
  byStatus: index('store_health_snapshots_status_idx').on(t.healthStatus),
}));

export const outlets = pgTable('outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  addressLines: text('address_lines').array().notNull().default(sql`ARRAY[]::text[]`),
  city: text('city'),
  /** Sub-national code the tax engine branches on (Indian state, US state). */
  region: text('region'),
  country: text('country').notNull().default('IN'),
  postalCode: text('postal_code'),
  phone: text('phone'),
  taxId: text('tax_id'),
  /** Extra registration ids printed on the bill (FSSAI, liquor licence). */
  extraIds: text('extra_ids').array().notNull().default(sql`ARRAY[]::text[]`),
  locale: text('locale'),
  currency: text('currency'),
  timezone: text('timezone'),
  /** Overrides the tenant's rule set — a chain spanning two states needs this. */
  taxRuleSetKey: text('tax_rule_set_key'),
  receiptTemplateId: text('receipt_template_id').notNull().default('in-gst'),
  /** Prefix for this outlet's invoice series, e.g. "BLR". */
  invoicePrefix: text('invoice_prefix').notNull().default('INV'),
  serviceChargePercent: numeric('service_charge_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  tenantCode: uniqueIndex('outlets_tenant_code_key').on(t.tenantId, t.code),
  byTenant: index('outlets_tenant_idx').on(t.tenantId),
}));

export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Null means access to every outlet in the tenant. */
  outletId: uuid('outlet_id').references(() => outlets.id, { onDelete: 'set null' }),
  email: text('email'),
  phone: text('phone'),
  name: text('name').notNull(),
  /** argon2id. Never a plaintext or reversible value. */
  passwordHash: text('password_hash'),
  /** Till PIN, also argon2id hashed, for fast operator switching. */
  pinHash: text('pin_hash'),
  role: staffRole('role').notNull(),
  /** Grants beyond the role's defaults, e.g. a senior cashier who may void. */
  extraPermissions: text('extra_permissions').array().notNull().default(sql`ARRAY[]::text[]`),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  tenantEmail: uniqueIndex('staff_tenant_email_key').on(t.tenantId, t.email),
  byTenantOutlet: index('staff_tenant_outlet_idx').on(t.tenantId, t.outletId),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  /** SHA-256 of the token; the raw value only ever exists on the client. */
  tokenHash: text('token_hash').notNull().unique(),
  /** Rotation chain — revoking a parent revokes every descendant. */
  familyId: uuid('family_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byStaff: index('refresh_tokens_staff_idx').on(t.staffId),
  byFamily: index('refresh_tokens_family_idx').on(t.familyId),
}));

export const impersonationSessions = pgTable('impersonation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformAdminId: uuid('platform_admin_id').notNull().references(() => platformAdmins.id, { onDelete: 'restrict' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  targetStaffId: uuid('target_staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  byAdmin: index('impersonation_sessions_admin_idx').on(t.platformAdminId, t.createdAt),
  byTenant: index('impersonation_sessions_tenant_idx').on(t.tenantId, t.createdAt),
}));

export const platformAuditLogs = pgTable('platform_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorAdminId: uuid('actor_admin_id').references(() => platformAdmins.id, { onDelete: 'set null' }),
  impersonationSessionId: uuid('impersonation_session_id').references(() => impersonationSessions.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  requestId: text('request_id'),
  method: text('method'),
  path: text('path'),
  reason: text('reason'),
  detail: jsonb('detail').notNull().default(sql`'{}'::jsonb`),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  byAdmin: index('platform_audit_logs_admin_idx').on(t.actorAdminId, t.createdAt),
  byTenant: index('platform_audit_logs_tenant_idx').on(t.tenantId, t.createdAt),
}));

/* ──────────────────────────────  Menu  ────────────────────────────── */

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** KDS screens subscribe by this code. */
  code: text('code').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Paper ticket, screen, or both. */
  mode: stationMode('mode').notNull().default('BOTH'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  outletCode: uniqueIndex('stations_outlet_code_key').on(t.outletId, t.code),
  byTenantOutlet: index('stations_tenant_outlet_idx').on(t.tenantId, t.outletId),
}));

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Translations keyed by locale: { "hi-IN": "मुख्य पकवान" } */
  nameI18n: jsonb('name_i18n').notNull().default(sql`'{}'::jsonb`),
  code: text('code'),
  sortOrder: integer('sort_order').notNull().default(0),
  colour: text('colour'),
  /** Default kitchen station for items in this category. */
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  tenantCode: uniqueIndex('categories_tenant_code_key').on(t.tenantId, t.code),
  byTenant: index('categories_tenant_idx').on(t.tenantId),
}));

export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  nameI18n: jsonb('name_i18n').notNull().default(sql`'{}'::jsonb`),
  description: text('description'),
  code: text('code'),
  /** Minor units. Whether it includes tax is the rule set's call. */
  priceMinor: integer('price_minor').notNull(),
  packagingChargeMinor: integer('packaging_charge_minor').notNull().default(0),
  /** Channel overrides: { "DELIVERY": 34000 }. Falls back to priceMinor. */
  channelPrices: jsonb('channel_prices').notNull().default(sql`'{}'::jsonb`),
  /** Slab id within the applicable tax rule set, e.g. "gst-5". */
  taxSlabId: text('tax_slab_id').notNull(),
  hsnSac: text('hsn_sac'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  /** Station override; falls back to the category's station. */
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  tracksStock: boolean('tracks_stock').notNull().default(false),
  isVeg: boolean('is_veg'),
  /** Preparation minutes, shown on the KDS as a countdown. */
  prepMinutes: integer('prep_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  tenantCode: uniqueIndex('menu_items_tenant_code_key').on(t.tenantId, t.code),
  byTenantCategory: index('menu_items_tenant_category_idx').on(t.tenantId, t.categoryId),
}));

export const menuItemVariants = pgTable('menu_item_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameI18n: jsonb('name_i18n').notNull().default(sql`'{}'::jsonb`),
  /** Absolute price when set; otherwise item price + priceDeltaMinor. */
  priceMinor: integer('price_minor'),
  priceDeltaMinor: integer('price_delta_minor').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({ byItem: index('menu_item_variants_item_idx').on(t.itemId) }));

export const modifierGroups = pgTable('modifier_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameI18n: jsonb('name_i18n').notNull().default(sql`'{}'::jsonb`),
  minSelect: integer('min_select').notNull().default(0),
  maxSelect: integer('max_select').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({ byTenant: index('modifier_groups_tenant_idx').on(t.tenantId) }));

export const modifiers = pgTable('modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  groupId: uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameI18n: jsonb('name_i18n').notNull().default(sql`'{}'::jsonb`),
  priceMinor: integer('price_minor').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({ byGroup: index('modifiers_group_idx').on(t.groupId) }));

export const menuItemModifierGroups = pgTable('menu_item_modifier_groups', {
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.itemId, t.groupId] }) }));

/* ─────────────────────  Tax configuration  ───────────────────── */

export const taxRuleSets = pgTable('tax_rule_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Stable key referenced by outlets, e.g. "IN-GST" or a tenant's clone. */
  key: text('key').notNull(),
  label: text('label').notNull(),
  country: text('country').notNull(),
  /** The full TaxRuleSet document validated by @novapos/tax-engine. */
  definition: jsonb('definition').notNull(),
  /**
   * Rule sets are versioned by date: reprinting a March bill must use March's
   * rates. Lookups always pass a date and take the newest set effective then.
   */
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantKeyFrom: uniqueIndex('tax_rule_sets_tenant_key_from_key').on(t.tenantId, t.key, t.effectiveFrom),
  byTenant: index('tax_rule_sets_tenant_idx').on(t.tenantId),
}));

/* ──────────────────────────  Floor plan  ────────────────────────── */

export const tableSections = pgTable('table_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({ byOutlet: index('table_sections_outlet_idx').on(t.outletId) }));

export const restaurantTables = pgTable('restaurant_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => tableSections.id, { onDelete: 'set null' }),
  label: text('label').notNull(),
  seats: integer('seats').notNull().default(4),
  status: tableStatus('status').notNull().default('FREE'),
  /** Position on the floor map, in grid units. */
  posX: integer('pos_x').notNull().default(0),
  posY: integer('pos_y').notNull().default(0),
  width: integer('width').notNull().default(1),
  height: integer('height').notNull().default(1),
  shape: text('shape').notNull().default('rect'),
  /** When tables are merged, the others point at the primary. */
  mergedIntoId: uuid('merged_into_id'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({
  outletLabel: uniqueIndex('restaurant_tables_outlet_label_key').on(t.outletId, t.label),
  byTenantOutlet: index('restaurant_tables_tenant_outlet_idx').on(t.tenantId, t.outletId),
}));

export const printers = pgTable('printers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  stationId: uuid('station_id').references(() => stations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  /** Profile id from @novapos/escpos, e.g. "epson-tm-t82". */
  profileId: text('profile_id').notNull().default('generic-80'),
  connection: printerConnection('connection').notNull(),
  /** TCP host for network printers; MAC address for Bluetooth. */
  address: text('address'),
  port: integer('port').notNull().default(9100),
  role: printerRole('role').notNull().default('RECEIPT'),
  copies: integer('copies').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byTenantOutlet: index('printers_tenant_outlet_idx').on(t.tenantId, t.outletId) }));

/* ───────────────────────────  Customers  ─────────────────────────── */

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name'),
  phone: text('phone'),
  email: text('email'),
  taxId: text('tax_id'),
  isBusiness: boolean('is_business').notNull().default(false),
  /** Certificate on file exempting this customer from tax. */
  taxExempt: boolean('tax_exempt').notNull().default(false),
  addressLines: text('address_lines').array().notNull().default(sql`ARRAY[]::text[]`),
  city: text('city'),
  region: text('region'),
  country: text('country'),
  postalCode: text('postal_code'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  notes: text('notes'),
  /** Consent record for GDPR/DPDP: when, and for what, the customer opted in. */
  consent: jsonb('consent').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  /**
   * Set when the customer exercises erasure. PII is nulled but the order rows
   * are retained in anonymised form, because tax law requires the transaction
   * record to survive a data-deletion request.
   */
  anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
}, (t) => ({
  tenantPhone: uniqueIndex('customers_tenant_phone_key').on(t.tenantId, t.phone),
  byTenant: index('customers_tenant_idx').on(t.tenantId),
}));

/* ────────────────────────────  Shifts  ──────────────────────────── */

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  staffId: uuid('staff_id').notNull().references(() => staff.id),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  openingFloatMinor: integer('opening_float_minor').notNull().default(0),
  /** What the cashier counted at close. */
  countedCashMinor: integer('counted_cash_minor'),
  /** What the system says should be in the drawer. */
  expectedCashMinor: integer('expected_cash_minor'),
  varianceMinor: integer('variance_minor'),
  note: text('note'),
}, (t) => ({ byOutletOpened: index('shifts_tenant_outlet_opened_idx').on(t.tenantId, t.outletId, t.openedAt) }));

/* ─────────────────────────────  Orders  ───────────────────────────── */

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id),
  /**
   * Device-generated idempotency key. Replaying it returns the same order
   * instead of creating a duplicate — the property that makes offline sync
   * safe, and the one whose absence destroys trust in a POS.
   */
  clientOrderId: text('client_order_id').notNull(),
  /** Human-facing running number, unique per outlet per business day. */
  orderNumber: text('order_number').notNull(),
  channel: orderChannel('channel').notNull(),
  status: orderStatus('status').notNull().default('DRAFT'),
  staffId: uuid('staff_id').references(() => staff.id),
  customerId: uuid('customer_id').references(() => customers.id),
  shiftId: uuid('shift_id').references(() => shifts.id),
  guestCount: integer('guest_count'),
  notes: text('notes'),

  currency: text('currency').notNull(),
  subtotalMinor: integer('subtotal_minor').notNull().default(0),
  discountMinor: integer('discount_minor').notNull().default(0),
  serviceChargeMinor: integer('service_charge_minor').notNull().default(0),
  deliveryChargeMinor: integer('delivery_charge_minor').notNull().default(0),
  tipMinor: integer('tip_minor').notNull().default(0),
  taxMinor: integer('tax_minor').notNull().default(0),
  roundingMinor: integer('rounding_minor').notNull().default(0),
  totalMinor: integer('total_minor').notNull().default(0),
  paidMinor: integer('paid_minor').notNull().default(0),

  discountType: discountType('discount_type'),
  discountValue: numeric('discount_value', { precision: 12, scale: 4 }),
  discountReason: text('discount_reason'),

  /**
   * Frozen copy of the tax computation. Reports and reprints read this, never
   * recompute — so a bill from March still shows March's rates after the
   * tenant edits their rule set.
   */
  taxSnapshot: jsonb('tax_snapshot'),
  taxRuleSetKey: text('tax_rule_set_key'),

  /** Assigned at billing, not creation: an abandoned draft must not burn a number. */
  invoiceNumber: text('invoice_number'),
  billedAt: timestamp('billed_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: text('void_reason'),
  /** Device clock when the order was taken — may precede createdAt if offline. */
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** Monotonic version for optimistic concurrency on sync. */
  version: integer('version').notNull().default(1),
  lastWriterId: uuid('last_writer_id'),
}, (t) => ({
  tenantClientOrder: uniqueIndex('orders_tenant_client_order_key').on(t.tenantId, t.clientOrderId),
  outletOrderNumber: uniqueIndex('orders_outlet_order_number_key').on(t.outletId, t.orderNumber),
  tenantInvoice: uniqueIndex('orders_tenant_invoice_key').on(t.tenantId, t.invoiceNumber),
  byOutletStatus: index('orders_tenant_outlet_status_idx').on(t.tenantId, t.outletId, t.status),
  byOutletCreated: index('orders_tenant_outlet_created_idx').on(t.tenantId, t.outletId, t.createdAt),
  byCustomer: index('orders_customer_idx').on(t.customerId),
  byUpdated: index('orders_outlet_updated_idx').on(t.outletId, t.updatedAt),
}));

export const orderTables = pgTable('order_tables', {
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  tableId: uuid('table_id').notNull().references(() => restaurantTables.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull(),
  /** The table the bill is presented at, when tables are merged. */
  isPrimary: boolean('is_primary').notNull().default(true),
}, (t) => ({ pk: primaryKey({ columns: [t.orderId, t.tableId] }) }));

export const orderLines = pgTable('order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  /** Device-generated; makes line edits idempotent across a flaky link. */
  clientLineId: text('client_line_id').notNull(),
  itemId: uuid('item_id').notNull().references(() => menuItems.id),
  variantId: uuid('variant_id').references(() => menuItemVariants.id),
  /**
   * Name and price are snapshotted so a reprint of an old bill is faithful
   * even after the menu changes underneath it.
   */
  nameSnapshot: text('name_snapshot').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  modifiersMinor: integer('modifiers_minor').notNull().default(0),
  discountMinor: integer('discount_minor').notNull().default(0),
  discountType: discountType('discount_type'),
  discountValue: numeric('discount_value', { precision: 12, scale: 4 }),
  lineTotalMinor: integer('line_total_minor').notNull(),
  taxSlabId: text('tax_slab_id').notNull(),
  hsnSac: text('hsn_sac'),
  taxMinor: integer('tax_minor').notNull().default(0),
  taxSnapshot: jsonb('tax_snapshot'),
  notes: text('notes'),
  stationId: uuid('station_id'),
  status: orderLineStatus('status').notNull().default('PENDING'),
  /**
   * Set when the line reaches the kitchen. Edits after this point generate a
   * MODIFIED KOT rather than silently changing what the cook is making.
   */
  firedAt: timestamp('fired_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReason: text('void_reason'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orderClientLine: uniqueIndex('order_lines_order_client_line_key').on(t.orderId, t.clientLineId),
  byTenantOrder: index('order_lines_tenant_order_idx').on(t.tenantId, t.orderId),
}));

export const orderLineModifiers = pgTable('order_line_modifiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderLineId: uuid('order_line_id').notNull().references(() => orderLines.id, { onDelete: 'cascade' }),
  modifierId: uuid('modifier_id').notNull().references(() => modifiers.id),
  nameSnapshot: text('name_snapshot').notNull(),
  priceMinor: integer('price_minor').notNull().default(0),
}, (t) => ({ byLine: index('order_line_modifiers_line_idx').on(t.orderLineId) }));

/* ──────────────────────────────  KOT  ────────────────────────────── */

export const kots = pgTable('kots', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  kotNumber: text('kot_number').notNull(),
  /**
   * The business day this ticket belongs to.
   *
   * KOT numbers restart each day so a cook can shout "K12" rather than
   * "K10412". That makes the number unique *per day*, not per tenant — and
   * uniqueness has to be constrained to exactly that, or today's K0001
   * collides with one from last week. Stored rather than derived because a
   * timezone conversion is not immutable and so cannot be indexed.
   */
  businessDate: text('business_date').notNull(),
  kind: kotKind('kind').notNull().default('NEW'),
  status: kotStatus('status').notNull().default('PLACED'),
  /** Set when the realtime gateway handed the ticket off — the latency probe. */
  pushedAt: timestamp('pushed_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  preparingAt: timestamp('preparing_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  servedAt: timestamp('served_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  reprintCount: integer('reprint_count').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantDayKotNumber: uniqueIndex('kots_tenant_day_number_key')
    .on(t.tenantId, t.businessDate, t.kotNumber),
  byStationStatus: index('kots_tenant_station_status_idx').on(t.tenantId, t.stationId, t.status),
  byOrder: index('kots_order_idx').on(t.orderId),
}));

export const kotLines = pgTable('kot_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  kotId: uuid('kot_id').notNull().references(() => kots.id, { onDelete: 'cascade' }),
  orderLineId: uuid('order_line_id').notNull().references(() => orderLines.id, { onDelete: 'cascade' }),
  nameSnapshot: text('name_snapshot').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  previousQuantity: numeric('previous_quantity', { precision: 10, scale: 3 }),
  modifiersSnapshot: text('modifiers_snapshot').array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text('notes'),
  change: kotLineChange('change').notNull().default('NEW'),
  status: kotStatus('status').notNull().default('PLACED'),
}, (t) => ({ byKot: index('kot_lines_kot_idx').on(t.kotId) }));

/* ────────────────────────────  Payments  ──────────────────────────── */

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  clientPaymentId: text('client_payment_id').notNull(),
  method: paymentMethod('method').notNull(),
  status: paymentStatus('status').notNull().default('CAPTURED'),
  amountMinor: integer('amount_minor').notNull(),
  tenderedMinor: integer('tendered_minor'),
  changeMinor: integer('change_minor').notNull().default(0),
  currency: text('currency').notNull(),
  /** Which adapter handled this: "razorpay", "stripe", "cash". */
  gateway: text('gateway').notNull().default('cash'),
  /** The provider's own id, needed for refunds and reconciliation. */
  gatewayRef: text('gateway_ref'),
  reference: text('reference'),
  /**
   * Raw provider response, retained for dispute handling. Adapters strip card
   * data before it reaches here — no PAN ever lands in this column.
   */
  gatewayPayload: jsonb('gateway_payload'),
  refundedMinor: integer('refunded_minor').notNull().default(0),
  failureReason: text('failure_reason'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantClientPayment: uniqueIndex('payments_tenant_client_payment_key').on(t.tenantId, t.clientPaymentId),
  byTenantOrder: index('payments_tenant_order_idx').on(t.tenantId, t.orderId),
  byGatewayRef: index('payments_gateway_ref_idx').on(t.gatewayRef),
}));

/* ───────────────────────────  Inventory  ─────────────────────────── */

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  unit: text('unit').notNull().default('unit'),
  /** Alert when stock falls below this, in `unit`s. */
  reorderLevel: numeric('reorder_level', { precision: 12, scale: 3 }).notNull().default('0'),
  costMinor: integer('cost_minor').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantSku: uniqueIndex('inventory_items_tenant_sku_key').on(t.tenantId, t.sku),
  byTenant: index('inventory_items_tenant_idx').on(t.tenantId),
}));

export const stockLevels = pgTable('stock_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  outletItem: uniqueIndex('stock_levels_outlet_item_key').on(t.outletId, t.inventoryItemId),
  byTenant: index('stock_levels_tenant_idx').on(t.tenantId),
}));

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull(),
  inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  /** Signed: negative consumes, positive receives. */
  quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  reason: stockReason('reason').notNull(),
  /** Order or purchase id that caused the movement. */
  referenceId: uuid('reference_id'),
  note: text('note'),
  staffId: uuid('staff_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byOutletCreated: index('stock_movements_tenant_outlet_created_idx').on(t.tenantId, t.outletId, t.createdAt),
  byItem: index('stock_movements_item_idx').on(t.inventoryItemId),
}));

export const recipeComponents = pgTable('recipe_components', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  /** How much inventory one unit of the menu item consumes. */
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
}, (t) => ({ itemInventory: uniqueIndex('recipe_components_item_inventory_key').on(t.itemId, t.inventoryItemId) }));

/* ───────────────────  Sequences, printing, audit  ─────────────────── */

/**
 * Gapless, per-outlet, per-period invoice numbering.
 *
 * India's GST rules and most EU jurisdictions require consecutive invoice
 * numbers with no gaps, per place of business, per financial year. A counter
 * row locked with SELECT … FOR UPDATE inside the billing transaction is the
 * only correct implementation: a Postgres sequence leaks numbers on rollback,
 * and max()+1 races into duplicates under two concurrent tills.
 */
export const invoiceSequences = pgTable('invoice_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  /** Financial year or month key, e.g. "2026-27". */
  period: text('period').notNull(),
  prefix: text('prefix').notNull(),
  lastNumber: integer('last_number').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  outletPeriodPrefix: uniqueIndex('invoice_sequences_outlet_period_prefix_key').on(t.outletId, t.period, t.prefix),
}));

export const printJobs = pgTable('print_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  outletId: uuid('outlet_id').notNull(),
  printerId: uuid('printer_id').references(() => printers.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  kotId: uuid('kot_id').references(() => kots.id, { onDelete: 'cascade' }),
  type: printJobType('type').notNull(),
  /**
   * The fully rendered document, not a reference to live data. A Bluetooth
   * printer hangs off a phone, so the machine that prints this may not be the
   * one that queued it — and a retry must reproduce what was originally meant.
   */
  payload: jsonb('payload').notNull(),
  status: printJobStatus('status').notNull().default('QUEUED'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byStatusNext: index('print_jobs_tenant_status_next_idx').on(t.tenantId, t.status, t.nextAttemptAt),
  byOutletStatus: index('print_jobs_outlet_status_idx').on(t.outletId, t.status),
}));

/**
 * Append-only audit trail. Required for tax audits, and for answering "who
 * voided that bill" — the most common dispute in this business.
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  outletId: uuid('outlet_id'),
  staffId: uuid('staff_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  /** Before/after for mutations; the reason string for voids and discounts. */
  detail: jsonb('detail').notNull().default(sql`'{}'::jsonb`),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenantCreated: index('audit_logs_tenant_created_idx').on(t.tenantId, t.createdAt),
  byEntity: index('audit_logs_tenant_entity_idx').on(t.tenantId, t.entityType, t.entityId),
}));

/**
 * Idempotency ledger for offline replay.
 *
 * A device flushing a queue after a dropped connection may send the same
 * request twice. The server records each client key's result and returns the
 * stored response on replay rather than doing the work again.
 */
export const idempotencyRecords = pgTable('idempotency_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  /** Scope + client key, e.g. "order:9f3c-…". */
  key: text('key').notNull(),
  requestHash: text('request_hash').notNull(),
  responseBody: jsonb('response_body').notNull(),
  statusCode: integer('status_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  tenantKey: uniqueIndex('idempotency_records_tenant_key_key').on(t.tenantId, t.key),
  byExpiry: index('idempotency_records_expiry_idx').on(t.expiresAt),
}));

/* ────────────────────────────  Relations  ──────────────────────────── */

export const tenantsRelations = relations(tenants, ({ many }) => ({
  outlets: many(outlets), staff: many(staff), categories: many(categories),
  items: many(menuItems), orders: many(orders), customers: many(customers),
}));

export const outletsRelations = relations(outlets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [outlets.tenantId], references: [tenants.id] }),
  tables: many(restaurantTables), stations: many(stations),
  printers: many(printers), orders: many(orders),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  tenant: one(tenants, { fields: [staff.tenantId], references: [tenants.id] }),
  outlet: one(outlets, { fields: [staff.outletId], references: [outlets.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  station: one(stations, { fields: [categories.stationId], references: [stations.id] }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }),
  station: one(stations, { fields: [menuItems.stationId], references: [stations.id] }),
  variants: many(menuItemVariants),
  modifierGroups: many(menuItemModifierGroups),
}));

export const menuItemVariantsRelations = relations(menuItemVariants, ({ one }) => ({
  item: one(menuItems, { fields: [menuItemVariants.itemId], references: [menuItems.id] }),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ many }) => ({
  modifiers: many(modifiers), items: many(menuItemModifierGroups),
}));

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  group: one(modifierGroups, { fields: [modifiers.groupId], references: [modifierGroups.id] }),
}));

export const menuItemModifierGroupsRelations = relations(menuItemModifierGroups, ({ one }) => ({
  item: one(menuItems, { fields: [menuItemModifierGroups.itemId], references: [menuItems.id] }),
  group: one(modifierGroups, { fields: [menuItemModifierGroups.groupId], references: [modifierGroups.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  outlet: one(outlets, { fields: [orders.outletId], references: [outlets.id] }),
  staff: one(staff, { fields: [orders.staffId], references: [staff.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  shift: one(shifts, { fields: [orders.shiftId], references: [shifts.id] }),
  lines: many(orderLines), payments: many(payments),
  kots: many(kots), tables: many(orderTables),
}));

export const orderLinesRelations = relations(orderLines, ({ one, many }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
  item: one(menuItems, { fields: [orderLines.itemId], references: [menuItems.id] }),
  variant: one(menuItemVariants, { fields: [orderLines.variantId], references: [menuItemVariants.id] }),
  modifiers: many(orderLineModifiers),
  kotLines: many(kotLines),
}));

export const orderLineModifiersRelations = relations(orderLineModifiers, ({ one }) => ({
  orderLine: one(orderLines, { fields: [orderLineModifiers.orderLineId], references: [orderLines.id] }),
  modifier: one(modifiers, { fields: [orderLineModifiers.modifierId], references: [modifiers.id] }),
}));

export const orderTablesRelations = relations(orderTables, ({ one }) => ({
  order: one(orders, { fields: [orderTables.orderId], references: [orders.id] }),
  table: one(restaurantTables, { fields: [orderTables.tableId], references: [restaurantTables.id] }),
}));

export const kotsRelations = relations(kots, ({ one, many }) => ({
  order: one(orders, { fields: [kots.orderId], references: [orders.id] }),
  station: one(stations, { fields: [kots.stationId], references: [stations.id] }),
  lines: many(kotLines),
}));

export const kotLinesRelations = relations(kotLines, ({ one }) => ({
  kot: one(kots, { fields: [kotLines.kotId], references: [kots.id] }),
  orderLine: one(orderLines, { fields: [kotLines.orderLineId], references: [orderLines.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  outlet: one(outlets, { fields: [stations.outletId], references: [outlets.id] }),
  printers: many(printers), kots: many(kots),
}));

export const printersRelations = relations(printers, ({ one }) => ({
  outlet: one(outlets, { fields: [printers.outletId], references: [outlets.id] }),
  station: one(stations, { fields: [printers.stationId], references: [stations.id] }),
}));

export const restaurantTablesRelations = relations(restaurantTables, ({ one, many }) => ({
  outlet: one(outlets, { fields: [restaurantTables.outletId], references: [outlets.id] }),
  section: one(tableSections, { fields: [restaurantTables.sectionId], references: [tableSections.id] }),
  orders: many(orderTables),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  staff: one(staff, { fields: [shifts.staffId], references: [staff.id] }),
  outlet: one(outlets, { fields: [shifts.outletId], references: [outlets.id] }),
  orders: many(orders),
}));

/* ────────────────────  Tenant-scoped table registry  ──────────────────── */

/**
 * Every table that carries `tenant_id` and must therefore have an RLS policy.
 * The RLS migration is generated from this list, and a test asserts the list
 * matches the live database — adding a table without deciding its tenancy
 * fails the suite rather than silently shipping an unprotected table.
 */
export const TENANT_SCOPED_TABLES = [
  'outlets', 'staff', 'refresh_tokens', 'stations', 'categories', 'menu_items',
  'menu_item_variants', 'modifier_groups', 'modifiers', 'menu_item_modifier_groups',
  'tax_rule_sets', 'table_sections', 'restaurant_tables', 'printers', 'customers',
  'shifts', 'orders', 'order_tables', 'order_lines', 'order_line_modifiers',
  'kots', 'kot_lines', 'payments', 'inventory_items', 'stock_levels',
  'stock_movements', 'recipe_components', 'invoice_sequences', 'print_jobs',
  'audit_logs', 'idempotency_records', 'license_activations',
  'dealer_store_attribution', 'dealer_commission_entries', 'store_health_snapshots',
  'impersonation_sessions', 'platform_audit_logs',
] as const;

/** The only table without a tenant_id — it *is* the tenant. */
export const UNSCOPED_TABLES = [
  'tenants', 'dealers', 'platform_admins', 'dealer_allocations', 'dealer_payouts', 'platform_telemetry',
] as const;
