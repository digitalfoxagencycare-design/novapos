import { Body, Controller, Headers, Param, Post, Req, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { GatewayRegistry } from './gateways/registry';
import { Public, RequirePermissions } from '../auth/guards';

class PayDto {
  @IsString() clientPaymentId!: string;
  @IsEnum(['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'CREDIT', 'VOUCHER'])
  method!: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'CREDIT' | 'VOUCHER';
  @IsInt() @Min(1) amountMinor!: number;
  @IsOptional() @IsInt() @Min(0) tenderedMinor?: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() gateway?: string;
}

class SplitDto {
  @IsEnum(['EVEN', 'AMOUNTS', 'BY_LINE']) mode!: 'EVEN' | 'AMOUNTS' | 'BY_LINE';
  @IsOptional() @IsInt() @Min(1) ways?: number;
  @IsOptional() @IsArray() amountsMinor?: number[];
  @IsOptional() @IsArray() groups?: string[][];
}

class RefundDto {
  @IsString() clientRefundId!: string;
  @IsInt() @Min(1) amountMinor!: number;
  @IsString() reason!: string;
}

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly gateways: GatewayRegistry,
  ) {}

  @Post('orders/:orderId/payments')
  @RequirePermissions('payment:create')
  @ApiOperation({
    summary: 'Take a payment',
    description: 'Idempotent on clientPaymentId. Cash over-tender returns change; card over-payment is rejected.',
  })
  pay(@Param('orderId') orderId: string, @Body() dto: PayDto) {
    return this.payments.pay(orderId, dto);
  }

  @Post('orders/:orderId/split')
  @RequirePermissions('payment:create')
  @ApiOperation({ summary: 'Compute a bill split — evenly, by amount, or by line' })
  split(@Param('orderId') orderId: string, @Body() dto: SplitDto) {
    return this.payments.computeSplit(orderId, dto as never);
  }

  @Post('payments/:id/refund')
  @RequirePermissions('payment:refund')
  refund(@Param('id') id: string, @Body() dto: RefundDto) {
    return this.payments.refund(id, dto);
  }

  @Public()
  @Post('webhooks/payments/:gateway')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Provider webhook endpoint',
    description:
      'Signature-verified against the raw request body. Unverified events are rejected — an unauthenticated ' +
      'webhook that could mark an order paid would be free food.',
  })
  webhook(
    @Param('gateway') gateway: string,
    @Req() req: { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    return this.payments.handleWebhook(gateway, raw, headers);
  }

  @Post('payments/gateways')
  @RequirePermissions('settings:read')
  listGateways() {
    return this.gateways.list();
  }
}
