'use client';

import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL } from './api';
import { readTokens } from './tokens';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (socket?.connected || socket?.active) return socket;

  const tokens = readTokens();
  if (!tokens) return null;

  socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: tokens.accessToken },
    reconnection: true,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
