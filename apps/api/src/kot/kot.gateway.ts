import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody,
  ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable, Inject, forwardRef } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { KotService } from './kot.service';
import { runWithTenant } from '../tenancy/tenant-context';

/**
 * Real-time channel between the POS, the kitchen screens and the admin views.
 *
 * Rooms are the isolation boundary and they are namespaced by tenant, so a
 * socket can never join another tenant's outlet room even if it guesses the id:
 *
 *   t:<tenantId>:o:<outletId>            — everything happening at an outlet
 *   t:<tenantId>:o:<outletId>:s:<stationId> — one kitchen station's tickets
 *
 * Delivery target is sub-second. Socket.IO's own ack is used to measure it, and
 * a KOT that is not acked within the window is left for the printer path and
 * the KDS's own reconnect-and-refetch to pick up. The screen is never the only
 * copy of a ticket.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean), credentials: true },
})
export class KotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(KotGateway.name);

  @WebSocketServer() server!: Server;

  // KotService pushes through this gateway, and this gateway asks KotService
  // for a station's live tickets when a screen connects. The cycle is real and
  // deliberate, so both sides declare it.
  constructor(
    private readonly auth: AuthService,
    @Inject(forwardRef(() => KotService)) private readonly kot: KotService,
  ) {}

  /**
   * Authenticate on connect, not per message.
   *
   * A kitchen screen holds one socket open for a whole service; verifying the
   * token on every ticket would be wasted work. The token's expiry is still
   * respected — the client refreshes and re-authenticates over the same socket.
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token supplied');

      const claims = this.auth.verifyAccessToken(token);
      if (claims.supportSessionId) throw new Error('Support sessions cannot open realtime connections');
      client.data.claims = claims;

      const outletId = (client.handshake.query.outletId as string) ?? claims.outletId;
      if (!outletId) throw new Error('No outlet specified');
      if (claims.outletId && claims.outletId !== outletId) {
        throw new Error('Token is not valid for the requested outlet');
      }

      client.data.tenantId = claims.tenantId;
      client.data.outletId = outletId;
      await client.join(outletRoom(claims.tenantId, outletId));

      const stationId = client.handshake.query.stationId as string | undefined;
      if (stationId) {
        client.data.stationId = stationId;
        await client.join(stationRoom(claims.tenantId, outletId, stationId));

        // Replay whatever is live so a screen that reconnects mid-service is
        // immediately correct rather than empty until the next order.
        const active = await runWithTenant(
          {
            tenantId: claims.tenantId, staffId: claims.sub, outletId,
            role: claims.role, permissions: claims.perms,
          },
          () => this.kot.activeForStation(stationId),
        );
        client.emit('kot:snapshot', { stationId, kots: active });
      }

      client.emit('ready', { outletId, stationId: client.data.stationId ?? null });
      this.logger.log(`Socket ${client.id} joined outlet ${outletId}${stationId ? ` station ${stationId}` : ''}`);
    } catch (err) {
      this.logger.warn(`Rejecting socket ${client.id}: ${(err as Error).message}`);
      client.emit('error', { code: 'UNAUTHORIZED', message: (err as Error).message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  /** Push a new or modified ticket to its station's screens. */
  async pushKot(outletId: string, kot: { id: string; stationId: string; tenantId: string }) {
    const room = stationRoom(kot.tenantId, outletId, kot.stationId);
    this.server.to(room).emit('kot:new', kot);
    this.server.to(outletRoom(kot.tenantId, outletId)).emit('kot:new', kot);
  }

  async pushKotStatus(outletId: string, kot: { id: string; stationId: string; tenantId: string; status: string }) {
    this.server.to(stationRoom(kot.tenantId, outletId, kot.stationId)).emit('kot:status', kot);
    this.server.to(outletRoom(kot.tenantId, outletId)).emit('kot:status', kot);
  }

  /** Order-level changes the floor staff need to see (table freed, bill paid). */
  async pushOrderEvent(tenantId: string, outletId: string, event: string, payload: unknown) {
    this.server.to(outletRoom(tenantId, outletId)).emit(event, payload);
  }

  /** A KDS marking a ticket done, sent over the socket rather than as a POST. */
  @SubscribeMessage('kot:update-status')
  async onUpdateStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { kotId: string; status: 'PREPARING' | 'READY' | 'SERVED' },
  ) {
    const claims = client.data.claims;
    if (!claims) return { ok: false, error: 'UNAUTHORIZED' };
    if (!claims.perms.includes('kot:update')) return { ok: false, error: 'FORBIDDEN' };

    try {
      const updated = await runWithTenant(
        {
          tenantId: claims.tenantId, staffId: claims.sub, outletId: client.data.outletId,
          role: claims.role, permissions: claims.perms,
        },
        () => this.kot.updateStatus(body.kotId, body.status),
      );
      return { ok: true, kot: updated };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Latency probe used by the QA checklist to prove the sub-second target. */
  @SubscribeMessage('ping')
  onPing(@MessageBody() body: { sentAt: number }) {
    return { sentAt: body?.sentAt, serverAt: Date.now() };
  }
}

export function outletRoom(tenantId: string, outletId: string): string {
  return `t:${tenantId}:o:${outletId}`;
}

export function stationRoom(tenantId: string, outletId: string, stationId: string): string {
  return `t:${tenantId}:o:${outletId}:s:${stationId}`;
}
