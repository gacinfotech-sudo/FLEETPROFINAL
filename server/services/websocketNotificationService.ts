import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { notificationEngine } from "./smartNotificationEngine";

interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "heartbeat";
  userId?: string;
  tenantId?: string;
}

class WebSocketNotificationService {
  private wss: WebSocketServer | null = null;
  private clientSessions: Map<string, Set<WebSocket>> = new Map(); // userId -> Set of WebSockets
  private heartbeatInterval: NodeJS.Timer | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      let userId: string | null = null;
      let tenantId: string | null = null;

      console.log("New WebSocket connection established");

      // Send welcome message
      ws.send(JSON.stringify({ type: "connection", status: "connected" }));

      ws.on("message", (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());

          switch (message.type) {
            case "subscribe":
              if (message.userId && message.tenantId) {
                userId = message.userId;
                tenantId = message.tenantId;

                // Add to sessions map
                if (!this.clientSessions.has(userId)) {
                  this.clientSessions.set(userId, new Set());
                }
                this.clientSessions.get(userId)?.add(ws);

                ws.send(
                  JSON.stringify({
                    type: "subscription",
                    status: "subscribed",
                    userId,
                  })
                );
                console.log(
                  `User ${userId} subscribed to notifications (tenant: ${tenantId})`
                );
              }
              break;

            case "heartbeat":
              ws.send(
                JSON.stringify({ type: "heartbeat", timestamp: new Date() })
              );
              break;

            default:
              console.warn("Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid message format",
            })
          );
        }
      });

      ws.on("close", () => {
        if (userId) {
          this.clientSessions.get(userId)?.delete(ws);
          if (this.clientSessions.get(userId)?.size === 0) {
            this.clientSessions.delete(userId);
          }
          console.log(`User ${userId} disconnected`);
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    // Setup notification engine listener
    notificationEngine.on("notification", (notification) => {
      this.broadcastNotification(notification.userId, notification);
    });

    // Setup heartbeat to keep connections alive
    this.setupHeartbeat();
  }

  private broadcastNotification(userId: string, notification: any) {
    const userSessions = this.clientSessions.get(userId);
    if (!userSessions) return;

    const message = JSON.stringify({
      type: "notification",
      id: notification.id,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      read: notification.read,
      channels: notification.channels,
      createdAt: notification.createdAt,
    });

    userSessions.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((client) => {
        if (client.isAlive === false) {
          client.terminate();
          return;
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // Every 30 seconds

    this.wss?.on("connection", (ws: any) => {
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });
    });
  }

  broadcastToUser(userId: string, notification: any) {
    this.broadcastNotification(userId, notification);
  }

  broadcastToTenant(tenantId: string, notification: any) {
    // Broadcast to all users from this tenant
    this.clientSessions.forEach((sessions, userId) => {
      // In a real app, you'd check user's tenant ID
      sessions.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(notification));
        }
      });
    });
  }

  getConnectionStats() {
    let totalConnections = 0;
    let totalUsers = 0;

    this.clientSessions.forEach((sessions) => {
      totalConnections += sessions.size;
      totalUsers++;
    });

    return {
      connectedUsers: totalUsers,
      totalConnections,
      timestamp: new Date(),
    };
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close();
      });
      this.wss.close();
    }

    this.clientSessions.clear();
  }
}

// Export singleton
export const websocketNotificationService = new WebSocketNotificationService();

// Helper function to send notification to user
export async function sendNotificationToUser(userId: string, notification: any) {
  websocketNotificationService.broadcastToUser(userId, notification);
}

// Helper function to send notification to all users of a tenant
export async function sendNotificationToTenant(
  tenantId: string,
  notification: any
) {
  websocketNotificationService.broadcastToTenant(tenantId, notification);
}
