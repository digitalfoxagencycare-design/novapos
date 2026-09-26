import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '../auth/guards';
import type { TenantContext } from '../tenancy/tenant-context';

class CreateSubscriptionOrderDto {
  @IsString()
  @IsNotEmpty()
  planKey!: string;
}

class VerifySubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planKey!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get list of available SaaS subscription tiers' })
  getPlans() {
    return this.subscriptions.getAvailablePlans();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current tenant SaaS subscription and trial status' })
  getStatus(@CurrentUser() user: TenantContext) {
    return this.subscriptions.getStatus(user.tenantId);
  }

  @Post('create-order')
  @HttpCode(200)
  @ApiOperation({ summary: 'Initialize a Razorpay order for plan upgrade' })
  createOrder(
    @CurrentUser() user: TenantContext,
    @Body() dto: CreateSubscriptionOrderDto,
  ) {
    return this.subscriptions.createOrder(user.tenantId, dto.planKey);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Razorpay payment signature and activate plan' })
  verifyPayment(
    @CurrentUser() user: TenantContext,
    @Body() dto: VerifySubscriptionDto,
  ) {
    return this.subscriptions.verifyAndActivate({
      tenantId: user.tenantId,
      planKey: dto.planKey,
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      signature: dto.signature,
    });
  }
}
