import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PlatformAuthController, SuperController, DealerController, PlatformGuard, SuperGuard, DealerGuard, PublicTelemetryController } from './platform.controller';
import { PlatformService } from './platform.service';

describe('platform HTTP security and validation',()=>{
 let app: INestApplication;
 const dealer={sub:'00000000-0000-4000-8000-000000000001',role:'DEALER',name:'Dealer'};
 const jwt=new JwtService({secret:'test-platform-secret',signOptions:{issuer:'novapos'},verifyOptions:{issuer:'novapos'}});
 const tokens={dealer:jwt.sign({...dealer,kind:'platform'},{audience:'novapos-platform'}),tenant:jwt.sign({sub:'tenant',role:'OWNER'},{audience:'novapos-clients'}),super:jwt.sign({sub:'admin',role:'SUPER_ADMIN',kind:'platform'},{audience:'novapos-platform'})};
 beforeAll(async()=>{
  const m=await Test.createTestingModule({controllers:[PlatformAuthController,SuperController,DealerController,PublicTelemetryController],providers:[PlatformGuard,SuperGuard,DealerGuard,{provide:PlatformService,useValue:{
   authenticate:async(token:string)=>{if(!token)throw new UnauthorizedException();const c=jwt.verify(token,{audience:'novapos-platform'});return c;},
   merchants:async(actor:any)=>({items:[],scope:actor.sub}),metrics:async()=>({totalStores:0}),change:async(actor:any,id:string)=>({actor:actor.sub,id}),
    onboardMerchant:vi.fn(async(actor:any,input:any)=>({tenant:{name:input.storeName},owner:{phone:input.ownerPhone},dealer:actor.sub})),
    changePassword:vi.fn(async(actor:any)=>({accessToken:`rotated-${actor.sub}`})),
    startImpersonation:vi.fn(async(actor:any,id:string,input:string)=>({sessionId:'00000000-0000-4000-8000-000000000010',actor:actor.sub,tenantId:id,reason:input})),
    endImpersonation:vi.fn(async(actor:any,id:string)=>({sessionId:id,actor:actor.sub,revoked:true})),
    getDealer360:vi.fn(async(id:string)=>({dealer:{id}})),
    topUpQuota:vi.fn(async(id:string,seats:number)=>({dealerId:id,seats})),
    createDealerPayout:vi.fn(async(id:string,periodMonth:string)=>({dealerId:id,periodMonth})),
    settleDealerPayout:vi.fn(async(id:string,payoutId:string,utr:string)=>({dealerId:id,payoutId,utr})),
    telemetryOverview:vi.fn(async()=>({landingVisits:0})),
    telemetryTimeseries:vi.fn(async()=>[]),
    storePulse:vi.fn(async()=>[]),
    ingestTelemetry:vi.fn(async(input:any)=>({accepted:true,eventType:input.eventType})),
   }}]}).compile();
  app=m.createNestApplication();app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));await app.init();
 });
 afterAll(async()=>{await app?.close();});
 it('denies dealer access to all super merchant controls',async()=>{expect((await request(app.getHttpServer()).get('/admin/super/tenants').auth(tokens.dealer,{type:'bearer'})).status).toBe(403);});
 it('rejects arbitrary dealer role access on the super controller',async()=>{expect((await request(app.getHttpServer()).post('/admin/super/dealers').auth(tokens.dealer,{type:'bearer'}).send({})).status).toBe(403);});
 it('passes the verified dealer identity, not a request body identity',async()=>{const r=await request(app.getHttpServer()).get('/admin/dealer/my-merchants').auth(tokens.dealer,{type:'bearer'});expect(r.status).toBe(200);expect(r.body.scope).toBe(dealer.sub);});
 it('rejects mass assignment, unknown plan and negative extensions',async()=>{
  const path='/admin/super/tenants/00000000-0000-4000-8000-000000000002/subscription';
  for(const body of [{action:'EXTEND',days:-7},{action:'ACTIVATE',plan:'free_forever'},{action:'ACTIVATE',role:'SUPER_ADMIN'}])expect((await request(app.getHttpServer()).post(path).auth(tokens.super,{type:'bearer'}).send(body)).status).toBe(400);
 });
 it('bounds pagination and rejects malformed IDs',async()=>{expect((await request(app.getHttpServer()).get('/admin/super/tenants?limit=9999').auth(tokens.super,{type:'bearer'})).status).toBe(400);expect((await request(app.getHttpServer()).post('/admin/dealer/activate-merchant').auth(tokens.dealer,{type:'bearer'}).send({tenantId:'invalid',plan:'pro_yearly'})).status).toBe(400);});
 it('allows only authenticated dealers to create merchants with validated onboarding data',async()=>{
  const path='/admin/dealer/merchants';
  expect((await request(app.getHttpServer()).post(path).auth(tokens.super,{type:'bearer'}).send({storeName:'Sri Krishna Bakery',ownerPhone:'9848787308',businessProfile:'restaurant',initialPlan:'trial'})).status).toBe(403);
  expect((await request(app.getHttpServer()).post(path).auth(tokens.dealer,{type:'bearer'}).send({storeName:'Sri Krishna Bakery',ownerPhone:'98765',businessProfile:'restaurant',initialPlan:'trial'})).status).toBe(400);
  const response=await request(app.getHttpServer()).post(path).auth(tokens.dealer,{type:'bearer'}).send({storeName:'Sri Krishna Bakery',ownerPhone:'9848787308',businessProfile:'restaurant',initialPlan:'trial'});
  expect(response.status).toBe(201);expect(response.body.dealer).toBe(dealer.sub);
 });
 it('requires a valid platform session before changing a platform password',async()=>{
  expect((await request(app.getHttpServer()).post('/admin/auth/password-change').send({currentPassword:'old-password',newPassword:'new-password-123'})).status).toBe(401);
  const response=await request(app.getHttpServer()).post('/admin/auth/password-change').auth(tokens.dealer,{type:'bearer'}).send({currentPassword:'old-password',newPassword:'new-password-123'});
  expect(response.status).toBe(201);expect(response.body.accessToken).toBe(`rotated-${dealer.sub}`);
 });
 it('restricts audited merchant impersonation to super admins and validates its reason',async()=>{
  const path='/admin/super/tenants/00000000-0000-4000-8000-000000000002/impersonate';
  expect((await request(app.getHttpServer()).post(path).auth(tokens.dealer,{type:'bearer'}).send({reason:'Customer support case 42'})).status).toBe(403);
  expect((await request(app.getHttpServer()).post(path).auth(tokens.super,{type:'bearer'}).send({reason:'short'})).status).toBe(400);
  const response=await request(app.getHttpServer()).post(path).auth(tokens.super,{type:'bearer'}).send({reason:'Customer support case 42'});
  expect(response.status).toBe(201);expect(response.body.tenantId).toBe('00000000-0000-4000-8000-000000000002');
 });
 it('requires a super-admin session to revoke an impersonation session',async()=>{
  const path='/admin/super/impersonation/00000000-0000-4000-8000-000000000010/end';
  expect((await request(app.getHttpServer()).post(path).auth(tokens.dealer,{type:'bearer'})).status).toBe(403);
  const response=await request(app.getHttpServer()).post(path).auth(tokens.super,{type:'bearer'});
  expect(response.status).toBe(201);expect(response.body.revoked).toBe(true);
 });
 it('guards dealer 360 and quota endpoints as super-admin-only',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  expect((await request(app.getHttpServer()).get(`/admin/super/dealers/${id}/360`).auth(tokens.dealer,{type:'bearer'})).status).toBe(403);
  expect((await request(app.getHttpServer()).post(`/admin/super/dealers/${id}/allocations`).auth(tokens.super,{type:'bearer'}).send({seats:0})).status).toBe(400);
  expect((await request(app.getHttpServer()).post(`/admin/super/dealers/${id}/allocations`).auth(tokens.super,{type:'bearer'}).send({seats:5})).status).toBe(201);
 });
 it('validates authenticated payout operations and date range parameters',async()=>{
  const id='00000000-0000-4000-8000-000000000001';
  expect((await request(app.getHttpServer()).post(`/admin/super/dealers/${id}/payouts`).auth(tokens.super,{type:'bearer'}).send({periodMonth:'2026-13'})).status).toBe(400);
  expect((await request(app.getHttpServer()).post(`/admin/super/dealers/${id}/payouts`).auth(tokens.super,{type:'bearer'}).send({periodMonth:'2026-08'})).status).toBe(201);
  expect((await request(app.getHttpServer()).get('/admin/super/telemetry/overview?from=bad&to=bad').auth(tokens.super,{type:'bearer'})).status).toBe(400);
 });
 it('accepts validated public telemetry without a platform authorization token',async()=>{
  const response=await request(app.getHttpServer()).post('/public/telemetry/events').send({eventType:'landing_visit',path:'/'});
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({accepted:true,eventType:'landing_visit'});
  expect((await request(app.getHttpServer()).post('/public/telemetry/events').send({eventType:'__proto__'})).status).toBe(400);
 });
});
