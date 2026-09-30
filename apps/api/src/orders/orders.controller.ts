import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrdersService } from './orders.service';
import { RequirePermissions, CurrentUser } from '../auth/guards';
import type { TenantContext } from '../tenancy/tenant-context';
import { ReceiptService } from '../printing/receipt.service';

class DiscountDto {
  @IsEnum(['PERCENT', 'FIXED']) type!: 'PERCENT' | 'FIXED';
  @IsNumber() @Min(0) value!: number;
  @IsOptional() @IsString() reason?: string;
}

class OrderLineDto {
  @IsString() clientLineId!: string;
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) modifierIds?: string[];
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @ValidateNested() @Type(() => DiscountDto) discount?: DiscountDto;
  @IsOptional() @IsUUID() stationId?: string;
}

class CreateOrderDto {
  @IsString() clientOrderId!: string;
  @IsOptional() @IsString() clientRequestId?: string;
  @IsUUID() outletId!: string;
  @IsEnum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QUICK_BILL'])
  channel!: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QUICK_BILL';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tableIds?: string[];
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsInt() @Min(1) guestCount?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderLineDto) lines!: OrderLineDto[];
  @IsOptional() @ValidateNested() @Type(() => DiscountDto) orderDiscount?: DiscountDto;
  @IsOptional() @IsNumber() @Min(0) serviceChargePercent?: number;
  @IsOptional() @IsInt() @Min(0) tipMinor?: number;
  @IsOptional() @IsInt() @Min(0) deliveryChargeMinor?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() placedAt?: string;
}

class VoidOrderDto {
  @IsString() reason!: string;
}

export class PosSaleLineDto {
  @IsOptional() @IsString() @MaxLength(64) itemId?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsNumber() @Min(0.001) @Max(100_000) quantity!: number;
  @IsNumber() @Min(0) @Max(10_000_000) price!: number;
  @IsOptional() @IsString() @MaxLength(16) uom?: string;
  @IsOptional() @IsString() @MaxLength(32) taxSlabId?: string;
  /** Sent by the native POS app instead of a slab id: the GST percentage printed on the receipt. */
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstRate?: number;
  @IsOptional() @IsString() @MaxLength(16) hsnSac?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) netMinor?: number;
}

export class PosSaleDto {
  @IsString() @MaxLength(64) clientOrderId!: string;
  @IsOptional() @IsString() @MaxLength(40) orderNumber?: string;
  /**
   * Only for receipts already issued by an offline terminal. Omit it for live sales and the
   * server allocates the next number from the outlet's gapless series.
   */
  @IsOptional() @Matches(/^[A-Za-z0-9][A-Za-z0-9/_.-]{2,39}$/, { message: 'invoiceNumber may only contain letters, digits and / _ . - (3-40 chars)' }) invoiceNumber?: string;
  @IsNumber() @Min(0.01) @Max(1_000_000) amount!: number;
  @IsEnum(['cash', 'upi', 'card', 'credit']) paymentMode!: 'cash' | 'upi' | 'card' | 'credit';
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() taxSnapshot?: any;
  @IsOptional() receiptSnapshot?: any;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PosSaleLineDto) lines?: PosSaleLineDto[];
  @IsOptional() @IsISO8601() placedAt?: string;
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly receipts: ReceiptService,
  ) {}

  @Post('pos-sale')
  // A sale is an order AND a captured payment, so the caller needs both rights (waiters have only the first).
  @RequirePermissions('order:create', 'payment:create')
  @ApiOperation({ summary: 'Record completed retail/counter POS sale directly' })
  recordPosSale(@Body() dto: PosSaleDto) {
    return this.orders.recordPosSale(dto);
  }

  @Get('sales')
  @RequirePermissions('order:read')
  @ApiOperation({ summary: 'List recent completed sales for this outlet' })
  listSales(@Query('outletId') outletId: string, @Query('limit') limit: string, @CurrentUser() user: TenantContext) {
    return this.orders.listSales(outletId ?? user.outletId!, limit ? parseInt(limit, 10) : 100);
  }

  @Post()
  @RequirePermissions('order:create')
  @ApiOperation({
    summary: 'Create or update an order',
    description:
      'Idempotent on clientOrderId. An offline POS replaying a queued batch will not create duplicates. ' +
      'All prices, discounts and taxes are recomputed server-side from menu data — client-supplied ' +
      'amounts are ignored.',
  })
  upsert(@Body() dto: CreateOrderDto) {
    return this.orders.upsertOrder(dto as never);
  }

  @Get(':id')
  @RequirePermissions('order:read')
  find(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Get()
  @RequirePermissions('order:read')
  @ApiOperation({ summary: 'Open orders at an outlet — the POS running-tabs view' })
  list(@Query('outletId') outletId: string, @CurrentUser() user: TenantContext) {
    return this.orders.listOpen(outletId ?? user.outletId!);
  }

  @Post(':id/fire')
  @RequirePermissions('order:update')
  @ApiOperation({
    summary: 'Send unfired lines to the kitchen',
    description: 'Creates one KOT per station, pushes to KDS screens and queues station printers.',
  })
  fire(@Param('id') id: string) {
    return this.orders.fire(id);
  }

  @Post(':id/bill')
  @RequirePermissions('order:update')
  @ApiOperation({
    summary: 'Generate the bill',
    description: 'Assigns a gapless invoice number and freezes the totals. Idempotent.',
  })
  bill(@Param('id') id: string) {
    return this.orders.bill(id);
  }

  @Post(':id/void')
  @RequirePermissions('order:void')
  @ApiOperation({ summary: 'Void an order — records the reason, never deletes' })
  voidOrder(@Param('id') id: string, @Body() dto: VoidOrderDto) {
    return this.orders.void(id, dto.reason);
  }

  @Get(':id/receipt')
  @RequirePermissions('order:read')
  @ApiOperation({ summary: 'The rendered receipt document for this order' })
  receipt(@Param('id') id: string) {
    return this.receipts.build(id);
  }

  @Post(':id/receipt/print')
  @RequirePermissions('order:read')
  print(@Param('id') id: string, @Body() body: { printerId?: string }) {
    return this.receipts.print(id, body?.printerId);
  }
}
