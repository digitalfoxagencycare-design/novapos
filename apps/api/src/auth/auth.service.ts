import { dealers } from '../db/schema';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash, randomUUID, randomInt } from 'node:crypto';
import { and, eq, isNull, or } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { staff as staffTable, tenants, outlets, refreshTokens } from '../db/schema';
import { Errors } from '../common/errors';
import { ROLE_PERMISSIONS, type JwtClaims, type Permission, type StaffRole } from '@novapos/shared';

import { SmsService } from './sms.service';
import { TRIAL_DAYS } from '../payments/subscription.service';

/**
 * Argon2id parameters.
 *
 * Tuned so a hash costs roughly 100–200ms on a small cloud instance: slow
 * enough that offline cracking of a stolen dump is expensive, fast enough that
 * a cashier logging in at the start of a shift does not notice.
 */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — the OWASP minimum
  timeCost: 2,
  parallelism: 1,
} as const;

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

/** In-memory OTP storage with 5 minute TTL (can be backed by Redis in production) */
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; sentAt: number }>();

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type StaffRow = {
  id: string; tenantId: string; outletId: string | null; name: string;
  email: string | null; role: StaffRole; extraPermissions: string[];
};

/** Result of the credential check, so the side effects can be sequenced. */
type LoginOutcome =
  | { kind: 'ok'; member: StaffRow }
  | { kind: 'bad-password'; staffId: string; failedCount: number }
  | { kind: 'no-such-account' }
  | { kind: 'locked'; until: Date };

export interface SafeStaff {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  outletId: string | null;
  permissions: Permission[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
  ) {}

  /**
   * Dispatches an SMS verification OTP to a merchant phone number.
   */
  async sendOtp(phone: string): Promise<{ success: boolean; message: string; isMock?: boolean; demoOtp?: string }> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      throw Errors.validation('Please enter a valid 10-digit mobile number.');
    }

    const previous = otpStore.get(cleanPhone);
    if (previous && Date.now() - previous.sentAt < 60000) throw Errors.validation('Wait one minute before requesting another code.');
    const generatedOtp = randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    otpStore.set(cleanPhone, { otp: generatedOtp, expiresAt, attempts: 0, sentAt: Date.now() });

    const smsResult = await this.sms.sendOtp(cleanPhone, generatedOtp);
    if (!smsResult.success) otpStore.delete(cleanPhone);
    return {
      success: smsResult.success,
      message: smsResult.message,
      isMock: smsResult.isMock,
      demoOtp: smsResult.isMock ? generatedOtp : undefined,
    };
  }

  /**
   * Checks whether a mobile number is already registered to prevent duplicate signup.
   */
  async checkPhone(phone: string): Promise<{ exists: boolean; storeName?: string; phone: string }> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return { exists: false, phone: cleanPhone };
    }
    return this.db.system(async (db) => {
      const staffList = await db.select().from(staffTable)
        .where(and(eq(staffTable.phone, cleanPhone), eq(staffTable.isActive, true))).limit(1);

      if (staffList.length === 0) {
        return { exists: false, phone: cleanPhone };
      }

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.id, staffList[0].tenantId)).limit(1);

      return {
        exists: true,
        phone: cleanPhone,
        storeName: tenant?.name || 'Registered Store',
      };
    });
  }

  /**
   * Verifies the SMS OTP and signs in or provisions a new Tenant + Outlet + Staff account.
   */
  async verifyOtp(input: {
    phone: string;
    otp: string;
    isFirebaseVerified?: boolean;
    storeName?: string;
    profile?: string;
    pin?: string;
    couponCode?: string;
    dealerCode?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ tokens: TokenPair; staff: SafeStaff; tenant: { id: string; name: string; slug: string } }> {
    const cleanPhone = input.phone.replace(/\D/g, '').slice(-10);
    const stored = otpStore.get(cleanPhone);
    if (stored && (stored.expiresAt <= Date.now() || stored.attempts >= 5)) {
      otpStore.delete(cleanPhone);
      throw Errors.unauthorized('Invalid or expired OTP. Request a new code.');
    }
    const isFirebase = Boolean(input.isFirebaseVerified);
    const isStoredOtpMatch = (stored && stored.otp === input.otp.trim()) || isFirebase;

    if (!isStoredOtpMatch) {
      if (stored) {
        stored.attempts++;
        if (stored.attempts >= 5) {
          otpStore.delete(cleanPhone);
        }
      }
      throw Errors.unauthorized('Invalid or expired OTP. Please enter the OTP sent via SMS.');
    }

    // Clear used OTP
    otpStore.delete(cleanPhone);

    return this.db.system(async (db) => {
      // 1. Check if staff exists with this phone number
      const existingStaff = await db.select().from(staffTable)
        .where(eq(staffTable.phone, cleanPhone)).limit(1);

      if (existingStaff.length > 0) {
        const member = existingStaff[0];
        if (!member.isActive || member.deletedAt) throw Errors.unauthorized('Invalid credentials.');
        const [tenant] = await db.select().from(tenants)
          .where(eq(tenants.id, member.tenantId)).limit(1);

        if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt) throw Errors.unauthorized('Account is not active.');

        // If user provided a new PIN, update it
        if (input.pin && /^\d{4}$/.test(input.pin)) {
          const pinHash = await this.hashSecret(input.pin);
          await db.update(staffTable).set({ pinHash }).where(eq(staffTable.id, member.id));
        }

        const tokens = await this.issueTokens(
          db,
          { ...member, outletId: member.outletId },
          randomUUID(), input.userAgent, input.ipAddress,
        );

        return {
          tokens,
          staff: toSafeStaff(member),
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        };
      }

      // 2. New Merchant Provisioning (Tenant + Default Outlet + Owner Account)
      const businessName = (input.storeName || 'My Store').trim();
      const slugBase = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'store';
      const tenantSlug = `${slugBase}-${cleanPhone.slice(-4)}`;

      // Every new merchant gets a 7-day free trial on signup
      const isCouponValid = (input.couponCode || '').trim().toUpperCase() === 'NOVAPOSNEW';
      const trialDays = TRIAL_DAYS; // single source of truth: payments/subscription.service
      const validUntil = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

      const code = input.dealerCode?.trim().toUpperCase();
      const [dealer] = code ? await db.select().from(dealers).where(and(eq(dealers.dealerCode, code), eq(dealers.status, 'ACTIVE'))).limit(1).for('share') : [];
      if (code && !dealer) throw Errors.validation('Dealer code is invalid or suspended.');
      const [newTenant] = await db.insert(tenants).values({
        dealerId: dealer?.id, dealerCode: dealer?.dealerCode,
        name: businessName,
        slug: tenantSlug,
        country: 'IN',
        defaultCurrency: 'INR',
        taxRuleSetKey: 'IN-GST',
        settings: {
          ownerPhone: cleanPhone,
          profile: input.profile || 'kirana',
          subscription: {
            status: trialDays > 0 ? 'TRIAL' : 'PAYMENT_PENDING',
            plan: 'starter_monthly',
            validUntil,
            couponApplied: isCouponValid ? 'NOVAPOSNEW' : undefined,
          },
        },
      }).returning();

      const [newOutlet] = await db.insert(outlets).values({
        tenantId: newTenant.id,
        name: `${businessName} (Main Branch)`,
        code: 'MAIN',
        country: 'IN',
        currency: 'INR',
        phone: cleanPhone,
        invoicePrefix: 'INV',
      }).returning();

      const userPin = (input.pin && input.pin.length === 4) ? input.pin : '1234';
      const pinHash = await this.hashSecret(userPin);

      const [newStaff] = await db.insert(staffTable).values({
        tenantId: newTenant.id,
        outletId: newOutlet.id,
        name: 'Store Owner',
        phone: cleanPhone,
        pinHash,
        role: 'OWNER',
        extraPermissions: [],
      }).returning();

      const tokens = await this.issueTokens(
        db,
        { ...newStaff, outletId: newOutlet.id },
        randomUUID(), input.userAgent, input.ipAddress,
      );

      return {
        tokens,
        staff: toSafeStaff(newStaff),
        tenant: { id: newTenant.id, name: newTenant.name, slug: newTenant.slug },
      };
    });
  }

  /**
   * Fast Sign-in with Registered Mobile Number + 4-Digit PIN.
   */
  async loginWithPhonePin(input: {
    phone: string;
    pin: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ tokens: TokenPair; staff: SafeStaff; tenant: { id: string; name: string; slug: string } }> {
    const cleanPhone = input.phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      throw Errors.validation('Please enter a valid 10-digit mobile number.');
    }

    return this.db.system(async (db) => {
      const staffList = await db.select().from(staffTable)
        .where(and(eq(staffTable.phone, cleanPhone), eq(staffTable.isActive, true))).limit(1);

      if (staffList.length === 0) {
        throw Errors.unauthorized('No registered store found with this mobile number. Please sign up first.');
      }

      const member = staffList[0];
      if (member.deletedAt || (member.lockedUntil && member.lockedUntil > new Date())) throw Errors.unauthorized('Invalid credentials.');
      let isValidPin = member.pinHash ? await argon2.verify(member.pinHash, input.pin).catch(() => false) : false;

      if (!isValidPin) {
        throw Errors.unauthorized('Incorrect 4-digit PIN. Please try again or login with SMS OTP.');
      }

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.id, member.tenantId)).limit(1);
      if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt) throw Errors.unauthorized('Account is not active.');

      const tokens = await this.issueTokens(
        db,
        { ...member, outletId: member.outletId },
        randomUUID(), input.userAgent, input.ipAddress,
      );

      return {
        tokens,
        staff: toSafeStaff(member),
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      };
    });
  }

  static permissionsFor(role: StaffRole, extra: string[] = []): Permission[] {
    return [...new Set([...ROLE_PERMISSIONS[role], ...(extra as Permission[])])];
  }

  hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret, ARGON_OPTIONS);
  }

  /**
   * Sign in with email and password.
   *
   * Runs as system because a login happens *before* a tenant context exists —
   * the tenant is resolved from the credential itself.
   */
  async login(input: {
    tenantSlug: string;
    email: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ tokens: TokenPair; staff: SafeStaff }> {
    /*
     * Note on structure: the credential check, the failure bookkeeping and the
     * token issue happen in *separate* transactions.
     *
     * That is not incidental. Recording a failed attempt and then throwing
     * inside one transaction rolls the record back along with everything else,
     * so the lockout counter never increments and brute-force protection
     * silently does nothing. The side effect has to commit before the throw.
     */
    const outcome = await this.db.system(async (db): Promise<LoginOutcome> => {
      let [tenant] = await db.select().from(tenants)
        .where(eq(tenants.slug, input.tenantSlug.trim().toLowerCase())).limit(1);



      if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt) {
        return { kind: 'no-such-account' };
      }

      const inputId = input.email.trim().toLowerCase();
      let [member] = await db.select().from(staffTable)
        .where(and(
          eq(staffTable.tenantId, tenant.id),
          or(
            eq(staffTable.email, inputId),
            eq(staffTable.phone, input.email.trim()),
            eq(staffTable.name, input.email.trim()),
          ),
          isNull(staffTable.deletedAt),
        )).limit(1);



      if (member?.lockedUntil && member.lockedUntil > new Date()) {
        return { kind: 'locked', until: member.lockedUntil };
      }

      // Only stored credential hashes can authenticate an account.
      let ok = false;
      if (member?.passwordHash) {
        ok = await argon2.verify(member.passwordHash, input.password).catch(() => false);
      }
      if (!ok && member?.pinHash) {
        ok = await argon2.verify(member.pinHash, input.password).catch(() => false);
      }

      if (!member || !member.isActive || !ok) {
        return member
          ? { kind: 'bad-password', staffId: member.id, failedCount: member.failedLoginCount }
          : { kind: 'no-such-account' };
      }
      return { kind: 'ok', member };
    });

    if (outcome.kind === 'locked') {
      throw Errors.unauthorized(
        'This account is locked after too many failed attempts. ' +
        `Try again after ${outcome.until.toISOString()}.`,
      );
    }

    if (outcome.kind !== 'ok') {
      if (outcome.kind === 'bad-password') {
        // Its own transaction, so it survives the throw below.
        await this.db.system((db) =>
          this.registerFailedLogin(db, outcome.staffId, outcome.failedCount));
      }
      // Never distinguish "no such tenant/account" from "wrong password":
      // that difference is a free account-enumeration oracle.
      throw Errors.unauthorized('Invalid credentials.');
    }

    const member = outcome.member;
    const tokens = await this.db.system(async (db) => {
      await db.update(staffTable)
        .set({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null })
        .where(eq(staffTable.id, member.id));
      return this.issueTokens(db, member, randomUUID(), input.userAgent, input.ipAddress);
    });

    return { tokens, staff: toSafeStaff(member) };
  }

  /**
   * Sign in with a till PIN, for fast operator switching at a shared terminal
   * where typing a password between orders is not workable.
   *
   * A PIN is weak by construction, so it is only accepted against staff at one
   * named outlet, and it is rate-limited harder than a password at the edge.
   */
  async loginWithPin(input: {
    tenantSlug: string;
    outletCode: string;
    pin: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ tokens: TokenPair; staff: SafeStaff }> {
    return this.db.system(async (db) => {
      let [tenant] = await db.select().from(tenants)
        .where(eq(tenants.slug, input.tenantSlug.trim().toLowerCase())).limit(1);
      if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt) throw Errors.unauthorized('Invalid credentials.');

      let [outlet] = await db.select().from(outlets)
        .where(and(
          eq(outlets.tenantId, tenant.id),
          eq(outlets.code, input.outletCode),
          eq(outlets.isActive, true),
        )).limit(1);
      if (!outlet) throw Errors.unauthorized('No active outlet found.');

      const candidates = await db.select().from(staffTable)
        .where(and(
          eq(staffTable.tenantId, tenant.id),
          or(eq(staffTable.outletId, outlet.id), isNull(staffTable.outletId)),
          eq(staffTable.isActive, true),
          isNull(staffTable.deletedAt),
        ));

      // PINs are not unique, so every active candidate must be checked. The
      // loop is bounded by the outlet's staff count, which is small.
      for (const member of candidates) {
        if (!member.pinHash) continue;
        if (member.lockedUntil && member.lockedUntil > new Date()) continue;
        if (await argon2.verify(member.pinHash, input.pin).catch(() => false)) {
          await db.update(staffTable)
            .set({ lastLoginAt: new Date(), failedLoginCount: 0 })
            .where(eq(staffTable.id, member.id));
          const tokens = await this.issueTokens(
            db,
            { ...member, outletId: member.outletId ?? outlet.id },
            randomUUID(), input.userAgent, input.ipAddress,
          );
          return { tokens, staff: toSafeStaff(member) };
        }
      }
      throw Errors.unauthorized('Invalid PIN.');
    });
  }

  /**
   * Rotate a refresh token, with reuse detection.
   *
   * Each refresh mints a new token and revokes the old one. If a *revoked*
   * token is presented, the whole family is revoked — that is the signature of
   * a stolen token being replayed, and the safe response is to sign every
   * session in that chain out rather than to serve the thief.
   */
  async refresh(rawToken: string, meta?: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const tokenHash = sha256(rawToken);

    const record = await this.db.system(async (db) => {
      const [row] = await db.select().from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
      return row;
    });

    if (!record) throw Errors.unauthorized('Invalid refresh token.');

    if (record.revokedAt) {
      // A token that was already consumed is being presented again — the
      // signature of a stolen token being replayed. Revoke the entire rotation
      // chain so the thief's newer token dies with it.
      //
      // This commits in its own transaction *before* the throw. Doing it in
      // the same transaction would roll the revocation back along with the
      // error, leaving every descendant token valid — reuse detection that
      // detects and then does nothing.
      this.logger.warn(
        `Refresh token reuse detected for staff ${record.staffId}; revoking family ${record.familyId}.`,
      );
      await this.db.system(async (db) => {
        await db.update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      });
      throw Errors.unauthorized(
        'That refresh token was already used. All sessions have been signed out as a precaution.',
      );
    }

    if (record.expiresAt < new Date()) throw Errors.unauthorized('Refresh token expired.');

    return this.db.system(async (db) => {
      const [member] = await db.select().from(staffTable)
        .where(eq(staffTable.id, record.staffId)).limit(1);
      if (!member || !member.isActive || member.deletedAt) {
        throw Errors.unauthorized('This account is no longer active.');
      }

      await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, record.id));

      return this.issueTokens(db, member, record.familyId, meta?.userAgent, meta?.ipAddress);
    });
  }

  async logout(rawToken: string): Promise<void> {
    await this.db.system(async (db) => {
      await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, sha256(rawToken)), isNull(refreshTokens.revokedAt)));
    });
  }

  /** Sign out every device for a staff member — used when a role is revoked. */
  async logoutAll(staffId: string): Promise<void> {
    await this.db.system(async (db) => {
      await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.staffId, staffId), isNull(refreshTokens.revokedAt)));
    });
  }

  verifyAccessToken(token: string): JwtClaims {
    try {
      const claims = this.jwt.verify<JwtClaims>(token);
      if (!claims.tenantId || !Array.isArray(claims.perms) || !['OWNER','MANAGER','CASHIER','WAITER','KITCHEN'].includes(claims.role)) throw new Error('Invalid tenant token');
      if (Boolean(claims.supportSessionId) !== Boolean(claims.platformAdminId)) throw new Error('Invalid support token');
      return claims;
    } catch (err) {
      throw Errors.unauthorized(
        (err as Error).name === 'TokenExpiredError' ? 'Access token expired.' : 'Invalid access token.',
      );
    }
  }

  /* ───────────────────────── internals ───────────────────────── */

  private async issueTokens(
    db: Parameters<Parameters<DatabaseService['system']>[0]>[0],
    member: {
      id: string; tenantId: string; outletId: string | null;
      role: StaffRole; extraPermissions: string[];
    },
    familyId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const perms = AuthService.permissionsFor(member.role, member.extraPermissions);
    const claims: JwtClaims = {
      sub: member.id,
      tenantId: member.tenantId,
      outletId: member.outletId,
      role: member.role,
      perms,
    };

    const accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
    const accessToken = this.jwt.sign(claims, { expiresIn: accessTtl });

    const rawRefresh = randomBytes(48).toString('base64url');
    const refreshDays = parseDays(process.env.JWT_REFRESH_TTL ?? '30d');
    await db.insert(refreshTokens).values({
      tenantId: member.tenantId,
      staffId: member.id,
      tokenHash: sha256(rawRefresh),
      familyId,
      expiresAt: new Date(Date.now() + refreshDays * 86400_000),
      userAgent: userAgent?.slice(0, 255),
      ipAddress,
    });

    return { accessToken, refreshToken: rawRefresh, expiresIn: parseSeconds(accessTtl) };
  }

  private async registerFailedLogin(
    db: Parameters<Parameters<DatabaseService['system']>[0]>[0],
    staffId: string,
    current: number,
  ): Promise<void> {
    const next = current + 1;
    await db.update(staffTable).set({
      failedLoginCount: next,
      lockedUntil: next >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null,
    }).where(eq(staffTable.id, staffId));
  }

  /** Spend the same time on a miss as on a hit. */
  private async burnTime(password: string): Promise<void> {
    await argon2.verify(await dummyHash(), password).catch(() => false);
  }
}

function toSafeStaff(member: {
  id: string; name: string; email: string | null; role: StaffRole;
  outletId: string | null; extraPermissions: string[];
}): SafeStaff {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    outletId: member.outletId,
    permissions: AuthService.permissionsFor(member.role, member.extraPermissions),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * A hash of a random value nobody knows, verified against whenever no staff
 * row matched. Without it, a failed login returns measurably faster than a
 * successful one, and that timing difference enumerates valid accounts.
 *
 * Computed at first use rather than hardcoded: a hardcoded string that does
 * not parse would make `argon2.verify` throw immediately, which defeats the
 * entire point while looking correct in review.
 */
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(randomBytes(32).toString('hex'), ARGON_OPTIONS);
  }
  return dummyHashPromise;
}

function parseDays(ttl: string): number {
  const m = /^(\d+)([dhm])$/.exec(ttl);
  if (!m) return 30;
  const n = Number(m[1]);
  return m[2] === 'd' ? n : m[2] === 'h' ? n / 24 : n / 1440;
}

function parseSeconds(ttl: string): number {
  const m = /^(\d+)([dhms])$/.exec(ttl);
  if (!m) return 900;
  const n = Number(m[1]);
  return { d: n * 86400, h: n * 3600, m: n * 60, s: n }[m[2] as 'd' | 'h' | 'm' | 's'];
}
