import { Body, Controller, Get, Post, Query, Headers } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncService, type SyncOperation } from './sync.service';
import { RequirePermissions } from '../auth/guards';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @RequirePermissions('order:create')
  @ApiOperation({
    summary: 'Flush a device’s offline queue',
    description:
      'Operations apply in order and are individually reported as applied / duplicate / conflict / dead / retry. ' +
      'The batch is deliberately not atomic — one poisoned operation must not block the ones behind it.',
  })
  push(
    @Headers('x-device-id') deviceId: string,
    @Body() body: { operations: SyncOperation[] },
  ) {
    return this.sync.push(deviceId ?? 'unknown', body.operations ?? []);
  }

  @Get('pull')
  @RequirePermissions('order:read')
  @ApiOperation({
    summary: 'Everything that changed since the device’s cursor',
    description: 'The cursor is a server timestamp — device clocks drift and would skip records.',
  })
  pull(@Query('outletId') outletId: string, @Query('since') since?: string) {
    return this.sync.pull(outletId, since);
  }
}
