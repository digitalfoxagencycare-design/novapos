import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './guards';
import type { TenantContext } from '../tenancy/tenant-context';

class LoginDto {
  @IsString() tenantSlug!: string;
  @IsEmail() email!: string;
  @MinLength(8) password!: string;
}

class PinLoginDto {
  @IsString() tenantSlug!: string;
  @IsString() outletCode!: string;
  @Length(4, 8) pin!: string;
}

class RefreshDto {
  @IsString() refreshToken!: string;
}

class LogoutDto {
  @IsOptional() @IsString() refreshToken?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Req() req: { headers: Record<string, string>; ip: string }) {
    return this.auth.login({
      ...dto,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('login/pin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with a till PIN for fast operator switching' })
  loginPin(@Body() dto: PinLoginDto, @Req() req: { headers: Record<string, string>; ip: string }) {
    return this.auth.loginWithPin({
      ...dto,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new access token' })
  refresh(@Body() dto: RefreshDto, @Req() req: { headers: Record<string, string>; ip: string }) {
    return this.auth.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: LogoutDto) {
    if (dto.refreshToken) await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in operator, their role and permissions' })
  me(@CurrentUser() user: TenantContext) {
    return {
      staffId: user.staffId,
      tenantId: user.tenantId,
      outletId: user.outletId,
      role: user.role,
      permissions: user.permissions,
    };
  }
}
