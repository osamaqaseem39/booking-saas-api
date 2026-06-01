import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { REALTIME_NAMESPACE } from './realtime.events';
import { RealtimeService } from './realtime.service';

type HandshakeAuth = {
  token?: string;
  tenantId?: string;
};

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  transports: ['websocket', 'polling'],
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(): void {
    this.realtime.attachServer(this.server);
    this.logger.log(`WebSocket gateway ready (${REALTIME_NAMESPACE})`);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = (client.handshake.auth ?? {}) as HandshakeAuth;
      const token = auth.token?.trim();
      const tenantId = auth.tenantId?.trim();
      if (!token || !tenantId) {
        throw new UnauthorizedException('token and tenantId required');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        userId?: string;
        typ?: string;
      }>(token);
      if (payload.typ === 'refresh') {
        throw new UnauthorizedException('Use access token for realtime');
      }
      const userId = payload.sub ?? payload.userId;
      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      await client.join(this.realtime.tenantRoom(tenantId));
      client.data.userId = userId;
      client.data.tenantId = tenantId;
    } catch (err) {
      const message =
        err instanceof UnauthorizedException
          ? err.message
          : 'Realtime authentication failed';
      this.logger.debug(`disconnect client ${client.id}: ${message}`);
      client.emit('error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`client disconnected ${client.id}`);
  }
}
