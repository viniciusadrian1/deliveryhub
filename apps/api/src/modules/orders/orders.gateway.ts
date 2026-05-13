import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

import { OrdersEmitter } from './orders.emitter.js';

/**
 * Não implementa OnGatewayConnection — autenticação e join de rooms são
 * feitos pela NotificationsGateway no mesmo Socket.IO Server (compartilhado).
 * Esta classe apenas se inscreve no OrdersEmitter e despacha para a room
 * `org:{id}` (e futura `store:{id}` quando multi-loja chegar na fase 2).
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class OrdersGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersGateway.name);

  @WebSocketServer()
  private server!: Server;

  private unsubscribe?: () => void;

  constructor(private readonly emitter: OrdersEmitter) {}

  onModuleInit(): void {
    this.unsubscribe = this.emitter.subscribe((payload) => {
      this.server.to(`org:${payload.organizationId}`).emit(payload.event, payload);
    });
    this.logger.log('OrdersGateway subscribed to OrdersEmitter');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
