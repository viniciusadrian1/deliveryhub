import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { TokensService } from '../auth/tokens.service.js';
import { NotificationsEmitter } from './notifications.emitter.js';

interface AuthedSocketData {
  userId: string;
  orgId: string;
  role: string;
}

@Injectable()
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  private unsubscribe?: () => void;

  constructor(
    private readonly tokens: TokensService,
    private readonly emitter: NotificationsEmitter,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.emitter.subscribe((payload) => {
      // Notificações são sempre destinadas a um userId específico; entregamos
      // apenas na sala dele (todas as sessões/dispositivos entram nela).
      // Não emitimos pra sala da org: isso vazaria conteúdo pessoal/financeiro
      // pra outros membros conectados (todos entram em org:${orgId} no connect).
      this.server.to(`user:${payload.userId}`).emit('notification.created', payload);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  afterInit(): void {
    this.logger.log('Socket.IO gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.tokens.verifyAccessToken(token);
      const data: AuthedSocketData = {
        userId: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
      };
      client.data = data;
      await client.join(`user:${data.userId}`);
      await client.join(`org:${data.orgId}`);
      client.emit('hello', { userId: data.userId, orgId: data.orgId, role: data.role });
      this.logger.debug({ userId: data.userId, orgId: data.orgId }, 'socket_connected');
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'socket_auth_failed');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as Partial<AuthedSocketData>;
    if (data?.userId) {
      this.logger.debug({ userId: data.userId }, 'socket_disconnected');
    }
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const headers = client.handshake.headers;
    const authHeader = headers.authorization ?? headers.Authorization;
    if (typeof authHeader === 'string') {
      const [scheme, value] = authHeader.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && value) return value;
    }
    const query = client.handshake.query?.token;
    if (typeof query === 'string') return query;
    return null;
  }
}
