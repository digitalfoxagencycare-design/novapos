import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { PlatformService } from './platform.service';
const actor={sub:'00000000-0000-4000-8000-000000000001',role:'DEALER',name:'Dealer'} as const;
describe('dealer SQL scope',()=>{
 it('adds the authenticated dealer ID even when another dealer code is supplied',async()=>{
  let predicate:any;
  const db={system:async(fn:any)=>fn({select:()=>({from:()=>({leftJoin:()=>({where:async(p:any)=>{predicate=p;return[];}})})})})};
  await new PlatformService(db as any,{} as any).merchants(actor,{dealerCode:'OTHER'});
  const query=new PgDialect().sqlToQuery(predicate);
  expect(query.sql).toContain('"tenants"."dealer_id" =');expect(query.params).toContain(actor.sub);
 });
 it('scopes the locked merchant lookup and makes no writes when not owned',async()=>{
  let reads=0;let predicate:any;const insert=vi.fn();const update=vi.fn();
  const db={system:async(fn:any)=>fn({insert,update,select:()=>({from:()=>({where:(p:any)=>({for:async()=>{reads++;if(reads===1)return[{id:actor.sub,status:'ACTIVE'}];predicate=p;return[];}})})})})};
  await expect(new PlatformService(db as any,{} as any).change(actor,'00000000-0000-4000-8000-000000000002',{action:'ACTIVATE',plan:'pro_yearly'})).rejects.toThrow('outside your scope');
  const query=new PgDialect().sqlToQuery(predicate);expect(query.params).toContain(actor.sub);expect(query.sql).toContain('"tenants"."dealer_id" =');expect(insert).not.toHaveBeenCalled();expect(update).not.toHaveBeenCalled();
 });
});
