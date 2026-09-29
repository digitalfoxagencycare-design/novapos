import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../db/db.service';
import { dealers, platformAdmins, tenants, licenseActivations } from '../db/schema';
import { SAAS_PLANS, subscriptionStatus } from '../payments/subscription.service';

export interface PlatformActor { sub: string; role: 'SUPER_ADMIN' | 'DEALER'; name: string; dealerId?: string; dealerCode?: string }
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
export class PlatformService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}
  async login(identifier: string, password: string) {
    const id = identifier.trim().toLowerCase();
    const actor = await this.db.system(async db => {
      const [admin] = await db.select().from(platformAdmins).where(or(eq(platformAdmins.email, id), eq(platformAdmins.phone, id))).limit(1);
      const [dealer] = admin ? [] : await db.select().from(dealers).where(or(eq(dealers.email, id), eq(dealers.phone, id))).limit(1);
      const account = admin ?? dealer;
      // Always perform a password hash check, including unknown accounts.
      const hash = account?.passwordHash ?? await argon2.hash('invalid-account-password');
      const valid = await argon2.verify(hash, password).catch(() => false);
      if (!account || !valid || (dealer && dealer.status !== 'ACTIVE') || (admin && admin.role !== 'SUPER_ADMIN')) throw new UnauthorizedException('Invalid credentials');
      return { sub: account.id, name: account.name, role: admin ? 'SUPER_ADMIN' : 'DEALER', ...(dealer ? { dealerId: dealer.id, dealerCode: dealer.dealerCode } : {}) } as PlatformActor;
    });
    return { actor, accessToken: this.jwt.sign({ ...actor, kind: 'platform' }, { audience: 'novapos-platform', expiresIn: '1h' }) };
  }
  async authenticate(token: string): Promise<PlatformActor> {
    let claims: PlatformActor & { kind: string };
    try { claims = this.jwt.verify(token, { audience: 'novapos-platform' }); } catch { throw new UnauthorizedException('Session expired. Sign in again.'); }
    if (claims.kind !== 'platform' || !['SUPER_ADMIN','DEALER'].includes(claims.role)) throw new UnauthorizedException();
    return this.db.system(async db => {
      if (claims.role === 'DEALER') {
        const [d] = await db.select().from(dealers).where(eq(dealers.id, claims.sub)).limit(1);
        if (!d || d.status !== 'ACTIVE') throw new UnauthorizedException('Dealer account suspended');
        return { sub: d.id, role: 'DEALER', name: d.name, dealerId: d.id, dealerCode: d.dealerCode };
      }
      const [a] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, claims.sub)).limit(1);
      if (!a || a.role !== 'SUPER_ADMIN') throw new UnauthorizedException();
      return { sub: a.id, name: a.name, role: 'SUPER_ADMIN' };
    });
  }
  async merchants(actor: PlatformActor, query: { search?: string; status?: string; dealerCode?: string; page?: number; limit?: number }) {
    return this.db.system(async db => {
      // Ownership is imposed here; caller-provided dealer codes cannot expand it.
      const rows = await db.select().from(tenants).where(and(isNull(tenants.deletedAt), actor.role === 'DEALER' ? eq(tenants.dealerId, actor.sub) : undefined));
      const search = (query.search ?? '').trim().toLowerCase();
      const list = rows.map(t => ({ id: t.id, name: t.name, slug: t.slug, dealerCode: t.dealerCode,
        phone: String((t.settings as any)?.ownerPhone ?? ''), businessType: String((t.settings as any)?.profile ?? ''), ...subscriptionStatus(t) }))
        .filter(t => (!search || [t.name,t.slug,t.phone,t.dealerCode].some(v => v?.toLowerCase().includes(search))) && (!query.status || t.status === query.status) && (!query.dealerCode || t.dealerCode === query.dealerCode))
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
      await db.insert(licenseActivations).values({ tenantId: t.id, dealerId: t.dealerId, actorId: actor.sub, actorRole: actor.role, action: input.action, plan: sub.plan, validUntil: new Date(sub.validUntil), amountMinor: amount, commissionMinor: Math.round(amount*(dealer?.commissionPercent ?? 0)/100) });
      return subscriptionStatus({ ...t, settings: { ...settings, subscription: sub } });
    });
  }
  async listDealers() {
    return this.db.system(db => db.select({ id: dealers.id, name: dealers.name, phone: dealers.phone, email: dealers.email, dealerCode: dealers.dealerCode, status: dealers.status, commissionPercent: dealers.commissionPercent,
      merchantCount: sql<number>`(select count(*)::int from tenants t where t.dealer_id = ${dealers.id} and t.deleted_at is null)`,
      activationVolume: sql<number>`(select count(*)::int from license_activations a where a.dealer_id = ${dealers.id} and a.action = 'ACTIVATE')` }).from(dealers).orderBy(dealers.name));
  }
  async createDealer(input: { name: string; phone: string; email: string; password: string; dealerCode: string; commissionPercent: number }) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try { return await this.db.system(async db => {
      const [d] = await db.insert(dealers).values({ name: input.name.trim(),phone: input.phone,email: input.email.toLowerCase().trim(),dealerCode: input.dealerCode.toUpperCase().trim(),commissionPercent: input.commissionPercent,passwordHash }).returning({ id: dealers.id }); return d;
    }); } catch (e: any) { if (e.code === '23505') throw new BadRequestException('Email, phone or dealer code already exists'); throw e; }
  }
  async updateDealer(id: string, input: { status?: string; commissionPercent?: number }) {
    return this.db.system(async db => { const [d] = await db.update(dealers).set({ ...input, updatedAt: new Date() }).where(eq(dealers.id,id)).returning({ id: dealers.id }); if (!d) throw new BadRequestException('Dealer not found'); return d; });
  }
}
