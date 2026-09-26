import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './db/db.service';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards';
import { TenantContextInterceptor } from './auth/tenant-context.interceptor';

import { AuditService } from './common/audit.service';
import { IdempotencyService } from './common/idempotency.service';

import { MenuService } from './menu/menu.service';
import { MenuController } from './menu/menu.controller';

import { TaxConfigService } from './tax/tax-config.service';

import { PricingService } from './orders/pricing.service';
import { InvoiceNumberService } from './orders/invoice-number.service';
import { OrdersService } from './orders/orders.service';
import { OrdersController } from './orders/orders.controller';

import { KotService } from './kot/kot.service';
import { KotGateway } from './kot/kot.gateway';
import { KotController } from './kot/kot.controller';

import { PrintingService } from './printing/printing.service';
import { ReceiptService } from './printing/receipt.service';
import { PrintingController } from './printing/printing.controller';

import { GatewayRegistry } from './payments/gateways/registry';
import { PaymentsService } from './payments/payments.service';
import { PaymentsController } from './payments/payments.controller';
import { SubscriptionService } from './payments/subscription.service';
import { SubscriptionController } from './payments/subscription.controller';

import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';

import { SyncService } from './sync/sync.service';
import { SyncController } from './sync/sync.controller';

import { HealthController } from './health/health.controller';
import { OutletsController, OutletsService } from './outlets/outlets.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    // Rate limiting protects the login route from credential stuffing and the
    // sync route from a device stuck in a flush loop.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 60_000, limit: 600 },
    ]),
  ],
  controllers: [
    HealthController,
    OutletsController,
    MenuController,
    OrdersController,
    KotController,
    PaymentsController,
    SubscriptionController,
    PrintingController,
    ReportsController,
    SyncController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    AuditService,
    IdempotencyService,
    MenuService,
    OutletsService,
    TaxConfigService,
    PricingService,
    InvoiceNumberService,
    OrdersService,
    KotService,
    KotGateway,
    PrintingService,
    ReceiptService,
    GatewayRegistry,
    PaymentsService,
    SubscriptionService,
    ReportsService,
    SyncService,
  ],
})
export class AppModule {}
