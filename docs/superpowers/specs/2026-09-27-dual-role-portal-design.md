# NovaPOS dual-role portal architecture

Date: 2026-09-27. Status: proposed design for review; product implementation and deployment have not started.

## Outcome and scope

One admin website serves platform operators and merchants. A platform operator manages merchant accounts, licenses, hardware fulfilment, releases, and support access. A merchant sees only their business and permitted outlets. Successful authentication routes to `/super-admin` or `/store/dashboard`. Errors and empty accounts always have an explicit recovery path.

The latest requirement establishes a seven-day trial for new registrations. Existing paid entitlements and historical trial expiry dates must survive migration unchanged. Existing ₹499 monthly and ₹4,999 annual prices remain; ₹2,999 annual is a potential new, versioned commercial offering, not an automatic price change.

This design covers the complete target and divides delivery into independently verifiable increments. It does not claim that external gateway accounts, SMS credentials, native printer support, or legal invoice details are already configured.

## Findings in the current repository

- `apps/api/src/outlets/outlets.controller.ts` exposes cross-tenant merchant listing, activation, and suspension through `db.system`, protected only by `settings:read`. Tenant owners/managers can hold this permission. Closing these routes is the first security correction; changing sidebar visibility alone is insufficient.
- Tenant staff JWTs and the shared `StaffRole` model do not distinguish platform principals. Platform identity must not be implemented by giving tenant staff more permissions.
- Tenant database operations already use transaction-local tenant context and RLS. Privileged database access exists and must be confined to explicit platform services.
- Subscription data lives in tenant JSON settings. Introducing typed columns without migrating all writers would create conflicting entitlement sources.
- Authentication has fallback selection of an active tenant when a requested slug is unresolved. Unknown tenant identifiers must fail rather than authenticate against another business.
- The admin application has a large single `App.tsx`, no complete dual-role route tree, and existing merchant-management calls to the unsafe endpoints.
- The POS currently uses Dexie/IndexedDB and localStorage. Native SQLite is a separate implementation step, not an accurate description of the current persistence layer.
- Online-device metrics, hardware fulfilment, and platform audit/session tables need actual persisted models. They cannot be inferred reliably from existing login data.

## Architecture choice

Recommended: keep the monorepo, single portal, and NestJS API, while adding isolated platform modules, platform sessions, and explicitly guarded platform routes. This fits current deployment and retains shared UI and tenant services.

An alternative is a separate platform API and frontend deployment. It offers stronger operational isolation but adds deployment, session, and observability overhead. Adding `SUPER_ADMIN` directly to tenant staff roles is simpler initially but mixes tenant and platform authority; reject that approach.

```mermaid
flowchart TD
  Login[Unified portal login] --> PlatformAuth[Platform authentication]
  Login --> MerchantAuth[Merchant authentication]
  PlatformAuth --> PlatformUI[/super-admin]
  MerchantAuth --> StoreUI[/store/dashboard]
  PlatformUI --> Guard[Platform principal guard]
  Guard --> PlatformAPI[Platform services and transactional audit]
  PlatformAPI --> PrivilegedDB[Restricted privileged database connection]
  StoreUI --> TenantGuard[Tenant principal and permission guards]
  TenantGuard --> TenantDB[Tenant transaction and PostgreSQL RLS]
  PlatformAPI --> Support[Expiring audited impersonation session]
  Support --> TenantGuard
  POS[Offline POS] --> TenantGuard
```

## Authentication and authorization contract

Platform login uses email/phone plus a password stored with Argon2id, rate limits, account lockout, generic login errors, and production MFA enrollment. A master OTP must never be a shared constant or a bypass. Bootstrap the first operator using a one-time CLI with operator-supplied credentials; ship no default password.

Use discriminated principal types:

```ts
type PlatformPrincipal = {
  kind: 'platform'; sub: string; role: 'SUPER_ADMIN';
  sessionId: string; authVersion: number;
};
type MerchantPrincipal = {
  kind: 'merchant'; sub: string; tenantId: string;
  outletId: string | null; role: StaffRole; perms: Permission[];
};
type SupportPrincipal = {
  kind: 'support'; sub: string; tenantId: string;
  outletId: string | null; perms: Permission[];
  impersonationSessionId: string; actorAdminId: string;
};
```

Platform JWTs use a separate signing secret and audience `novapos-platform`; merchant tokens retain their existing audience during migration. Validate issuer, audience, expiry, discriminator, active session, and account version. The server derives roles and tenant scope. Request bodies, decoded-but-unverified JWTs, and localStorage never grant authority.

The global authentication layer dispatches by validated principal, and route metadata explicitly declares accepted principal kinds. Platform routes reject merchant tokens. Ordinary merchant routes reject platform tokens. Missing route classification fails closed for new platform modules. Verify request-scoped tenant context across Observable subscription and awaited database work.

Platform access tokens remain in memory. Rotate opaque refresh tokens stored hashed in `platform_sessions`, delivered through Secure, HttpOnly cookies scoped to the platform refresh endpoint. Require allowed Origin and CSRF protection for cookie-authenticated actions. Restrict CORS to configured applications. Logout revokes the session; password changes and deactivation revoke all sessions. Merchant legacy token storage can migrate separately without blocking the platform boundary.

Merchant login retains business slug/phone plus PIN or OTP. Unknown slug fails explicitly. Phone identities that map to multiple businesses require an authenticated business selection. Apply attempt limits consistently to every PIN/password route. No default owner permissions and no invented `main` outlet IDs are sent to the API.

## Impersonation

`POST /admin/merchants/:id/impersonate` requires a reason and an active platform session. Issue a ten-minute, revocable support token scoped to the selected tenant and selected support-visible owner context. Default support mode is read-only. This allows screen inspection without changing sales, payments, credentials, or settings. Exact merchant action capability would require a separately approved, explicit write-access design.

Persist actor, target, reason, start, expiry, and revocation. Check this session on every support request; no refresh token, nested impersonation, payment initiation, or credential reset is allowed in the support session. Permissions are a server-derived read-only intersection. Use a route allowlist, not HTTP verbs alone, because some POST routes may read and some GET routes may have side effects.

Keep the platform session separate. Show a persistent store-name/support banner and Exit support view button. Exiting revokes support access and clears merchant query caches. Log start/end and permitted support reads with request identifiers, without copying sensitive record payloads into logs.

## Database design

Use UUID primary keys, UTC `timestamptz`, integer minor-unit amounts, explicit currency, and migration-managed constraints/indexes.

| Table | Columns and invariants |
|---|---|
| `super_admins` | Requested `id,email,phone,password_hash,name,is_active,created_at`; add `updated_at,last_login_at,failed_login_count,locked_until,auth_version`. Unique normalized email and non-null normalized phone. MFA secret encrypted and recovery codes hashed if stored here. |
| `platform_sessions` | `id,super_admin_id,refresh_token_hash,family_id,expires_at,revoked_at,created_at,last_seen_at`. Rotation and reuse detection; never store raw refresh tokens. |
| `tenants` additions | `subscription_status` enum PENDING/TRIAL/ACTIVE/EXPIRED/SUSPENDED; `plan` referencing a versioned plan catalogue; `trial_started_at,valid_until,is_lifetime,max_outlets,approved_by,approved_at,hardware_machine_id,version`. `approved_by` references super_admins and is nullable for automated activation. `max_outlets > 0`. Lifetime requires ACTIVE and a null paid expiry. Preserve existing tenant lifecycle status for cancellation/suspension compatibility. |
| `subscription_plans` | Immutable versioned commercial terms: key, display name, amount_minor, currency, duration unit/count, max_outlets, enabled. Preserve existing keys through compatibility mapping. |
| `license_events` | Tenant, actor/source, previous/new terms, reason, payment reference, idempotency key, timestamp. A commercial grant and a captured payment remain distinct events. |
| `subscription_payments` | Unique provider order/payment identifiers, tenant, plan version, expected/paid amounts, currency, status, timestamps. Captured-event processing and entitlement changes occur transactionally. |
| `hardware_orders` | Requested `id,tenant_id,product_type,amount_minor,payment_status,shipping_address,courier_tracking_id,created_at`; add currency, quantity, unit-price/tax snapshots, payment_method, fulfilment_status, provider references, updated_at, version. Server calculates totals. Unique provider payment identifiers. |
| `hardware_devices` | `id,tenant_id,outlet_id,serial_number,installation_id,model,app_version,last_seen_at,revoked_at,created_at`; unique serial when assigned and unique installation identity. A tenant may have multiple terminals. `hardware_machine_id` optionally identifies its primary machine. |
| `impersonation_sessions` | Platform session, actor, tenant, target staff context, reason, allowed permissions, expires_at, revoked_at, created_at. |
| `platform_audit_logs` | Actor/session/request IDs, action, target tenant/entity, redacted before/after values, reason, timestamp, IP/user agent. Tenant ID nullable for global settings. Append-only to application roles. |
| `platform_invoices` | Unique invoice number, tenant, source payment, immutable issuer/buyer/address/GST/tax/line snapshots, currency and minor-unit totals, issued_at; credit notes for adjustments. |
| `app_releases` | Platform/channel, version name/code, minimum supported version, HTTPS download URL, checksum, forced_update, release notes, published_at. |
| `platform_settings` | Versioned non-secret settings and secret-reference identifiers. Gateway/API secrets remain in deployment secret storage, never returned to the browser. |

Hardware orders, device records, invoices, and entitlement records containing tenant data receive tenant policies and explicit API permissions. Merchant access to their hardware orders is read-only. Platform credential/session/audit tables have no tenant-app grants. Validate both database roles at startup; missing dedicated production role configuration is an error, not permission to bypass RLS.

PostgreSQL owners generally bypass RLS unless forced, and BYPASSRLS roles always bypass it. The privileged connection is therefore a deliberate trust boundary, not tenant protection by itself. See [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Trial and license state machine

- Unverified registration: PENDING, displayed as Pending verification.
- Successful verification: start one seven-day trial (`168 hours`) once. Persist authoritative server start/expiry; do not reset on reinstall or login.
- Trial or paid expiry: effective status EXPIRED when server time reaches expiry, even if a scheduled job has not updated the materialized status.
- Approval: explicit commercial grant with selected plan and month/year/lifetime term, actor, reason, and audit event.
- Extension: base finite extensions on `max(now, current valid_until)`; use calendar month/year arithmetic with end-of-month clamping in UTC. Store the exact resulting instant. Lifetime needs an explicit flag; a null date alone never grants unlimited use.
- Suspension overrides all entitlements but preserves previous paid/trial terms. Reactivation recomputes entitlement from those terms; it does not grant a free renewal. Cancelled tenants remain blocked under existing lifecycle policy.
- Enforce license restrictions in the API and POS, not only banners. Permit sign-in, status, upgrade, support, legally needed history access, and safe synchronization of already-created offline records. Block new restricted sales/actions at expiry according to documented route policy.

Offline POS uses a server-signed entitlement lease bounded by entitlement expiry and a configurable offline refresh window, initially 24 hours. Record last trusted server time and detect clock rollback. Revocation cannot be instantaneous on a disconnected device: display last verification time and require reconnection when the lease expires. Preserve queued sales and never discard them during suspension/update. Share entitlement logic across IndexedDB and the later native SQLite adapter; do not claim SQLite coverage until native persistence tests pass.

All current JSON subscription readers/writers, gateway verification, webhook activation, and manual grants must move to one entitlement service. Keep compatibility response fields for old clients, generated from the authoritative typed model.

## Backend API contracts

All paths below start `/api/v1`. Platform mutations require an `Idempotency-Key`, validated DTOs, `expectedVersion` for existing resources, a reason where applicable, and an audit record in the same transaction. A repeated matching request returns the original result; mismatched key reuse returns 409. Never return password hashes, secrets, or raw session tokens in directories.

| Method and path | Request / response |
|---|---|
| `POST /auth/super-admin/login` | `{identifier,password,otp?}` → platform principal, access token, expiry, refresh cookie; invalid login 401, throttled 429, MFA challenge where required. |
| `POST /auth/super-admin/refresh` | Rotating refresh cookie plus CSRF/Origin validation → new access token and rotated cookie. |
| `POST /auth/super-admin/logout` | Revoke current session and clear cookie. |
| `GET /admin/platform/overview` | `from,to,timezone` → counts by effective status, online terminal count, GMV grouped by currency, separate SaaS revenue, daily signup buckets, observedAt. |
| `GET /admin/merchants` | `q,status,plan,city,state,cursor,limit` → `{items,nextCursor}`; limit 1–100, default25, stable created_at/id order; indexed parameterized search over name/slug/phone/location/GSTIN. |
| `GET /admin/merchants/:id` | Merchant details, authorized owner contact, outlets, devices, entitlement, recent audit/license events. |
| `POST /admin/merchants/:id/approve` | `{planKey,term:'month'|'year'|'lifetime',reason,expectedVersion}` → persisted entitlement and new version. |
| `POST /admin/merchants/:id/extend-license` | `{term,count,reason,expectedVersion}` → entitlement; reject finite extension of lifetime unless explicitly converting terms through a separate operation. |
| `POST /admin/merchants/:id/suspend` | `{reason,expectedVersion}` → effective SUSPENDED. |
| `POST /admin/merchants/:id/reactivate` | `{reason,expectedVersion}` → recomputed entitlement. |
| `POST /admin/merchants/:id/hardware` | `{serialNumber,model,outletId?,expectedVersion}` → assigned device; reject duplicate serial or foreign outlet. |
| `POST /admin/merchants/:id/reset-owner-pin` | `{ownerStaffId,newPin,reason,expectedVersion}` → success without returning PIN; validate target OWNER, hash PIN, revoke merchant sessions, audit without secret. |
| `POST /admin/merchants/:id/impersonate` | `{reason,outletId?}` → short-lived support token/session and server-selected context. |
| `DELETE /admin/impersonation-sessions/:id` | Revoke actor-owned support session. |
| `GET /admin/hardware-orders` | Filterable paginated order list. |
| `POST /admin/hardware-orders` | Validated tenant/product/quantity/address/payment method → pending order with server-priced snapshot. |
| `PATCH /admin/hardware-orders/:id` | Versioned fulfilment/tracking changes; payment capture cannot be forged through ordinary shipping updates. |
| `GET /admin/invoices` | Paginated immutable SaaS invoices; authorized download endpoint by ID. |
| `GET/PATCH /admin/settings` | Sanitized configuration and versioned non-secret changes. |
| `GET /admin/sms/balance` | Provider balance, unit/currency, fetchedAt, configured/error status; no invented SMS-credit conversion. |
| `GET/POST /admin/releases` | Release directory / validated release publication. |
| `POST /devices/heartbeat` | Merchant-authenticated installation/version data → last-seen acknowledgement; server derives tenant. |

Use NestJS guards and authorization metadata consistently with [NestJS authorization](https://docs.nestjs.com/security/authorization). Remove old `outlets/merchants*` methods or return a retirement response; do not retain permission-only aliases.

Online means a registered, non-revoked device heartbeat within two minutes, with a 30-second heartbeat while connected. Present this definition in the UI. GMV derives from synced frozen sales with explicit cancellation/refund treatment, never from summing joins that duplicate invoice totals. Group currencies separately. Signup charts use selected timezone and report the data cutoff. Offline unsynced activity is not included.

## Payments, hardware and external settings

Keep the existing subscription webhook path `/api/v1/subscriptions/webhook` while migrating its handler. Verify raw-body signatures, provider order ownership, currency/amount, captured status, and deduplicate event/order/payment IDs transactionally. Browser callbacks never activate a license without server verification. See [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

Hardware product catalogue starts at the requested ₹6,499/₹2,999/₹1,999 amounts, with explicit configured tax-inclusive/exclusive treatment before checkout goes live. COD and bank transfer remain unpaid until an audited reconciliation operation; shipping and payment status are independent. Preserve shipping snapshots and tracking history. SaaS tax invoices require real configured supplier details and tax rules; block issuance if incomplete instead of inventing GST values.

Show Fast2SMS balance using the provider's reported units and fetch timestamp; show configuration errors with Retry. Reference: [Fast2SMS wallet balance](https://docs.fast2sms.com/reference/wallet-balance). Settings expose readiness and masked identifiers. Secret rotation occurs through the deployment secret manager. APK release publishing validates HTTPS URLs and monotonically increasing version codes; forced updates allow safe sync/export of queued offline work before blocking new operations.

## Frontend components and behavior

Split the current App into session provider, role route guard, platform shell, store shell, and feature pages. Use separate API client instances for platform and active merchant/support contexts, and scope every data-cache key to session kind and tenant/outlet. Abort requests and clear scoped caches on session changes.

| Component | Behavior |
|---|---|
| `UnifiedLoginPage` | Merchant/platform mode selector in one page; route using server principal after login, including direct-link handling. |
| `PlatformShell` | Overview, Merchants, Hardware orders, Invoices, Settings, Releases; platform identity and Sign out always visible. |
| `PlatformOverviewPage` | KPI cards with separate status counts, currency-aware GMV, connected devices, signup chart, freshness timestamp, retryable errors. |
| `MerchantsPage` | Debounced search, status/location filters, cursor pagination, accessible table and mobile cards, per-row actions. |
| `MerchantActionDialog` | Current terms and exact resulting expiry, reason field, validation, pending state, inline server error, version-conflict reload; no optimistic license success. |
| `ContextSwitcher` | Platform / active support view / permitted merchant outlets. Never creates a role merely by choosing a menu item. |
| `SupportSessionBanner` | Target business, read-only state, remaining session time, Exit support view; persists across nested pages. |
| `StoreShell` | Dashboard, Catalog, Inventory, Staff, Reports, Printing/KOT, Settings, filtered by verified merchant permissions. |
| `BootstrapState` | Finite loading, error with Retry, no-outlets setup/support state, no-access state; navigation shell remains visible without granting permissions. |

Store pages reuse existing dashboard/menu/reports/printing functionality where available. Add missing inventory and staff pages against tenant APIs with outlet restrictions. GST exports derive from immutable invoice snapshots. Browser printing offers only supported browser transports; native Android Bluetooth support remains in the POS client and must not be represented as universally available in the web portal.

Use visible focus states, labelled dialogs, focus restoration, keyboard dismissal, high-contrast actions, and non-color status labels. Every chart has a text/table alternative. A render error boundary protects page crashes, while explicit request-state components handle network failures; these solve different problems.

## Migration and delivery sequence

1. Contain existing cross-tenant endpoints and remove unknown-slug tenant fallback. Add adversarial authorization regressions before exposing platform routes.
2. Add platform identity/session/audit tables, guards, bootstrap CLI, and unified login/role routing. Verify existing merchant flows remain tenant-scoped.
3. Add typed entitlements and immutable payment/license events. Backfill existing JSON values, preserve paid expiries and historical trial dates, report invalid records for repair. New verified registrations receive seven days. Switch all writers together and retain generated compatibility fields for old clients.
4. Deliver platform overview, merchant directory, approval/extension/suspension/device/PIN actions, and revocable read-only support view.
5. Deliver hardware orders, reconciliation, immutable SaaS invoices, SMS health, and release settings with real provider configuration.
6. Complete merchant inventory/staff/report/printing gaps, device heartbeat, and signed offline entitlement integration. Native SQLite migration is separately tested on Android before claiming storage parity.

Generate a proper Drizzle migration and update its journal; verify clean-install and populated-database upgrade paths. Register tenant tables in RLS coverage. Run migration rehearsals against a disposable copy with counts and entitlement comparisons. Take a production backup before applying migrations. Provision platform secrets/accounts separately. No live migration or deployment is implied by this design document.

## Release acceptance

- Merchant A cannot read or mutate Merchant B through any platform or legacy route, spoofed header, direct resource ID, or support token.
- Tenant JWTs cannot authenticate to platform routes; platform JWTs cannot directly access tenant routes. Wrong audience/signature, inactive operators, revoked sessions, and stale account versions fail.
- Real PostgreSQL tests prove RLS isolation under the production application role and explicit platform behavior under the privileged role.
- License approval, concurrent extensions, payment verification, duplicate webhooks, and idempotent retries produce exactly one intended transition and audit event.
- Support sessions expire/revoke, block mutation, preserve actor identity, and clear all tenant caches when exited or switched.
- Login, refresh, deep links, slow/failing APIs, empty outlets, no permissions, and sign-out never leave an infinite Loading state or grant fallback owner permissions.
- Overview queries avoid duplicate GMV and separate currencies; device counts correctly age out stale heartbeats.
- Trial expiry, offline clock rollback, lease expiry, reinstall, suspension/reconnection, and queued-record synchronization have explicit tests; disconnected revocation delay is documented.
- Hardware totals are server-calculated; captured payment cannot be forged; invoice snapshots remain immutable after tenant/catalog edits.
- Admin/API type checks, builds, relevant unit/integration tests, and browser flows pass. Android changes additionally require native build and device verification.

## Review decisions included in this proposal

Recommended defaults are separate platform identity, read-only ten-minute impersonation, seven days only for new trials, preserved existing prices, calendar license terms, and a 24-hour maximum offline lease. These are explicit design choices for review. Credentials, supplier tax details, and provider account configuration are operational inputs and must never be invented.
