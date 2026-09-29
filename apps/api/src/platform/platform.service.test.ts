import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { licenseChange, PlatformService } from './platform.service';
import { DealerGuard, SuperGuard } from './platform.controller';
const now = Date.parse('2026-09-29T00:00:00Z');
const trial = {status:'TRIAL',plan:'starter_monthly',validUntil:new Date(now+86400000).toISOString()};
describe('platform license boundaries',()=>{
 it('activates the requested plan for exactly 365 days',()=>{const s=licenseChange(trial,'ACTIVATE','pro_yearly',undefined,now);expect(s.status).toBe('ACTIVE');expect(Date.parse(s.validUntil)-now).toBe(365*86400000);});
 it('extends a trial from its future expiry without making it paid',()=>{const s=licenseChange(trial,'EXTEND',undefined,7,now);expect(s.status).toBe('TRIAL');expect(Date.parse(s.validUntil)-now).toBe(8*86400000);});
 it('extends an expired license from now',()=>{expect(Date.parse(licenseChange({...trial,validUntil:'2020-01-01'},'EXTEND',undefined,30,now).validUntil)-now).toBe(30*86400000);});
 it('preserves trial identity through suspension and reactivation',()=>{const s=licenseChange(trial,'SUSPEND',undefined,undefined,now);expect(s.status).toBe('SUSPENDED');expect(licenseChange(s,'REACTIVATE',undefined,undefined,now).status).toBe('TRIAL');});
 it('rejects invalid days, plans and expired reactivation',()=>{for(const d of [0,-1,366,1.5,NaN])expect(()=>licenseChange(trial,'EXTEND',undefined,d,now)).toThrow();expect(()=>licenseChange(trial,'ACTIVATE','__proto__',undefined,now)).toThrow();expect(()=>licenseChange({...trial,validUntil:'2020-01-01'},'REACTIVATE',undefined,undefined,now)).toThrow();});
 it('rejects a tenant JWT on the platform boundary before querying the database',async()=>{const jwt=new JwtService({secret:'test-secret',signOptions:{issuer:'novapos',audience:'novapos-clients'},verifyOptions:{issuer:'novapos',audience:'novapos-clients'}});const db={system:vi.fn()};const service=new PlatformService(db as any,jwt);await expect(service.authenticate(jwt.sign({sub:'x',role:'OWNER',tenantId:'t'}))).rejects.toThrow();expect(db.system).not.toHaveBeenCalled();});
 it('rechecks dealer suspension for an otherwise valid token',async()=>{const jwt=new JwtService({secret:'test-secret',signOptions:{issuer:'novapos'},verifyOptions:{issuer:'novapos'}});const db={system:async(fn:any)=>fn({select:()=>({from:()=>({where:()=>({limit:async()=>[{id:'d',status:'SUSPENDED'}]})})})})};await expect(new PlatformService(db as any,jwt).authenticate(jwt.sign({sub:'d',role:'DEALER',kind:'platform'},{audience:'novapos-platform'}))).rejects.toThrow('suspended');});
 it('rejects dealers at super routes and super admins at dealer-only routes',()=>{const ctx=(role:string)=>({switchToHttp:()=>({getRequest:()=>({platformActor:{role}})})}) as any;expect(()=>new SuperGuard().canActivate(ctx('DEALER'))).toThrow();expect(()=>new DealerGuard().canActivate(ctx('SUPER_ADMIN'))).toThrow();});
});
