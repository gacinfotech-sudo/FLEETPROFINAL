/**
 * REALTIME UPDATES SERVICE
 * Emits socket.io events for booking/driver/staff updates
 */

import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIOInstance(socketIo: SocketIOServer) {
  io = socketIo;
  console.log('✅ Socket.IO instance registered for real-time updates');
}

export function getSocketIOInstance(): SocketIOServer | null {
  return io;
}

/**
 * Emit booking update to all connected clients
 */
export function emitBookingUpdate(tenantId: string, bookingId: string, data: any) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('booking:updated', {
    bookingId,
    tenantId,
    data,
    timestamp: new Date()
  });

  console.log(`📡 Emitted booking update for ${bookingId} to tenant ${tenantId}`);
}

/**
 * Emit driver update to all connected clients
 */
export function emitDriverUpdate(tenantId: string, driverId: string, data: any) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('driver:updated', {
    driverId,
    tenantId,
    data,
    timestamp: new Date()
  });

  console.log(`📡 Emitted driver update for ${driverId} to tenant ${tenantId}`);
}

/**
 * Emit staff update to all connected clients
 */
export function emitStaffUpdate(tenantId: string, staffId: string, data: any) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('staff:updated', {
    staffId,
    tenantId,
    data,
    timestamp: new Date()
  });

  console.log(`📡 Emitted staff update for ${staffId} to tenant ${tenantId}`);
}

/**
 * Emit booking status change
 */
export function emitBookingStatusChange(tenantId: string, bookingId: string, oldStatus: string, newStatus: string) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('booking:statusChanged', {
    bookingId,
    tenantId,
    oldStatus,
    newStatus,
    timestamp: new Date()
  });

  console.log(`📡 Emitted status change for booking ${bookingId}: ${oldStatus} → ${newStatus}`);
}

/**
 * Emit driver availability change
 */
export function emitDriverAvailabilityChange(tenantId: string, driverId: string, isAvailable: boolean) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('driver:availabilityChanged', {
    driverId,
    tenantId,
    isAvailable,
    timestamp: new Date()
  });

  console.log(`📡 Emitted availability change for driver ${driverId}: ${isAvailable ? 'available' : 'unavailable'}`);
}

export default {
  setSocketIOInstance,
  getSocketIOInstance,
  emitBookingUpdate,
  emitDriverUpdate,
  emitStaffUpdate,
  emitBookingStatusChange,
  emitDriverAvailabilityChange
};
