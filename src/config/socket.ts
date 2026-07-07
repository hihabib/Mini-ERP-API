import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './env.js';

let io: SocketIOServer;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Centralised emit helpers — call sites never reference getIO() directly,
// so swapping the underlying broadcast (e.g. adding rooms) only touches here.
function emit(event: string, payload: unknown): void {
  try {
    getIO().emit(event, payload);
  } catch {
    // Not fatal: socket may be uninitialized in test environments.
  }
}

export interface StockUpdatePayload {
  productId: string;
  newStock: number;
}

export interface SaleCreatedPayload {
  saleId: string;
  grandTotal: number;
  itemCount: number;
  createdAt: Date;
}

export function emitStockUpdated(updates: StockUpdatePayload[]): void {
  emit('stock:updated', { updates });
}

export function emitSaleCreated(summary: SaleCreatedPayload): void {
  emit('sale:created', summary);
}
