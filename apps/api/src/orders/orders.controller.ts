import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  Min, ValidateNested, IsUUID,
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
  @IsOptional() @IsString() itemId?: string;
  @IsString() name!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() uom?: string;
  @IsOptional() @IsString() taxSlabId?: string;
  @IsOptional() @IsString() hsnSac?: string;
  @IsOptional() @IsNumber() netMinor?: number;
}

export class PosSaleDto {
  @IsString() clientOrderId!: string;
  @IsOptional() @IsString() orderNumber?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsNumber() @Min(0) amount!: number;
  @IsEnum(['cash', 'upi', 'card', 'credit']) paymentMode!: 'cash' | 'upi' | 'card' | 'credit';
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() taxSnapshot?: any;
  @IsOptional() receiptSnapshot?: any;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PosSaleLineDto) lines?: PosSaleLineDto[];
  @IsOptional() @IsString() placedAt?: string;
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly receipts: ReceiptService,
  ) {}

  @Post('pos-sale')
  @RequirePermissions('order:create')
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
