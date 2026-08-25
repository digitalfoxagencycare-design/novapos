import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KotService } from './kot.service';
import { RequirePermissions } from '../auth/guards';

class UpdateStatusDto {
  @IsEnum(['PREPARING', 'READY', 'SERVED', 'CANCELLED'])
  status!: 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
}

@ApiTags('kot')
@Controller('kot')
export class KotController {
  constructor(private readonly kot: KotService) {}

  @Get()
  @RequirePermissions('kot:read')
  @ApiOperation({
    summary: 'Live tickets for a station',
    description: 'The KDS uses the WebSocket channel for live updates; this is the fallback and the cold-start fetch.',
  })
  active(@Query('stationId') stationId: string) {
    return this.kot.activeForStation(stationId);
  }

  @Post(':id/status')
  @RequirePermissions('kot:update')
  @ApiOperation({ summary: 'Advance a ticket: placed → preparing → ready → served' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.kot.updateStatus(id, dto.status);
  }

  @Post(':id/reprint')
  @RequirePermissions('kot:reprint')
  reprint(@Param('id') id: string) {
    return this.kot.reprint(id);
  }
}
