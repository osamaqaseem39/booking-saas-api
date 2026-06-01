import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  BOOKING_CHANGED_EVENT,
  type BookingChangedPayload,
  type BookingRealtimeAction,
} from './realtime.events';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
  }

  emitBookingChange(
    tenantId: string,
    bookingId: string,
    action: BookingRealtimeAction,
  ): void {
    if (!this.server) return;
    const payload: BookingChangedPayload = {
      tenantId,
      bookingId,
      action,
    };
    const room = this.tenantRoom(tenantId);
    this.server.to(room).emit(BOOKING_CHANGED_EVENT, payload);
    this.logger.debug(`emit ${BOOKING_CHANGED_EVENT} room=${room} action=${action}`);
  }
}
