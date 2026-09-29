import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/guards';
import { PlatformActor, PlatformService } from './platform.service';
class LoginDto { @IsString() @Length(1,254) identifier!: string; @IsString() @Length(1,128) password!: string; }
class PasswordChangeDto {
 @IsString() @Length(1,128) currentPassword!: string;
 @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
class MerchantOnboardingDto {
 @IsString() @Length(2,120) @Matches(/\S/) storeName!: string;
 @IsString() @Matches(/^\d{10}$/) ownerPhone!: string;
 @IsIn(['restaurant','retail']) businessProfile!: 'restaurant'|'retail';
 @IsIn(['trial','starter_monthly','pro_yearly']) initialPlan!: 'trial'|'starter_monthly'|'pro_yearly';
}
class ImpersonationDto { @IsString() @Length(10,500) reason!: string; }
class QueryDto {
 @IsOptional() @IsString() @MaxLength(100) search?: string;
 @IsOptional() @IsIn(['TRIAL','ACTIVE','EXPIRED','SUSPENDED']) status?: string;
 @IsOptional() @IsIn(['starter_monthly','pro_yearly','enterprise_yearly']) plan?: string;
 @IsOptional() @IsIn(['healthy','idle','at_risk','churned']) health?: string;
 @IsOptional() @IsString() @MaxLength(32) dealerCode?: string;
 @IsOptional() @IsInt() @Min(1) page?: number;
 @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
class ChangeDto {
 @IsIn(['ACTIVATE','EXTEND','SUSPEND','REACTIVATE']) action!: string;
 @IsOptional() @IsIn(['starter_monthly','pro_yearly','enterprise_yearly']) plan?: string;
 @IsOptional() @IsInt() @Min(1) @Max(365) days?: number;
}
class ActivationDto { @IsUUID() tenantId!: string; @IsIn(['starter_monthly','pro_yearly']) plan!: string; }
class DealerDto {
 @IsString() @Length(1,100) @Matches(/\S/) name!: string;
 @Matches(/^\+?\d{10,15}$/) phone!: string;
 @IsEmail() @MaxLength(254) email!: string;
 @IsString() @MinLength(8) @MaxLength(128) password!: string;
 @Matches(/^[a-zA-Z0-9_-]{3,32}$/) dealerCode!: string;
 @IsInt() @Min(0) @Max(100) commissionPercent!: number;
 @IsOptional() @IsIn(['silver','gold','platinum']) tier?: 'silver'|'gold'|'platinum';
 @IsOptional() @IsString() @MaxLength(128) territory?: string;
 @IsOptional() @IsString() @MaxLength(128) city?: string;
}
class DealerPatchDto {
 @IsOptional() @IsIn(['ACTIVE','SUSPENDED']) status?: string;
 @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
 @IsOptional() @IsIn(['silver','gold','platinum']) tier?: 'silver'|'gold'|'platinum';
 @IsOptional() @IsString() @MaxLength(128) territory?: string;
 @IsOptional() @IsString() @MaxLength(128) city?: string;
}
class QuotaGrantDto {
 @IsInt() @Min(1) @Max(100000) seats!: number;
 @IsOptional() @IsString() @MaxLength(500) note?: string;
 @IsOptional() @IsISO8601() expiresAt?: string;
}
class PayoutCreateDto {
 @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) periodMonth!: string;
}
class PayoutSettleDto {
 @IsString() @Length(6,64) utrReference!: string;
}
class DateRangeDto {
 @IsISO8601() from!: string;
 @IsISO8601() to!: string;
}
class TelemetryDto {
 @IsIn(['landing_visit','pricing_view','trial_signup','trial_converted','pos_activated','store_churned'])
 eventType!: 'landing_visit'|'pricing_view'|'trial_signup'|'trial_converted'|'pos_activated'|'store_churned';
 @IsOptional() @IsString() @MaxLength(64) sessionId?: string;
 @IsOptional() @IsString() @MaxLength(64) visitorId?: string;
 @IsOptional() @IsString() @MaxLength(128) utmSource?: string;
 @IsOptional() @IsString() @MaxLength(128) utmMedium?: string;
 @IsOptional() @IsString() @MaxLength(128) utmCampaign?: string;
 @IsOptional() @IsString() @MaxLength(64) country?: string;
 @IsOptional() @IsString() @MaxLength(64) city?: string;
 @IsOptional() @IsString() @MaxLength(500) referrer?: string;
 @IsOptional() @IsString() @MaxLength(32) deviceType?: string;
 @IsOptional() @IsString() @MaxLength(500) path?: string;
}
interface Request {
 headers: { authorization?: string; ['user-agent']?: string };
 platformActor: PlatformActor;
 requestId?: string;
 ip?: string;
}
@Injectable()
export class PlatformGuard implements CanActivate {
 constructor(private readonly service: PlatformService) {}
 async canActivate(ctx: ExecutionContext) {
   const req = ctx.switchToHttp().getRequest<Request>();
   req.platformActor = await this.service.authenticate((req.headers.authorization ?? '').replace(/^Bearer /,''));
   return true;
 }
}
@Injectable()
export class SuperGuard implements CanActivate {
 canActivate(ctx: ExecutionContext) { if (ctx.switchToHttp().getRequest<Request>().platformActor.role !== 'SUPER_ADMIN') throw new ForbiddenException(); return true; }
}
@Injectable()
export class DealerGuard implements CanActivate {
 canActivate(ctx: ExecutionContext) { if (ctx.switchToHttp().getRequest<Request>().platformActor.role !== 'DEALER') throw new ForbiddenException(); return true; }
}
@Public()
@Controller('admin/auth')
export class PlatformAuthController {
 constructor(private readonly service: PlatformService) {}
 @Post('login') @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } })
 login(@Body() dto: LoginDto) { return this.service.login(dto.identifier,dto.password); }
 @Get('me') @UseGuards(PlatformGuard) me(@Req() req: Request) { return req.platformActor; }
 @Post('password-change') @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 } }) @UseGuards(PlatformGuard)
 changePassword(@Req() req: Request,@Body() dto: PasswordChangeDto) { return this.service.changePassword(req.platformActor,dto.currentPassword,dto.newPassword); }
}
@Public() @UseGuards(PlatformGuard,SuperGuard) @Controller('admin/super')
export class SuperController {
 constructor(private readonly service: PlatformService) {}
 @Get('metrics') metrics(@Req() req: Request) { return this.service.metrics(req.platformActor); }
 @Get('tenants') tenants(@Req() req: Request,@Query() query: QueryDto) { return this.service.merchants(req.platformActor,query); }
 @Post('tenants/:id/subscription') change(@Req() req: Request,@Param('id',ParseUUIDPipe) id: string,@Body() dto: ChangeDto) { return this.service.change(req.platformActor,id,dto); }
 @Post('tenants/:id/impersonate')
 impersonate(@Req() req: Request,@Param('id',ParseUUIDPipe) id: string,@Body() dto: ImpersonationDto) {
   return this.service.startImpersonation(req.platformActor,id,dto.reason,{requestId:req.requestId,ipAddress:req.ip,userAgent:req.headers['user-agent']});
 }
 @Post('impersonation/:sessionId/end')
 endImpersonation(@Req() req: Request,@Param('sessionId',ParseUUIDPipe) id: string) {
   return this.service.endImpersonation(req.platformActor,id,{requestId:req.requestId,ipAddress:req.ip,userAgent:req.headers['user-agent']});
 }
 @Get('dealers') dealers() { return this.service.listDealers(); }
 @Post('dealers') create(@Body() dto: DealerDto,@Req() req: Request) { return this.service.createDealer(dto,req.platformActor.sub); }
 @Patch('dealers/:id') update(@Param('id',ParseUUIDPipe) id: string,@Body() dto: DealerPatchDto,@Req() req: Request) { return this.service.updateDealer(id,dto,req.platformActor.sub); }
 @Get('dealers/:id/360') getDealer360(@Param('id',ParseUUIDPipe) id: string,@Req() req: Request) { return this.service.getDealer360(id,req.platformActor.sub); }
 @Post('dealers/:id/allocations') topUp(@Param('id',ParseUUIDPipe) id: string,@Body() dto: QuotaGrantDto,@Req() req: Request) {
   return this.service.topUpQuota(id,dto.seats,req.platformActor.sub,dto.note,dto.expiresAt);
 }
 @Post('dealers/:id/payouts') createPayout(@Param('id',ParseUUIDPipe) id: string,@Body() dto: PayoutCreateDto,@Req() req: Request) {
   return this.service.createDealerPayout(id,dto.periodMonth,req.platformActor.sub);
 }
 @Post('dealers/:id/payouts/:payoutId/settle') settlePayout(
   @Param('id',ParseUUIDPipe) id: string,@Param('payoutId',ParseUUIDPipe) payoutId: string,
   @Body() dto: PayoutSettleDto,@Req() req: Request,
 ) { return this.service.settleDealerPayout(id,payoutId,dto.utrReference,req.platformActor.sub); }
 @Get('telemetry/overview') telemetryOverview(@Query() query: DateRangeDto,@Req() req: Request) { return this.service.telemetryOverview(query.from,query.to,req.platformActor.sub); }
 @Get('telemetry/timeseries') telemetryTimeseries(@Query() query: DateRangeDto,@Req() req: Request) { return this.service.telemetryTimeseries(query.from,query.to,req.platformActor.sub); }
 @Get('store-pulse') storePulse(@Req() req: Request) { return this.service.storePulse(req.platformActor.sub); }
}
@Public() @UseGuards(PlatformGuard,DealerGuard) @Controller('admin/dealer')
export class DealerController {
 constructor(private readonly service: PlatformService) {}
 @Get('my-merchants') merchants(@Req() req: Request,@Query() query: QueryDto) { return this.service.merchants(req.platformActor,query); }
 @Get('stats') stats(@Req() req: Request) { return this.service.metrics(req.platformActor); }
 @Post('merchants') onboard(@Req() req: Request,@Body() dto: MerchantOnboardingDto) { return this.service.onboardMerchant(req.platformActor,dto); }
 @Post('activate-merchant') activate(@Req() req: Request,@Body() dto: ActivationDto) { return this.service.change(req.platformActor,dto.tenantId,{action:'ACTIVATE',plan:dto.plan}); }
}

@Public()
@Controller('public/telemetry')
export class PublicTelemetryController {
 constructor(private readonly service: PlatformService) {}
 @Post('events')
 @Throttle({ medium: { limit: 120, ttl: 60_000 } })
 ingest(@Body() dto: TelemetryDto) { return this.service.ingestTelemetry(dto); }
}
