import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PlatformAuthController, SuperController, DealerController, PlatformGuard, SuperGuard, DealerGuard } from './platform.controller';
import { PlatformService } from './platform.service';

describe('platform HTTP security and validation',()=>{
 let app: INestApplication;
 const dealer={sub:'00000000-0000-4000-8000-000000000001',role:'DEALER',name:'Dealer'};
 const jwt=new JwtService({secret:'test-platform-secret',signOptions:{issuer:'novapos'},verifyOptions:{issuer:'novapos'}});
 const tokens={dealer:jwt.sign({...dealer,kind:'platform'},{audience:'novapos-platform'}),tenant:jwt.sign({sub:'tenant',role:'OWNER'},{audience:'novapos-clients'}),super:jwt.sign({sub:'admin',role:'SUPER_ADMIN',kind:'platform'},{audience:'novapos-platform'})};
 beforeAll(async()=>{
  const m=await Test.createTestingModule({controllers:[PlatformAuthController,SuperController,DealerController],providers:[PlatformGuard,SuperGuard,DealerGuard,{provide:PlatformService,useValue:{
   authenticate:async(token:string)=>{const c=jwt.verify(token,{audience:'novapos-platform'});return c;},
   merchants:async(actor:any)=>({items:[],scope:actor.sub}),metrics:async()=>({totalStores:0}),change:async(actor:any,id:string)=>({actor:actor.sub,id}),
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
});
