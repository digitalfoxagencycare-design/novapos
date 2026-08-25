import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrintingService } from './printing.service';
import { RequirePermissions } from '../auth/guards';
import { BUILT_IN_PROFILES, detectProfile } from '@novapos/escpos';

@ApiTags('printing')
@Controller('printing')
export class PrintingController {
  constructor(private readonly printing: PrintingService) {}

  @Get('profiles')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Known thermal printer profiles (58mm and 80mm)' })
  profiles() {
    return BUILT_IN_PROFILES;
  }

  @Post('detect')
  @RequirePermissions('settings:read')
  @ApiOperation({
    summary: 'Best-effort paper-width detection',
    description:
      'Returns the matched profile and how confident the match is. A "guess" result means the app should ' +
      'ask the operator to confirm the paper width rather than printing a misformatted receipt.',
  })
  detect(@Body() hints: {
    explicitProfileId?: string; modelName?: string;
    reportedPaperWidth?: number; reportedDotsPerLine?: number;
  }) {
    return detectProfile(hints);
  }

  @Get('queue')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Print queue health — what is stuck and why' })
  queue(@Query('outletId') outletId: string) {
    return this.printing.queueStatus(outletId);
  }

  @Post('claim')
  @RequirePermissions('kot:read')
  @ApiOperation({
    summary: 'Claim jobs for device-attached printers',
    description:
      'Bluetooth and USB printers hang off a phone or till, not the server. Those devices poll here and get ' +
      'pre-rendered ESC/POS bytes to write over their own link.',
  })
  claim(@Body() body: { printerIds: string[]; limit?: number }) {
    return this.printing.claimForDevice(body.printerIds, body.limit);
  }

  @Post('jobs/:id/result')
  @RequirePermissions('kot:read')
  report(@Param('id') id: string, @Body() body: { ok: boolean; error?: string }) {
    return this.printing.reportDeviceResult(id, body.ok, body.error);
  }

  @Post('jobs/:id/retry')
  @RequirePermissions('settings:write')
  retry(@Param('id') id: string) {
    return this.printing.retry(id);
  }
}
