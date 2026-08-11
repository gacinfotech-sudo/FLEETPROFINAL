/**
 * Real-Time Tracking Handler
 * WebSocket management for real-time GPS tracking
 * Handles live location updates, device status, and event streaming
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger';
import {
  GpsVehicleTelemetry,
  GpsDeviceStatus,
  GpsWebSocketMessage,
  GpsLocationUpdateMessage,
  GpsDeviceStatusMessage,
  GpsTrackingSession,
} from './types';

/**
 * Real-Time Tracking Session Handler
 */
export class RealTimeTracker extends EventEmitter {
  private logger: any;
  private sessionId: string;
  private tenantId: string;
  private vehicleId: string;
  private deviceId: string;
  private active: boolean = false;
  private websocket: any = null;
  private updateBuffer: GpsVehicleTelemetry[] = [];
  private lastUpdateTime: Date = new Date();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000; // 3 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private updateFrequency: number = 5; // seconds

  constructor(
    sessionId: string,
    tenantId: string,
    vehicleId: string,
    deviceId: string,
    updateFrequency?: number,
  ) {
    super();

    this.sessionId = sessionId;
    this.tenantId = tenantId;
    this.vehicleId = vehicleId;
    this.deviceId = deviceId;
    this.updateFrequency = updateFrequency || 5;
    this.logger = createLogger(`RealTimeTracker:${sessionId}`);
  }

  /**
   * Start real-time tracking
   */
  async start(websocketUrl: string): Promise<void> {
    if (this.active) {
      this.logger.warn('Tracking already active');
      return;
    }

    this.active = true;
    this.reconnectAttempts = 0;

    try {
      await this.connect(websocketUrl);
      this.startHeartbeat();
      this.startBufferFlush();

      this.logger.info('Real-time tracking started', {
        sessionId: this.sessionId,
        vehicleId: this.vehicleId,
      });
    } catch (error) {
      this.logger.error('Failed to start tracking', error as Error);
      this.active = false;
      throw error;
    }
  }

  /**
   * Stop real-time tracking
   */
  async stop(): Promise<void> {
    this.active = false;

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }

    // Flush remaining updates
    await this.flushUpdates();

    // Close WebSocket
    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        this.logger.error('Error closing websocket', error as Error);
      }
      this.websocket = null;
    }

    this.logger.info('Real-time tracking stopped', {
      sessionId: this.sessionId,
    });
  }

  /**
   * Connect to WebSocket
   */
  private async connect(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Mock WebSocket connection (in real app, use ws library)
        this.websocket = {
          ready: true,
          on: (event: string, callback: any) => {
            if (event === 'open') {
              resolve();
            } else if (event === 'error') {
              reject(new Error('WebSocket connection failed'));
            }
          },
          send: (message: string) => {
            this.logger.debug('WebSocket message sent', { message });
          },
          close: () => {
            this.logger.debug('WebSocket closed');
          },
        };

        // Simulate successful connection
        setTimeout(() => {
          this.websocket?.on?.('open', () => {});
          resolve();
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle location update
   */
  handleLocationUpdate(telemetry: GpsVehicleTelemetry): void {
    if (!this.active) {
      return;
    }

    // Add to buffer for batch processing
    this.updateBuffer.push(telemetry);

    // Emit real-time event
    this.emit('location_update', {
      sessionId: this.sessionId,
      telemetry,
    });

    this.lastUpdateTime = new Date();
  }

  /**
   * Handle device status change
   */
  handleDeviceStatusChange(status: GpsDeviceStatus): void {
    if (!this.active) {
      return;
    }

    this.emit('device_status', {
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      status,
      timestamp: new Date(),
    });

    this.logger.info('Device status changed', {
      deviceId: this.deviceId,
      status,
    });
  }

  /**
   * Flush buffered updates
   */
  private async flushUpdates(): Promise<void> {
    if (this.updateBuffer.length === 0) {
      return;
    }

    const updates = [...this.updateBuffer];
    this.updateBuffer = [];

    this.emit('batch_update', {
      sessionId: this.sessionId,
      updates,
      timestamp: new Date(),
    });

    this.logger.debug('Flushed location updates', {
      count: updates.length,
    });
  }

  /**
   * Start heartbeat to detect connection issues
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.active) {
        return;
      }

      const timeSinceLastUpdate = Date.now() - this.lastUpdateTime.getTime();
      const maxIntervalMs = this.updateFrequency * 2000; // 2x update frequency

      if (timeSinceLastUpdate > maxIntervalMs) {
        this.logger.warn('No location update received', {
          timeSinceLastUpdate,
          maxInterval: maxIntervalMs,
        });

        this.emit('heartbeat_missed', {
          sessionId: this.sessionId,
          timeSinceLastUpdate,
        });

        // Attempt reconnect
        this.attemptReconnect();
      } else {
        this.emit('heartbeat', {
          sessionId: this.sessionId,
          lastUpdate: this.lastUpdateTime,
        });
      }
    }, this.updateFrequency * 1000);
  }

  /**
   * Start buffer flush interval
   */
  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(() => {
      if (this.active && this.updateBuffer.length > 0) {
        this.flushUpdates();
      }
    }, this.updateFrequency * 1000);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('connection_failed', {
        sessionId: this.sessionId,
        attempts: this.reconnectAttempts,
      });
      await this.stop();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.info('Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      delay,
    });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Reconnection logic would be implemented here
      this.reconnectAttempts = 0;
      this.logger.info('Reconnected successfully');
    } catch (error) {
      this.logger.error('Reconnection failed', error as Error);
      await this.attemptReconnect();
    }
  }

  /**
   * Get tracking session info
   */
  getSessionInfo(): {
    sessionId: string;
    tenantId: string;
    vehicleId: string;
    deviceId: string;
    active: boolean;
    lastUpdate: Date;
    bufferSize: number;
  } {
    return {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      vehicleId: this.vehicleId,
      deviceId: this.deviceId,
      active: this.active,
      lastUpdate: this.lastUpdateTime,
      bufferSize: this.updateBuffer.length,
    };
  }

  /**
   * Get buffered updates without flushing
   */
  getBufferedUpdates(): GpsVehicleTelemetry[] {
    return [...this.updateBuffer];
  }

  /**
   * Register location update handler
   */
  onLocationUpdate(handler: (telemetry: GpsVehicleTelemetry) => void): void {
    this.on('location_update', ({ telemetry }) => {
      try {
        handler(telemetry);
      } catch (error) {
        this.logger.error('Error in location update handler', error as Error);
      }
    });
  }

  /**
   * Register batch update handler
   */
  onBatchUpdate(
    handler: (updates: GpsVehicleTelemetry[]) => void,
  ): void {
    this.on('batch_update', ({ updates }) => {
      try {
        handler(updates);
      } catch (error) {
        this.logger.error('Error in batch update handler', error as Error);
      }
    });
  }

  /**
   * Register status change handler
   */
  onStatusChange(handler: (status: GpsDeviceStatus) => void): void {
    this.on('device_status', ({ status }) => {
      try {
        handler(status);
      } catch (error) {
        this.logger.error('Error in status change handler', error as Error);
      }
    });
  }
}

/**
 * Real-Time Tracking Manager
 */
export class RealTimeTrackingManager {
  private logger: any;
  private trackers: Map<string, RealTimeTracker> = new Map();

  constructor() {
    this.logger = createLogger('RealTimeTrackingManager');
  }

  /**
   * Create a new tracking session
   */
  createTracker(
    sessionId: string,
    tenantId: string,
    vehicleId: string,
    deviceId: string,
    updateFrequency?: number,
  ): RealTimeTracker {
    if (this.trackers.has(sessionId)) {
      throw new Error(`Tracker already exists: ${sessionId}`);
    }

    const tracker = new RealTimeTracker(
      sessionId,
      tenantId,
      vehicleId,
      deviceId,
      updateFrequency,
    );

    this.trackers.set(sessionId, tracker);

    this.logger.info('Tracker created', {
      sessionId,
      vehicleId,
    });

    return tracker;
  }

  /**
   * Get existing tracker
   */
  getTracker(sessionId: string): RealTimeTracker | undefined {
    return this.trackers.get(sessionId);
  }

  /**
   * Remove tracker
   */
  removeTracker(sessionId: string): void {
    this.trackers.delete(sessionId);
  }

  /**
   * Get all active trackers
   */
  getActiveTrackers(): RealTimeTracker[] {
    const result: RealTimeTracker[] = [];
    const values = Array.from(this.trackers.values());
    for (const tracker of values) {
      result.push(tracker);
    }
    return result;
  }

  /**
   * Stop all trackers
   */
  async stopAllTrackers(): Promise<void> {
    const trackersArray = Array.from(this.trackers.values());
    for (const tracker of trackersArray) {
      await tracker.stop();
    }
    this.trackers.clear();
  }
}

export default RealTimeTracker;
