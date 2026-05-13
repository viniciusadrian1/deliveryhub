import { Injectable } from '@nestjs/common';

export interface NotificationPayload {
  id: string;
  organizationId: string | null;
  userId: string;
  kind: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: Date;
}

/**
 * Pub/sub interno desacoplado entre o `NotificationsService` (que persiste)
 * e o `NotificationsGateway` (que faz emit em Socket.IO).
 *
 * O service publica via `emit()`, o gateway se inscreve em `subscribe()`
 * no `onModuleInit`. Evita ciclo de DI (service → gateway → service).
 */
@Injectable()
export class NotificationsEmitter {
  private readonly listeners: Array<(payload: NotificationPayload) => void> = [];

  emit(payload: NotificationPayload): void {
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch {
        // ignora — emit não deve quebrar fluxo principal
      }
    }
  }

  subscribe(fn: (payload: NotificationPayload) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
}
