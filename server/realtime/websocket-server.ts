import { Server as HTTPServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";

interface RealtimeClient {
  userId: string;
  tenantId: string;
  ws: WebSocket;
  subscriptions: Set<string>; // Event types subscribed to
  connectedAt: Date;
}

interface RealtimeEvent {
  type: string;
  tenantId: string;
  data: any;
  timestamp: number;
  sourceUserId?: string;
}

export class RealtimeServer {
  private wss: WebSocketServer;
  private clients: Map<string, RealtimeClient> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();

  // Event types that trigger realtime updates
  private readonly REALTIME_EVENTS = {
    DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
    DRIVER_ACCEPTED: "DRIVER_ACCEPTED",
    DRIVER_REJECTED: "DRIVER_REJECTED",
    TRIP_STARTED: "TRIP_STARTED",
    TRIP_COMPLETED: "TRIP_COMPLETED",
    PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
    BOOKING_STATUS_CHANGED: "BOOKING_STATUS_CHANGED",
    CUSTOMER_LOCATION_UPDATED: "CUSTOMER_LOCATION_UPDATED",
    DRIVER_LOCATION_UPDATED: "DRIVER_LOCATION_UPDATED",
    SYNC_CONFLICT_DETECTED: "SYNC_CONFLICT_DETECTED",
  };

  constructor(httpServer: HTTPServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.setupConnectionHandling();
    this.setupEventListeners();
  }

  private setupConnectionHandling() {
    this.wss.on("connection", (ws: WebSocket, req) => {
      const url = new URL(req.url || "", "http://localhost");
      const token = url.searchParams.get("token");
      const tenantId = url.searchParams.get("tenantId");

      if (!token || !tenantId) {
        ws.close(1008, "Missing authentication");
        return;
      }

      // Verify token (simplified - implement proper JWT verification)
      const userId = this.verifyToken(token);
      if (!userId) {
        ws.close(1008, "Invalid token");
        return;
      }

      const clientId = `${userId}:${tenantId}`;
      const client: RealtimeClient = {
        userId,
        tenantId,
        ws,
        subscriptions: new Set(),
        connectedAt: new Date(),
      };

      this.clients.set(clientId, client);
      console.log(`[WS] Client connected: ${clientId}`);

      // Send welcome message
      this.sendMessage(ws, {
        type: "CONNECTED",
        clientId,
        timestamp: Date.now(),
      });

      // Handle incoming messages
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error("Failed to parse WS message:", error);
          this.sendMessage(ws, { type: "ERROR", error: "Invalid message format" });
        }
      });

      // Handle disconnection
      ws.on("close", () => {
        this.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId}`);
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error(`[WS] Client error (${clientId}):`, error);
      });
    });
  }

  private setupEventListeners() {
    // Listen for realtime events and broadcast to subscribers
    Object.values(this.REALTIME_EVENTS).forEach((eventType) => {
      this.eventEmitter.on(eventType, (event: RealtimeEvent) => {
        this.broadcastEvent(event);
      });
    });
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, data } = message;

    switch (type) {
      case "SUBSCRIBE":
        // Subscribe to specific event types
        if (Array.isArray(data.events)) {
          data.events.forEach((event: string) => {
            client.subscriptions.add(event);
          });
          console.log(`[WS] ${clientId} subscribed to: ${Array.from(client.subscriptions).join(", ")}`);
        }
        break;

      case "UNSUBSCRIBE":
        if (Array.isArray(data.events)) {
          data.events.forEach((event: string) => {
            client.subscriptions.delete(event);
          });
        }
        break;

      case "PING":
        // Keep-alive ping
        this.sendMessage(client.ws, { type: "PONG", timestamp: Date.now() });
        break;

      default:
        console.warn(`[WS] Unknown message type: ${type}`);
    }
  }

  private broadcastEvent(event: RealtimeEvent) {
    const { type, tenantId, data } = event;

    // Send to all clients subscribed to this event in this tenant
    this.clients.forEach((client, clientId) => {
      if (client.tenantId === tenantId && client.subscriptions.has(type)) {
        this.sendMessage(client.ws, {
          type,
          data,
          timestamp: event.timestamp,
        });
      }
    });

    console.log(`[WS] Broadcast ${type} to ${tenantId}`);
  }

  public emitEvent(event: RealtimeEvent) {
    // Emit from backend to trigger broadcast
    this.eventEmitter.emit(event.type, event);
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private verifyToken(token: string): string | null {
    // TODO: Implement proper JWT verification
    // For now, return a mock userId
    return token ? `user_${Date.now()}` : null;
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getClientsForTenant(tenantId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.tenantId === tenantId) count++;
    });
    return count;
  }
}

// Export singleton instance
let realtimeServer: RealtimeServer | null = null;

export function initializeRealtimeServer(httpServer: HTTPServer): RealtimeServer {
  if (!realtimeServer) {
    realtimeServer = new RealtimeServer(httpServer);
  }
  return realtimeServer;
}

export function getRealtimeServer(): RealtimeServer {
  if (!realtimeServer) {
    throw new Error("Realtime server not initialized");
  }
  return realtimeServer;
}
