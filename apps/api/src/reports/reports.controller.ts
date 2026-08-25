import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../auth/guards';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('today')
  @RequirePermissions('report:read')
  today(@Query('outletId') outletId: string) {
    return this.reports.today(outletId);
  }

  @Get('sales')
  @RequirePermissions('report:read')
  sales(@Query('outletId') outletId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.salesSummary({ outletId, from: new Date(from), to: new Date(to) });
  }

  @Get('tax')
  @RequirePermissions('report:read')
  @ApiOperation({ summary: 'Tax collected per component — the GST/VAT filing figures' })
  tax(@Query('outletId') outletId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.taxSummary({ outletId, from: new Date(from), to: new Date(to) });
  }

  @Get('items')
  @RequirePermissions('report:read')
  items(@Query('outletId') outletId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.topItems({ outletId, from: new Date(from), to: new Date(to) });
  }

  @Get('payments')
  @RequirePermissions('report:read')
  payments(@Query('outletId') outletId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.reports.paymentMix({ outletId, from: new Date(from), to: new Date(to) });
  }

  @Get('shifts/:id')
  @RequirePermissions('report:read')
  shift(@Param('id') id: string) {
    return this.reports.shiftReport(id);
  }
}
