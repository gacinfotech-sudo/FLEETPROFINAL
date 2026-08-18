import { getRealtimeServer } from "./websocket-server";

export interface RealtimeEventData {
  type: string;
  tenantId: string;
  data: any;
  sourceUserId?: string;
}

export class RealtimeEventEmitter {
  static emitDriverAssigned(tenantId: string, data: {
    driverId: string;
    driverName: string;
    bookingId: string;
    customerName: string;
    pickupLocation: string;
    dropoffLocation: string;
    estimatedFare: number;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "DRIVER_ASSIGNED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitDriverAccepted(tenantId: string, data: {
    driverId: string;
    driverName: string;
    bookingId: string;
    acceptedAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "DRIVER_ACCEPTED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitDriverRejected(tenantId: string, data: {
    driverId: string;
    bookingId: string;
    reason: string;
    rejectedAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "DRIVER_REJECTED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitTripStarted(tenantId: string, data: {
    driverId: string;
    bookingId: string;
    startLocation: string;
    startTime: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "TRIP_STARTED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitTripCompleted(tenantId: string, data: {
    driverId: string;
    bookingId: string;
    endLocation: string;
    endTime: string;
    distance: number;
    duration: number;
    finalFare: number;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "TRIP_COMPLETED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitPaymentReceived(tenantId: string, data: {
    bookingId: string;
    driverId: string;
    customerId: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "PAYMENT_RECEIVED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitBookingStatusChanged(tenantId: string, data: {
    bookingId: string;
    oldStatus: string;
    newStatus: string;
    changedAt: string;
    reason?: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "BOOKING_STATUS_CHANGED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitCustomerLocationUpdated(tenantId: string, data: {
    customerId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    updatedAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "CUSTOMER_LOCATION_UPDATED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitDriverLocationUpdated(tenantId: string, data: {
    driverId: string;
    latitude: number;
    longitude: number;
    bearing: number;
    speed: number;
    accuracy: number;
    updatedAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "DRIVER_LOCATION_UPDATED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }

  static emitSyncConflictDetected(tenantId: string, data: {
    operationId: string;
    conflictType: string;
    serverValue: any;
    clientValue: any;
    detectedAt: string;
  }) {
    const server = getRealtimeServer();
    server.emitEvent({
      type: "SYNC_CONFLICT_DETECTED",
      tenantId,
      data,
      timestamp: Date.now(),
    });
  }
}
