import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { tenants, staff, dealers } from '../db/schema';
describe('dealer signup linking',()=>{
 it('validates the dealer and provisions a seven day trial with its immutable ID',async()=>{
  let otp='';let created:any;
  const db={system:async(fn:any)=>fn({select:()=>({from:(table:any)=>({where:()=>({limit:()=>table===staff?Promise.resolve([]):{for:async()=>[{id:'dealer-id',dealerCode:'DLR101',status:'ACTIVE'}]}})})}),insert:(table:any)=>({values:(v:any)=>{if(table===tenants)created=v;return{returning:async()=>{throw new Error('STOP_AFTER_TENANT_INSERT');}};}})})};
  const sms={sendOtp:async(_phone:string,code:string)=>{otp=code;return{success:true};}};
  const service=new AuthService(db as any,{} as any,sms as any);
  await service.sendOtp('9999000001');
  const before=Date.now();
  await expect(service.verifyOtp({phone:'9999000001',otp,storeName:'Test',dealerCode:'dlr101',pin:'5678'})).rejects.toThrow('STOP_AFTER_TENANT_INSERT');
  expect(created.dealerId).toBe('dealer-id');expect(created.dealerCode).toBe('DLR101');expect(created.settings.subscription.status).toBe('TRIAL');
  expect(Date.parse(created.settings.subscription.validUntil)-before).toBeGreaterThanOrEqual(7*86400000);
 });
 it('rejects an unknown or suspended code before creating a tenant',async()=>{
  let otp='';const insert=vi.fn();
  const db={system:async(fn:any)=>fn({insert,select:()=>({from:(table:any)=>({where:()=>({limit:()=>table===staff?Promise.resolve([]):{for:async()=>[]}})})})})};
  const service=new AuthService(db as any,{} as any,{sendOtp:async(_phone:string,code:string)=>{otp=code;return{success:true};}} as any);
  await service.sendOtp('9999000002');await expect(service.verifyOtp({phone:'9999000002',otp,dealerCode:'INVALID'})).rejects.toThrow();expect(insert).not.toHaveBeenCalled();
 });
});
