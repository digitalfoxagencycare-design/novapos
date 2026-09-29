import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/guards';
import { PlatformActor, PlatformService } from './platform.service';
class LoginDto { @IsString() @Length(1,254) identifier!: string; @IsString() @Length(1,128) password!: string; }
class QueryDto {
 @IsOptional() @IsString() @MaxLength(100) search?: string;
 @IsOptional() @IsIn(['TRIAL','ACTIVE','EXPIRED','SUSPENDED']) status?: string;
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
}
class DealerPatchDto {
 @IsOptional() @IsIn(['ACTIVE','SUSPENDED']) status?: string;
 @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
}
interface Request { headers: { authorization?: string }; platformActor: PlatformActor }
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
}
@Public() @UseGuards(PlatformGuard,SuperGuard) @Controller('admin/super')
export class SuperController {
 constructor(private readonly service: PlatformService) {}
 @Get('metrics') metrics(@Req() req: Request) { return this.service.metrics(req.platformActor); }
 @Get('tenants') tenants(@Req() req: Request,@Query() query: QueryDto) { return this.service.merchants(req.platformActor,query); }
 @Post('tenants/:id/subscription') change(@Req() req: Request,@Param('id',ParseUUIDPipe) id: string,@Body() dto: ChangeDto) { return this.service.change(req.platformActor,id,dto); }
 @Get('dealers') dealers() { return this.service.listDealers(); }
 @Post('dealers') create(@Body() dto: DealerDto) { return this.service.createDealer(dto); }
 @Patch('dealers/:id') update(@Param('id',ParseUUIDPipe) id: string,@Body() dto: DealerPatchDto) { return this.service.updateDealer(id,dto); }
}
@Public() @UseGuards(PlatformGuard,DealerGuard) @Controller('admin/dealer')
export class DealerController {
 constructor(private readonly service: PlatformService) {}
 @Get('my-merchants') merchants(@Req() req: Request,@Query() query: QueryDto) { return this.service.merchants(req.platformActor,query); }
 @Get('stats') stats(@Req() req: Request) { return this.service.metrics(req.platformActor); }
 @Post('activate-merchant') activate(@Req() req: Request,@Body() dto: ActivationDto) { return this.service.change(req.platformActor,dto.tenantId,{action:'ACTIVATE',plan:dto.plan}); }
}
