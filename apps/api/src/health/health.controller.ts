import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../db/db.service';
import { Public } from '../auth/guards';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness — is the process up' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000) };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness — can the process serve traffic' })
  async ready() {
    const checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }> = {};
    try {
      checks.database = { ok: true, latencyMs: await this.db.ping() };
    } catch (err) {
      checks.database = { ok: false, detail: (err as Error).message };
    }
    const ok = Object.values(checks).every((c) => c.ok);
    return { status: ok ? 'ok' : 'degraded', checks };
  }
}
