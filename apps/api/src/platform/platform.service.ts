import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { ROLE_PERMISSIONS, type JwtClaims } from '@novapos/shared';
import { DatabaseService } from '../db/db.service';
import type { Db } from '../db/client';
import {
  dealers, platformAdmins, tenants, licenseActivations, outlets, staff, impersonationSessions, platformAuditLogs,
  dealerAllocations, dealerStoreAttribution, dealerCommissionEntries, dealerPayouts, platformTelemetry,
  storeHealthSnapshots, orders,
} from '../db/schema';
import { SAAS_PLANS, TRIAL_DAYS, subscriptionStatus } from '../payments/subscription.service';

export interface PlatformActor { sub: string; role: 'SUPER_ADMIN' | 'DEALER'; name: string; dealerId?: string; dealerCode?: string; authVersion?: number }
export interface SupportSession {
  sessionId: string;
  accessToken: string;
  expiresAt: string;
  tenant: { id: string; name: string; slug: string };
}
const ADMIN_PHONE_ALIAS: Record<string, string> = {
  '9381546324': '9381563241',
  '93815463241': '9381563241',
  '+919381563241': '9381563241',
  '919381563241': '9381563241',
};
export function normalizePlatformIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return ADMIN_PHONE_ALIAS[normalized] ?? normalized;
}
export function licenseChange(previous: any, action: string, plan: string | undefined, days: number | undefined, now = Date.now()) {
  if (!['ACTIVATE', 'EXTEND', 'SUSPEND', 'REACTIVATE'].includes(action)) throw new BadRequestException('Invalid action');
  const selected = plan ?? previous?.plan ?? 'starter_monthly';
  if (!Object.hasOwn(SAAS_PLANS, selected)) throw new BadRequestException('Invalid plan');
  const expiry = Date.parse(previous?.validUntil ?? '');
  if (action === 'REACTIVATE' && !(expiry > now)) throw new BadRequestException('License expired. Activate or extend first.');
  if (action === 'EXTEND' && (!Number.isInteger(days) || days! < 1 || days! > 365)) throw new BadRequestException('Extension must be 1–365 days');
  const base = Number.isFinite(expiry) ? Math.max(now, expiry) : now;
  const validUntil = action === 'ACTIVATE' ? new Date(now + SAAS_PLANS[selected].durationDays * 86400000).toISOString()
    : action === 'EXTEND' ? new Date(base + days! * 86400000).toISOString()
    : new Date(Number.isFinite(expiry) ? expiry : now).toISOString();
  const status = action === 'SUSPEND' ? 'SUSPENDED' : action === 'ACTIVATE' ? 'ACTIVE'
    : previous?.status === 'TRIAL' || previous?.resumeStatus === 'TRIAL' ? 'TRIAL' : 'ACTIVE';
  return { ...previous, status, plan: selected, validUntil, resumeStatus: action === 'SUSPEND' ? previous?.status : undefined, updatedAt: new Date(now).toISOString() };
}
@Injectable()
export class PlatformService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformService.name);
  private healthRefreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  onModuleInit() {
    this.healthRefreshTimer = setInterval(() => {
      void this.refreshStoreHealth().catch(error => {
        this.logger.error('Periodic merchant health refresh failed', error instanceof Error ? error.stack : String(error));
      });
    }, 15 * 60_000);
    this.healthRefreshTimer.unref();
    void this.refreshStoreHealth().catch(error => {
      this.logger.error('Initial merchant health refresh failed', error instanceof Error ? error.stack : String(error));
    });
  }

  onModuleDestroy() {
    if (this.healthRefreshTimer) clearInterval(this.healthRefreshTimer);
  }
  async login(identifier: string, password: string) {
    const id = normalizePlatformIdentifier(identifier);
    const actor = await this.db.system(async db => {
      const [admin] = await db.select().from(platformAdmins).where(or(eq(platformAdmins.email, id), eq(platformAdmins.phone, id))).limit(1);
      const [dealer] = admin ? [] : await db.select().from(dealers).where(or(eq(dealers.email, id), eq(dealers.phone, id), sql`lower(${dealers.dealerCode}) = lower(${id})`)).limit(1);
      const account = admin ?? dealer;
      // Always perform a password hash check, including unknown accounts.
      const hash = account?.passwordHash ?? await argon2.hash('invalid-account-password');
      const valid = await argon2.verify(hash, password).catch(() => false);
      if (!account || !valid || (dealer && dealer.status !== 'ACTIVE') || (admin && admin.role !== 'SUPER_ADMIN')) throw new UnauthorizedException('Invalid credentials');
      return { sub: account.id, name: account.name, role: admin ? 'SUPER_ADMIN' : 'DEALER', authVersion: account.authVersion ?? 0, ...(dealer ? { dealerId: dealer.id, dealerCode: dealer.dealerCode } : {}) } as PlatformActor;
    });
    return { actor, accessToken: this.jwt.sign({ ...actor, kind: 'platform' }, { audience: 'novapos-platform', expiresIn: '1h' }) };
  }
  async authenticate(token: string): Promise<PlatformActor> {
    let claims: PlatformActor & { kind: string; authVersion?: number };
    try { claims = this.jwt.verify(token, { audience: 'novapos-platform' }); } catch { throw new UnauthorizedException('Session expired. Sign in again.'); }
    if (claims.kind !== 'platform' || !['SUPER_ADMIN','DEALER'].includes(claims.role)) throw new UnauthorizedException();
    return this.db.system(async db => {
      if (claims.role === 'DEALER') {
        const [d] = await db.select().from(dealers).where(eq(dealers.id, claims.sub)).limit(1);
        if (!d || d.status !== 'ACTIVE') throw new UnauthorizedException('Dealer account suspended');
        if ((claims.authVersion ?? 0) !== (d.authVersion ?? 0)) throw new UnauthorizedException('Password changed. Sign in again.');
        return { sub: d.id, role: 'DEALER', name: d.name, dealerId: d.id, dealerCode: d.dealerCode };
      }
      const [a] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, claims.sub)).limit(1);
      if (!a || a.role !== 'SUPER_ADMIN') throw new UnauthorizedException();
      if ((claims.authVersion ?? 0) !== (a.authVersion ?? 0)) throw new UnauthorizedException('Password changed. Sign in again.');
      return { sub: a.id, name: a.name, role: 'SUPER_ADMIN' };
    });
  }
  async changePassword(actor: PlatformActor, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) throw new BadRequestException('Choose a new password different from the current password.');
    const accessToken = await this.db.system(async db => {
      if (actor.role === 'DEALER') {
        const [dealer] = await db.select().from(dealers).where(eq(dealers.id,actor.sub)).for('update');
        if (!dealer || dealer.status !== 'ACTIVE' || !(await argon2.verify(dealer.passwordHash,currentPassword).catch(() => false))) {
          throw new UnauthorizedException('Current password is incorrect.');
        }
        const authVersion = (dealer.authVersion ?? 0) + 1;
        await db.update(dealers).set({ passwordHash: await argon2.hash(newPassword,{type:argon2.argon2id}),authVersion,updatedAt:new Date() }).where(eq(dealers.id,dealer.id));
        return this.jwt.sign({sub:dealer.id,name:dealer.name,role:'DEALER',dealerId:dealer.id,dealerCode:dealer.dealerCode,authVersion,kind:'platform'},{audience:'novapos-platform',expiresIn:'1h'});
      }
      const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id,actor.sub)).for('update');
      if (!admin || admin.role !== 'SUPER_ADMIN' || !(await argon2.verify(admin.passwordHash,currentPassword).catch(() => false))) {
        throw new UnauthorizedException('Current password is incorrect.');
      }
      const authVersion = (admin.authVersion ?? 0) + 1;
      await db.update(platformAdmins).set({passwordHash:await argon2.hash(newPassword,{type:argon2.argon2id}),authVersion}).where(eq(platformAdmins.id,admin.id));
      const activeSessions = await db.select({id:impersonationSessions.id,tenantId:impersonationSessions.tenantId})
        .from(impersonationSessions).where(and(eq(impersonationSessions.platformAdminId,admin.id),isNull(impersonationSessions.revokedAt))).for('update');
      if (activeSessions.length) {
        const revokedAt = new Date();
        await db.update(impersonationSessions).set({revokedAt}).where(and(eq(impersonationSessions.platformAdminId,admin.id),isNull(impersonationSessions.revokedAt)));
        await db.insert(platformAuditLogs).values(activeSessions.map(session => ({
          actorAdminId:admin.id,impersonationSessionId:session.id,tenantId:session.tenantId,
          action:'impersonation.revoked_password_change',reason:'Platform password changed',
        })));
      }
      return this.jwt.sign({sub:admin.id,name:admin.name,role:'SUPER_ADMIN',authVersion,kind:'platform'},{audience:'novapos-platform',expiresIn:'1h'});
    });
    return {accessToken};
  }
  async startImpersonation(actor: PlatformActor, tenantId: string, reason: string, metadata: { requestId?: string; ipAddress?: string; userAgent?: string }): Promise<SupportSession> {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const cleanReason = reason.trim();
    if (cleanReason.length < 10 || cleanReason.length > 500) throw new BadRequestException('Provide an impersonation reason between 10 and 500 characters.');
    return this.db.system(async db => {
      const [tenant] = await db.select().from(tenants)
        .where(and(eq(tenants.id,tenantId),isNull(tenants.deletedAt)))
        .for('update').limit(1);
      if (!tenant || tenant.status !== 'ACTIVE') throw new BadRequestException('Only active merchants can be impersonated.');
      const [owner] = await db.select().from(staff)
        .where(and(eq(staff.tenantId,tenant.id),eq(staff.role,'OWNER'),eq(staff.isActive,true),isNull(staff.deletedAt)))
        .for('update').limit(1);
      if (!owner) throw new BadRequestException('This merchant has no active owner account to impersonate.');

      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const [session] = await db.insert(impersonationSessions).values({
        platformAdminId:actor.sub,tenantId:tenant.id,targetStaffId:owner.id,reason:cleanReason,expiresAt,
        ipAddress:metadata.ipAddress,userAgent:metadata.userAgent?.slice(0,500),
      }).returning({id:impersonationSessions.id});
      await db.insert(platformAuditLogs).values({
        actorAdminId:actor.sub,impersonationSessionId:session.id,tenantId:tenant.id,action:'impersonation.started',
        requestId:metadata.requestId,method:'POST',path:`/admin/super/tenants/${tenant.id}/impersonate`,reason:cleanReason,
        detail:{targetStaffId:owner.id},ipAddress:metadata.ipAddress,userAgent:metadata.userAgent?.slice(0,500),
      });
      const claims: JwtClaims = {
        sub:owner.id,tenantId:tenant.id,outletId:owner.outletId,role:'OWNER',
        perms:ROLE_PERMISSIONS.OWNER,supportSessionId:session.id,platformAdminId:actor.sub,
      };
      return {
        sessionId:session.id,accessToken:this.jwt.sign(claims,{issuer:'novapos',audience:'novapos-clients',expiresIn:'10m'}),
        expiresAt:expiresAt.toISOString(),tenant:{id:tenant.id,name:tenant.name,slug:tenant.slug},
      };
    });
  }
  async validateImpersonationToken(claims: JwtClaims) {
    const sessionId = claims.supportSessionId;
    const platformAdminId = claims.platformAdminId;
    if (!sessionId || !platformAdminId) {
      if (sessionId || platformAdminId) throw new UnauthorizedException('Invalid support session.');
      return null;
    }
    if (claims.role !== 'OWNER' || claims.perms.length !== ROLE_PERMISSIONS.OWNER.length ||
        ROLE_PERMISSIONS.OWNER.some(permission => !claims.perms.includes(permission))) {
      throw new UnauthorizedException('Support tokens must use the tenant owner permission set.');
    }
    const [session] = await this.db.system(db => db.select({
      id:impersonationSessions.id,platformAdminId:impersonationSessions.platformAdminId,
      tenantId:impersonationSessions.tenantId,targetStaffId:impersonationSessions.targetStaffId,
      reason:impersonationSessions.reason,expiresAt:impersonationSessions.expiresAt,revokedAt:impersonationSessions.revokedAt,
      staffActive:staff.isActive,staffDeletedAt:staff.deletedAt,tenantStatus:tenants.status,tenantDeletedAt:tenants.deletedAt,
      staffRole:staff.role,
    }).from(impersonationSessions)
      .innerJoin(staff,eq(staff.id,impersonationSessions.targetStaffId))
      .innerJoin(tenants,eq(tenants.id,impersonationSessions.tenantId))
      .where(and(
        eq(impersonationSessions.id,sessionId),
        eq(impersonationSessions.platformAdminId,platformAdminId),
        eq(impersonationSessions.tenantId,claims.tenantId),
        eq(impersonationSessions.targetStaffId,claims.sub),
      )).limit(1));
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() ||
        !session.staffActive || session.staffDeletedAt || session.staffRole !== 'OWNER' || session.tenantDeletedAt || session.tenantStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Support session is revoked or expired.');
    }
    return {sessionId:session.id,platformAdminId:session.platformAdminId,tenantId:session.tenantId,reason:session.reason};
  }
  async recordImpersonatedRequest(context: { sessionId: string; platformAdminId: string; tenantId: string; requestId?: string; ipAddress?: string; userAgent?: string }, method: string, path: string) {
    await this.db.system(db => db.insert(platformAuditLogs).values({
      actorAdminId:context.platformAdminId,impersonationSessionId:context.sessionId,tenantId:context.tenantId,
      action:'impersonation.request',requestId:context.requestId,method:method.slice(0,12),path:path.slice(0,500),
      ipAddress:context.ipAddress,userAgent:context.userAgent?.slice(0,500),
    }).then(() => undefined));
  }
  async endImpersonation(actor: PlatformActor, sessionId: string, metadata: { requestId?: string; ipAddress?: string; userAgent?: string }) {
    if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.db.system(async db => {
      const [session] = await db.select().from(impersonationSessions)
        .where(and(eq(impersonationSessions.id,sessionId),eq(impersonationSessions.platformAdminId,actor.sub)))
        .for('update').limit(1);
      if (!session) throw new BadRequestException('Support session not found.');
      if (!session.revokedAt) {
        await db.update(impersonationSessions).set({revokedAt:new Date()}).where(eq(impersonationSessions.id,session.id));
        await db.insert(platformAuditLogs).values({
          actorAdminId:actor.sub,impersonationSessionId:session.id,tenantId:session.tenantId,action:'impersonation.ended',
          requestId:metadata.requestId,method:'POST',path:`/admin/super/impersonation/${session.id}/end`,
          ipAddress:metadata.ipAddress,userAgent:metadata.userAgent?.slice(0,500),
        });
      }
      return {sessionId:session.id,revoked:true};
    });
  }
  async merchants(actor: PlatformActor, query: { search?: string; status?: string; plan?: string; health?: string; dealerCode?: string; page?: number; limit?: number }) {
    return this.db.system(async db => {
      // Ownership is imposed here; caller-provided dealer codes cannot expand it.
      const rows = await db.select({tenant:tenants,health:storeHealthSnapshots.healthStatus}).from(tenants)
        .leftJoin(storeHealthSnapshots,eq(storeHealthSnapshots.tenantId,tenants.id))
        .where(and(isNull(tenants.deletedAt), actor.role === 'DEALER' ? eq(tenants.dealerId, actor.sub) : undefined));
      const search = (query.search ?? '').trim().toLowerCase();
      const list = rows.map(({tenant,health}) => {
        const subscription = subscriptionStatus(tenant);
        return { id:tenant.id,name:tenant.name,slug:tenant.slug,dealerCode:tenant.dealerCode,
          phone:String((tenant.settings as Record<string,unknown>)?.ownerPhone ?? ''),
          businessType:String((tenant.settings as Record<string,unknown>)?.profile ?? ''),
          health:health ?? 'at_risk',...subscription };
      })
        .filter(t => (!search || [t.name,t.slug,t.phone,t.dealerCode].some(v => v?.toLowerCase().includes(search))) && (!query.status || t.status === query.status) && (!query.dealerCode || t.dealerCode === query.dealerCode))
        .filter(t => (!query.plan || t.plan === query.plan) && (!query.health || t.health === query.health))
        .sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const page = query.page ?? 1, limit = query.limit ?? 25;
      return { items: list.slice((page-1)*limit,page*limit), total: list.length, page, limit };
    });
  }
  async metrics(actor: PlatformActor) {
    return this.db.system(async db => {
      const rows = await db.select().from(tenants).where(and(isNull(tenants.deletedAt), actor.role === 'DEALER' ? eq(tenants.dealerId,actor.sub) : undefined));
      const statuses = rows.map(subscriptionStatus);
      const ds = actor.role === 'SUPER_ADMIN' ? await db.select({ id: dealers.id }).from(dealers) : [];
      const [earnings] = await db.select({ amount: sql<number>`coalesce(sum(${licenseActivations.commissionMinor}),0)::int`, volume: sql<number>`count(*)::int` }).from(licenseActivations)
        .where(and(actor.role === 'DEALER' ? eq(licenseActivations.dealerId,actor.sub) : undefined, sql`${licenseActivations.createdAt} >= date_trunc('month', now())`, eq(licenseActivations.action,'ACTIVATE')));
      return { totalStores: rows.length, activeTrials: statuses.filter(s => !s.isExpired && s.isTrial).length,
        expiring48h: statuses.filter(s => !s.isExpired && Date.parse(s.validUntil)-Date.now() <= 172800000).length,
        expiredTrials: statuses.filter(s => s.isExpired && s.isTrial).length,
        proTenants: statuses.filter(s => !s.isExpired && !s.isTrial).length, totalDealers: ds.length,
        mrrMinor: Math.round(statuses.filter(s => !s.isExpired && !s.isTrial).reduce((sum,s) => sum + (SAAS_PLANS[s.plan]?.pricePaise ?? 0)/(s.plan === 'starter_monthly' ? 1 : 12),0)),
        estimatedCommissionMinor: earnings.amount, monthlyActivations: earnings.volume };
    });
  }
  async onboardMerchant(actor: PlatformActor, input: { storeName: string; ownerPhone: string; businessProfile: 'restaurant'|'retail'; initialPlan: 'trial'|'starter_monthly'|'pro_yearly' }) {
    if (actor.role !== 'DEALER' || !actor.dealerCode) throw new ForbiddenException();
    const storeName = input.storeName.trim();
    const phone = input.ownerPhone.replace(/\D/g,'');
    if (storeName.length < 2 || phone.length !== 10) throw new BadRequestException('Enter a store name and a valid 10-digit owner mobile number.');
    const trial = input.initialPlan === 'trial';
    const plan = trial ? 'starter_monthly' : input.initialPlan;
    const validUntil = new Date(Date.now() + (trial ? TRIAL_DAYS : SAAS_PLANS[plan].durationDays) * 86400000);
    const ownerPin = String(randomInt(0,10000)).padStart(4,'0');
    const slugBase = storeName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48) || 'store';
    const slug = `${slugBase}-${phone.slice(-4)}-${randomUUID().slice(0,6)}`;
    return this.db.system(async db => {
      const [dealer] = await db.select().from(dealers).where(eq(dealers.id,actor.sub)).for('update');
      if (!dealer || dealer.status !== 'ACTIVE') throw new ForbiddenException('Dealer account is not active.');
      const [existingOwner] = await db.select({id:staff.id}).from(staff).where(eq(staff.phone,phone)).limit(1);
      if (existingOwner) throw new BadRequestException('This mobile number is already linked to a merchant. Use another owner number.');
      const [allocation] = await db.select().from(dealerAllocations)
        .where(and(eq(dealerAllocations.dealerId,dealer.id),eq(dealerAllocations.status,'active'),
          sql`${dealerAllocations.consumedSeats} < ${dealerAllocations.grantedSeats}`,
          sql`(${dealerAllocations.expiresAt} IS NULL OR ${dealerAllocations.expiresAt} > now())`))
        .orderBy(dealerAllocations.grantedAt).limit(1).for('update');
      if (!allocation) throw new ConflictException({ code:'DEALER_QUOTA_EXHAUSTED', message:'License quota pool exhausted. Request a top-up from Super Admin.', dealerId:dealer.id });
      const status = trial ? 'TRIAL' : 'ACTIVE';
      const [tenant] = await db.insert(tenants).values({
        name:storeName,slug,dealerId:dealer.id,dealerCode:dealer.dealerCode,country:'IN',defaultCurrency:'INR',defaultLocale:'en-IN',
        taxRuleSetKey:'IN-GST',settings:{ownerPhone:phone,profile:input.businessProfile === 'retail' ? 'kirana' : 'restaurant',subscription:{status,plan,validUntil:validUntil.toISOString(),activatedBy:'DEALER',activatedById:dealer.id}},
      }).returning();
      const [updatedAllocation] = await db.update(dealerAllocations)
        .set({consumedSeats:sql`${dealerAllocations.consumedSeats} + 1`})
        .where(and(eq(dealerAllocations.id,allocation.id),sql`${dealerAllocations.consumedSeats} < ${dealerAllocations.grantedSeats}`))
        .returning();
      if (!updatedAllocation) throw new ConflictException({ code:'DEALER_QUOTA_EXHAUSTED', message:'License quota pool exhausted. Request a top-up from Super Admin.', dealerId:dealer.id });
      if (updatedAllocation.consumedSeats >= updatedAllocation.grantedSeats) {
        await db.update(dealerAllocations).set({status:'exhausted'}).where(eq(dealerAllocations.id,allocation.id));
      }
      await db.insert(dealerStoreAttribution).values({
        dealerId:dealer.id,tenantId:tenant.id,allocationId:allocation.id,
        trialEndsAt:trial ? validUntil : null,isActivePaid:!trial,convertedAt:trial ? null : new Date(),
      });
      if (!trial) await this.evaluateDealerTier(db,dealer.id);
      const [outlet] = await db.insert(outlets).values({tenantId:tenant.id,name:`${storeName} (Main Branch)`,code:'MAIN',country:'IN',currency:'INR',phone,invoicePrefix:'INV'}).returning();
      const [owner] = await db.insert(staff).values({
        tenantId:tenant.id,outletId:outlet.id,name:'Store Owner',phone,pinHash:await argon2.hash(ownerPin,{type:argon2.argon2id}),role:'OWNER',
      }).returning({id:staff.id});
      await this.writePlatformAudit(db,actor.sub,'dealer.merchant_onboarded','tenant',tenant.id,
        {dealerId:dealer.id,plan},'DEALER',tenant.id);
      if (!trial) {
        const amount = SAAS_PLANS[plan].pricePaise;
        const [activation] = await db.insert(licenseActivations).values({
          tenantId:tenant.id,dealerId:dealer.id,actorId:dealer.id,actorRole:'DEALER',action:'ACTIVATE',plan,
          amountMinor:amount,commissionMinor:Math.round(amount*dealer.commissionPercent/100),validUntil,
        }).returning();
        await this.insertCommissionEntry(db, dealer, activation);
      }
      return {tenant:{id:tenant.id,name:tenant.name,slug:tenant.slug,status,validUntil:validUntil.toISOString()},owner:{id:owner.id,phone,initialPin:ownerPin},plan};
    });
  }
  async change(actor: PlatformActor, tenantId: string, input: { action: string; plan?: string; days?: number }) {
    return this.db.system(async db => {
      if (actor.role === 'DEALER') {
        const [dealer] = await db.select().from(dealers).where(eq(dealers.id,actor.sub)).for('update');
        if (!dealer || dealer.status !== 'ACTIVE' || input.action !== 'ACTIVATE' || !['starter_monthly','pro_yearly'].includes(input.plan ?? '')) throw new ForbiddenException();
      }
      const [t] = await db.select().from(tenants).where(and(eq(tenants.id,tenantId),isNull(tenants.deletedAt),actor.role === 'DEALER' ? eq(tenants.dealerId,actor.sub) : undefined)).for('update');
      if (!t) throw new ForbiddenException('Merchant is unavailable or outside your scope');
      const settings = (t.settings ?? {}) as Record<string,any>;
      const prior = settings.subscription ?? subscriptionStatus(t);
      // Duplicate clicks on an already active plan do not create duplicate commissions or shorten validity.
      if (input.action === 'ACTIVATE' && prior.status === 'ACTIVE' && prior.plan === input.plan && Date.parse(prior.validUntil) > Date.now()) return subscriptionStatus(t);
      const sub = { ...licenseChange(prior,input.action,input.plan,input.days), activatedBy: actor.role, activatedById: actor.sub };
      const [dealer] = t.dealerId ? await db.select().from(dealers).where(eq(dealers.id,t.dealerId)) : [];
      const amount = input.action === 'ACTIVATE' ? SAAS_PLANS[sub.plan].pricePaise : 0;
      await db.update(tenants).set({ settings: { ...settings, subscription: sub }, updatedAt: new Date() }).where(eq(tenants.id,t.id));
      const [activation] = await db.insert(licenseActivations).values({ tenantId: t.id, dealerId: t.dealerId, actorId: actor.sub, actorRole: actor.role, action: input.action, plan: sub.plan, validUntil: new Date(sub.validUntil), amountMinor: amount, commissionMinor: Math.round(amount*(dealer?.commissionPercent ?? 0)/100) }).returning();
      await this.writePlatformAudit(db,actor.sub,'subscription.changed','tenant',t.id,
        {subscriptionAction:input.action,plan:sub.plan},actor.role,t.id);
      if (dealer) {
        const updatedSubscription = subscriptionStatus({ ...t, settings: { ...settings, subscription: sub } });
        const [attribution] = await db.select().from(dealerStoreAttribution)
          .where(eq(dealerStoreAttribution.tenantId,t.id)).limit(1);
        const convertedAt = attribution?.convertedAt ?? (input.action === 'ACTIVATE' ? new Date() : null);
        if (attribution) {
          await db.update(dealerStoreAttribution).set({
            isActivePaid:!updatedSubscription.isExpired && !updatedSubscription.isTrial,
            convertedAt,
          }).where(eq(dealerStoreAttribution.id,attribution.id));
        } else {
          await db.insert(dealerStoreAttribution).values({
            dealerId:dealer.id,tenantId:t.id,isActivePaid:!updatedSubscription.isExpired && !updatedSubscription.isTrial,convertedAt,
          });
        }
        if (input.action === 'ACTIVATE') await this.insertCommissionEntry(db,dealer,activation);
        if (!updatedSubscription.isExpired && !updatedSubscription.isTrial) await this.evaluateDealerTier(db,dealer.id);
      }
      return subscriptionStatus({ ...t, settings: { ...settings, subscription: sub } });
    });
  }
  async listDealers() {
    return this.db.system(db => db.select({ id: dealers.id, name: dealers.name, phone: dealers.phone, email: dealers.email, dealerCode: dealers.dealerCode, status: dealers.status, commissionPercent: dealers.commissionPercent, tier:dealers.tier,territory:dealers.territory,city:dealers.city,onboardingDate:dealers.onboardingDate,
      merchantCount: sql<number>`(select count(*)::int from tenants t where t.dealer_id = ${dealers.id} and t.deleted_at is null)`,
      activationVolume: sql<number>`(select count(*)::int from license_activations a where a.dealer_id = ${dealers.id} and a.action = 'ACTIVATE')`,
      quotaGranted:sql<number>`(select coalesce(sum(a.granted_seats),0)::int from dealer_allocations a where a.dealer_id = ${dealers.id} and a.status in ('active','exhausted'))`,
      quotaConsumed:sql<number>`(select coalesce(sum(a.consumed_seats),0)::int from dealer_allocations a where a.dealer_id = ${dealers.id} and a.status in ('active','exhausted'))`,
    }).from(dealers).orderBy(dealers.name));
  }
  async createDealer(input: { name: string; phone: string; email: string; password: string; dealerCode: string; commissionPercent: number; tier?: 'silver'|'gold'|'platinum'; territory?: string; city?: string }, actorId: string) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      return await this.db.system(async db => {
        const [dealer] = await db.insert(dealers).values({
          name:input.name.trim(),phone:input.phone,email:input.email.toLowerCase().trim(),
          dealerCode:input.dealerCode.toUpperCase().trim(),commissionPercent:input.commissionPercent,
          commissionRate:(input.commissionPercent/100).toFixed(4),tier:input.tier ?? 'silver',
          territory:input.territory?.trim() || null,city:input.city?.trim() || null,passwordHash,
        }).returning({id:dealers.id});
        await this.writePlatformAudit(db,actorId,'dealer.created','dealer',dealer.id,{dealerCode:input.dealerCode});
        return dealer;
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new BadRequestException('Email, phone or dealer code already exists');
      }
      throw error;
    }
  }
  async updateDealer(id: string, input: { status?: string; commissionPercent?: number; tier?: 'silver'|'gold'|'platinum'; territory?: string; city?: string }, actorId: string) {
    return this.db.system(async db => {
      const [d] = await db.update(dealers).set({
        ...input,
        ...(input.commissionPercent === undefined ? {} : {commissionRate:(input.commissionPercent/100).toFixed(4)}),
        updatedAt:new Date(),
      }).where(eq(dealers.id,id)).returning({id:dealers.id});
      if (!d) throw new NotFoundException('Dealer not found');
      await this.writePlatformAudit(db, actorId, 'dealer.updated', 'dealer', id, {fields:Object.keys(input)});
      return d;
    });
  }

  private async insertCommissionEntry(db: Db, dealer: typeof dealers.$inferSelect, activation: typeof licenseActivations.$inferSelect) {
    await db.insert(dealerCommissionEntries).values({
      dealerId:dealer.id,tenantId:activation.tenantId,activationId:activation.id,
      grossAmountMinor:activation.amountMinor,
      commissionRate:(dealer.commissionPercent/100).toFixed(4),
      commissionAmountMinor:activation.commissionMinor,
      periodMonth:activation.createdAt.toISOString().slice(0,7),
    }).onConflictDoNothing({target:dealerCommissionEntries.activationId});
  }

  private async writePlatformAudit(
    db: Db, actorId: string, action: string, entity: string, entityId: string,
    detail: Record<string, unknown> = {}, actorRole: PlatformActor['role'] = 'SUPER_ADMIN', tenantId?: string,
  ) {
    await db.insert(platformAuditLogs).values({
      actorAdminId:actorRole === 'SUPER_ADMIN' ? actorId : null,tenantId,action,
      detail:{actorId,actorRole,entity,entityId,action,...detail},
      path:`/admin/super/${entity}/${entityId}`,
    });
  }

  async getDealer360(dealerId: string, actorId: string) {
    return this.db.system(async db => {
      const [dealer] = await db.select({
        id:dealers.id,name:dealers.name,email:dealers.email,phone:dealers.phone,dealerCode:dealers.dealerCode,
        status:dealers.status,tier:dealers.tier,territory:dealers.territory,city:dealers.city,country:dealers.country,
        onboardingDate:dealers.onboardingDate,commissionPercent:dealers.commissionPercent,
      }).from(dealers).where(eq(dealers.id,dealerId)).limit(1);
      if (!dealer) throw new NotFoundException('Dealer not found');
      const allocations = await db.select().from(dealerAllocations).where(eq(dealerAllocations.dealerId,dealerId)).orderBy(desc(dealerAllocations.grantedAt));
      const [{granted,consumed}] = await db.select({
        granted:sql<number>`coalesce(sum(${dealerAllocations.grantedSeats}),0)::int`,
        consumed:sql<number>`coalesce(sum(${dealerAllocations.consumedSeats}),0)::int`,
      }).from(dealerAllocations).where(and(
        eq(dealerAllocations.dealerId,dealerId),sql`${dealerAllocations.status} in ('active','exhausted')`,
      ));
      const stores = await db.select({
        id:tenants.id,name:tenants.name,slug:tenants.slug,status:tenants.status,settings:tenants.settings,
        onboardedAt:dealerStoreAttribution.onboardedAt,convertedAt:dealerStoreAttribution.convertedAt,
        isActivePaid:dealerStoreAttribution.isActivePaid,trialEndsAt:dealerStoreAttribution.trialEndsAt,
      }).from(dealerStoreAttribution).innerJoin(tenants,eq(tenants.id,dealerStoreAttribution.tenantId))
        .where(eq(dealerStoreAttribution.dealerId,dealerId)).orderBy(desc(dealerStoreAttribution.onboardedAt));
      const cohorts = await db.select({
        month:sql<string>`to_char(${dealerStoreAttribution.onboardedAt},'YYYY-MM')`,
        onboarded:sql<number>`count(*)::int`,
        converted:sql<number>`count(*) filter (where ${dealerStoreAttribution.convertedAt} is not null)::int`,
      }).from(dealerStoreAttribution).where(eq(dealerStoreAttribution.dealerId,dealerId))
        .groupBy(sql`to_char(${dealerStoreAttribution.onboardedAt},'YYYY-MM')`)
        .orderBy(sql`to_char(${dealerStoreAttribution.onboardedAt},'YYYY-MM')`);
      const payouts = await db.select().from(dealerPayouts).where(eq(dealerPayouts.dealerId,dealerId)).orderBy(desc(dealerPayouts.periodStart));
      const ledger = await db.select().from(dealerCommissionEntries).where(eq(dealerCommissionEntries.dealerId,dealerId))
        .orderBy(desc(dealerCommissionEntries.accruedAt)).limit(100);
      const [lifetime] = await db.select({
        commission:sql<number>`coalesce(sum(${dealerCommissionEntries.commissionAmountMinor}),0)::int`,
      }).from(dealerCommissionEntries).where(and(
        eq(dealerCommissionEntries.dealerId,dealerId),sql`${dealerCommissionEntries.status} <> 'reversed'`,
      ));
      await this.writePlatformAudit(db,actorId,'dealer.viewed','dealer',dealerId);
      return {
        dealer,allocations,quota:{granted:Number(granted),consumed:Number(consumed),remaining:Number(granted)-Number(consumed)},
        tenants:stores.map(store=>({tenantId:store.id,name:store.name,slug:store.slug,status:store.status,
          onboardedAt:store.onboardedAt,convertedAt:store.convertedAt,isActivePaid:store.isActivePaid,trialEndsAt:store.trialEndsAt})),
        cohorts:cohorts.map(row=>({month:row.month,onboarded:Number(row.onboarded),converted:Number(row.converted),
          conversionRate:Number(row.onboarded) ? Number(row.converted)/Number(row.onboarded) : 0})),
        payouts,commissionLedger:ledger,lifetimeEarningsMinor:Number(lifetime.commission),
      };
    });
  }

  async topUpQuota(dealerId: string, seats: number, actorId: string, note?: string, expiresAt?: string) {
    if (!Number.isInteger(seats) || seats < 1 || seats > 100_000) throw new BadRequestException('Seats must be an integer between 1 and 100000.');
    const expiration = expiresAt ? new Date(expiresAt) : null;
    if (expiration && (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now())) {
      throw new BadRequestException('Quota expiration must be a future date.');
    }
    return this.db.system(async db => {
      const [dealer] = await db.select({id:dealers.id,status:dealers.status}).from(dealers).where(eq(dealers.id,dealerId)).limit(1);
      if (!dealer) throw new NotFoundException('Dealer not found');
      if (dealer.status !== 'ACTIVE') throw new ForbiddenException('Dealer account is not active.');
      const [allocation] = await db.insert(dealerAllocations).values({
        dealerId,grantedSeats:seats,grantedBy:actorId,note:note?.trim() || 'Super Admin quota grant',
        expiresAt:expiration,
      }).returning();
      await this.writePlatformAudit(db,actorId,'dealer.quota_granted','dealer_allocation',allocation.id,{dealerId,seats});
      return allocation;
    });
  }

  async createDealerPayout(dealerId: string, periodMonth: string, actorId: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) throw new BadRequestException('Period must be YYYY-MM.');
    return this.db.system(async db => {
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${dealerId}:${periodMonth}`},0))`);
      const [dealer] = await db.select({id:dealers.id}).from(dealers).where(eq(dealers.id,dealerId)).limit(1);
      if (!dealer) throw new NotFoundException('Dealer not found');
      const [year,month] = periodMonth.split('-').map(Number);
      const periodStart = new Date(Date.UTC(year,month-1,1));
      const periodEnd = new Date(Date.UTC(year,month,0));
      const [existing] = await db.select().from(dealerPayouts).where(and(
        eq(dealerPayouts.dealerId,dealerId),eq(dealerPayouts.periodStart,periodStart),eq(dealerPayouts.periodEnd,periodEnd),
      )).limit(1);
      if (existing) throw new ConflictException('A payout already exists for this period.');
      const entries = await db.select().from(dealerCommissionEntries).where(and(
        eq(dealerCommissionEntries.dealerId,dealerId),eq(dealerCommissionEntries.periodMonth,periodMonth),
        eq(dealerCommissionEntries.status,'accrued'),
      )).for('update');
      if (!entries.length) throw new ConflictException('No accrued commissions exist for this period.');
      const totalCommissionMinor = entries.reduce((sum,row)=>sum+BigInt(row.commissionAmountMinor),0n);
      if (totalCommissionMinor <= 0n) throw new ConflictException('The accrued commission total must be positive.');
      if (totalCommissionMinor > 2_147_483_647n) throw new ConflictException('The commission total exceeds the supported payout amount.');
      const grossCommissionMinor = Number(totalCommissionMinor);
      const [payout] = await db.insert(dealerPayouts).values({
        dealerId,periodStart,periodEnd,grossCommissionMinor,netPayableMinor:grossCommissionMinor,
      }).returning();
      await db.update(dealerCommissionEntries).set({status:'invoiced',payoutId:payout.id})
        .where(and(eq(dealerCommissionEntries.dealerId,dealerId),eq(dealerCommissionEntries.periodMonth,periodMonth),eq(dealerCommissionEntries.status,'accrued')));
      await this.writePlatformAudit(db,actorId,'dealer.payout_created','dealer_payout',payout.id,{dealerId,periodMonth});
      return payout;
    });
  }

  async settleDealerPayout(dealerId: string, payoutId: string, utrReference: string, actorId: string) {
    const utr = utrReference.trim();
    if (utr.length < 6 || utr.length > 64) throw new BadRequestException('UTR reference must contain 6–64 characters.');
    try {
      return await this.db.system(async db => {
      const [payout] = await db.select().from(dealerPayouts).where(and(
        eq(dealerPayouts.id,payoutId),eq(dealerPayouts.dealerId,dealerId),
      )).for('update').limit(1);
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status !== 'pending') throw new ConflictException('Only pending payouts can be settled.');
      const [duplicate] = await db.select({id:dealerPayouts.id}).from(dealerPayouts).where(eq(dealerPayouts.utrReference,utr)).limit(1);
      if (duplicate) throw new ConflictException('This UTR reference has already been recorded.');
      const settledAt = new Date();
      const [updated] = await db.update(dealerPayouts).set({status:'paid',utrReference:utr,settledAt,settledBy:actorId})
        .where(eq(dealerPayouts.id,payoutId)).returning();
      await db.update(dealerCommissionEntries).set({status:'settled'})
        .where(and(eq(dealerCommissionEntries.payoutId,payoutId),eq(dealerCommissionEntries.status,'invoiced')));
      await this.writePlatformAudit(db,actorId,'dealer.payout_settled','dealer_payout',payoutId,{dealerId,utrReference:utr});
      return updated;
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' &&
          'constraint' in error && error.constraint === 'dealer_payouts_utr_uq') {
        throw new ConflictException('This UTR reference has already been recorded.');
      }
      throw error;
    }
  }

  async ingestTelemetry(input: {
    eventType:'landing_visit'|'pricing_view'|'trial_signup'|'trial_converted'|'pos_activated'|'store_churned';
    sessionId?:string;visitorId?:string;utmSource?:string;utmMedium?:string;utmCampaign?:string;
    country?:string;city?:string;referrer?:string;deviceType?:string;path?:string;
  }) {
    await this.db.system(db=>db.insert(platformTelemetry).values(input).then(()=>undefined));
    return {accepted:true};
  }

  async telemetryOverview(from: string, to: string, actorId: string) {
    const range = this.validDateRange(from,to);
    return this.db.system(async db => {
      const [row] = await db.select({
        landingVisits:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='landing_visit')::int`,
        trialSignups:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='trial_signup')::int`,
        trialConversions:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='trial_converted')::int`,
      }).from(platformTelemetry).where(and(sql`${platformTelemetry.occurredAt} >= ${range.from}`,sql`${platformTelemetry.occurredAt} < ${range.to}`));
      await this.writePlatformAudit(db,actorId,'telemetry.overview_viewed','platform_telemetry','overview',{from,to});
      const landingVisits=Number(row.landingVisits),trialConversions=Number(row.trialConversions);
      return {...row,conversionRate:landingVisits ? trialConversions/landingVisits : 0};
    });
  }

  async telemetryTimeseries(from: string, to: string, actorId: string) {
    const range = this.validDateRange(from,to);
    return this.db.system(async db=>{
      const rows = await db.select({
      day:sql<string>`to_char(date_trunc('day',${platformTelemetry.occurredAt}),'YYYY-MM-DD')`,
      landingVisits:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='landing_visit')::int`,
      trialSignups:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='trial_signup')::int`,
      trialConversions:sql<number>`count(*) filter(where ${platformTelemetry.eventType}='trial_converted')::int`,
      }).from(platformTelemetry).where(and(sql`${platformTelemetry.occurredAt} >= ${range.from}`,sql`${platformTelemetry.occurredAt} < ${range.to}`))
        .groupBy(sql`date_trunc('day',${platformTelemetry.occurredAt})`).orderBy(sql`date_trunc('day',${platformTelemetry.occurredAt})`);
      await this.writePlatformAudit(db,actorId,'telemetry.timeseries_viewed','platform_telemetry','timeseries',{from,to});
      return rows;
    });
  }

  async storePulse(actorId: string) {
    return this.db.system(async db => {
      await this.recomputeStoreHealth(db);
      const records = await db.select({
        id:storeHealthSnapshots.id,tenantId:tenants.id,name:tenants.name,lastBillAt:storeHealthSnapshots.lastBillAt,
        billsLast24h:storeHealthSnapshots.billsLast24h,billsLast72h:storeHealthSnapshots.billsLast72h,
        healthStatus:storeHealthSnapshots.healthStatus,computedAt:storeHealthSnapshots.computedAt,
      }).from(tenants).leftJoin(storeHealthSnapshots,eq(storeHealthSnapshots.tenantId,tenants.id))
        .where(isNull(tenants.deletedAt)).orderBy(tenants.name);
      await this.writePlatformAudit(db,actorId,'telemetry.store_pulse_viewed','store_health_snapshots','all');
      return records.map(row=>({...row,churnWarning:row.healthStatus==='at_risk'||row.healthStatus==='churned'}));
    });
  }

  private async refreshStoreHealth() {
    await this.db.system(db => this.recomputeStoreHealth(db));
  }

  private async recomputeStoreHealth(db: Db) {
    await db.execute(sql`
      INSERT INTO store_health_snapshots
        (tenant_id,last_bill_at,bills_last_24h,bills_last_72h,health_status,computed_at)
      SELECT t.id,MAX(o.billed_at),
        COUNT(o.id) FILTER (WHERE o.billed_at >= NOW()-INTERVAL '24 hours')::int,
        COUNT(o.id) FILTER (WHERE o.billed_at >= NOW()-INTERVAL '72 hours')::int,
        CASE
          WHEN t.status='CANCELLED' THEN 'churned'
          WHEN MAX(o.billed_at) IS NULL OR MAX(o.billed_at) < NOW()-INTERVAL '72 hours' THEN 'at_risk'
          WHEN MAX(o.billed_at) < NOW()-INTERVAL '24 hours' THEN 'idle'
          ELSE 'healthy'
        END::store_health_status,
        NOW()
      FROM tenants t
      LEFT JOIN orders o ON o.tenant_id=t.id AND o.billed_at IS NOT NULL
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      ON CONFLICT (tenant_id) DO UPDATE SET
        last_bill_at=EXCLUDED.last_bill_at,bills_last_24h=EXCLUDED.bills_last_24h,
        bills_last_72h=EXCLUDED.bills_last_72h,health_status=EXCLUDED.health_status,
        computed_at=EXCLUDED.computed_at
    `);
    await db.execute(sql`
      UPDATE dealer_store_attribution a
      SET is_active_paid =
        t.status='ACTIVE'
        AND t.settings #>> '{subscription,status}'='ACTIVE'
        AND COALESCE(NULLIF(t.settings #>> '{subscription,validUntil}','')::timestamptz > now(),false),
        converted_at = CASE
          WHEN t.settings #>> '{subscription,status}'='ACTIVE'
            AND COALESCE(NULLIF(t.settings #>> '{subscription,validUntil}','')::timestamptz > now(),false)
          THEN COALESCE(a.converted_at,now())
          ELSE a.converted_at
        END
      FROM tenants t
      WHERE t.id=a.tenant_id AND t.deleted_at IS NULL
    `);
    await db.execute(sql`
      UPDATE dealers d
      SET tier=CASE
        WHEN paid.store_count >= 31 THEN 'platinum'::dealer_tier
        WHEN paid.store_count >= 11 THEN 'gold'::dealer_tier
        ELSE 'silver'::dealer_tier
      END
      FROM (
        SELECT dealer_id,COUNT(*) FILTER (WHERE is_active_paid)::int AS store_count
        FROM dealer_store_attribution
        GROUP BY dealer_id
      ) paid
      WHERE d.id=paid.dealer_id
    `);
  }

  private async evaluateDealerTier(db: Db, dealerId: string) {
    const [result] = await db.select({
      paidStores:sql<number>`count(*) filter(where ${dealerStoreAttribution.isActivePaid}=true)::int`,
    }).from(dealerStoreAttribution).where(eq(dealerStoreAttribution.dealerId,dealerId));
    const paidStores=Number(result.paidStores);
    const tier = paidStores >= 31 ? 'platinum' : paidStores >= 11 ? 'gold' : 'silver';
    await db.update(dealers).set({tier,updatedAt:new Date()}).where(eq(dealers.id,dealerId));
  }

  private validDateRange(from: string, to: string) {
    const start = new Date(from), end = new Date(to);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime()-start.getTime() > 93*86400_000) {
      throw new BadRequestException('Provide a valid date range no longer than 93 days.');
    }
    return {from:start,to:end};
  }
}
