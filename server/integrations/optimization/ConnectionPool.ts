/**
 * ConnectionPool
 * HTTP connection pooling per provider for improved performance
 * Manages keep-alive, health checks, reconnection, and resource optimization
 * Supports concurrent requests with configurable pool sizing
 */

import { createLogger } from '../../utils/logger';

/**
 * Connection state enum
 */
enum ConnectionState {
  IDLE = 'idle',
  ACTIVE = 'active',
  REUSING = 'reusing',
  STALE = 'stale',
  CLOSED = 'closed',
}

/**
 * Pool connection metadata
 */
interface PooledConnection {
  id: string;
  state: ConnectionState;
  createdAt: Date;
  lastUsedAt: Date;
  requestCount: number;
  errorCount: number;
  httpAgent: any; // HTTP/HTTPS agent
  maxAge: number; // milliseconds before reconnection
  ttl: number; // milliseconds before auto-cleanup
}

/**
 * Connection pool statistics
 */
export interface PoolStatistics {
  providerId: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  poolUtilization: number; // percentage
  stalledConnections: number;
}

/**
 * Pool configuration
 */
export interface PoolConfig {
  minConnections?: number; // Default: 2
  maxConnections?: number; // Default: 20
  connectionTimeout?: number; // Default: 30000ms
  keepAliveTimeout?: number; // Default: 60000ms
  maxConnectionAge?: number; // Default: 5 minutes
  maxConnectionTTL?: number; // Default: 30 minutes
  healthCheckInterval?: number; // Default: 10000ms
  staleCheckInterval?: number; // Default: 5000ms
  requestsPerConnection?: number; // Default: 100 (reconnect after)
  errorThreshold?: number; // Default: 5 errors before reconnection
}

/**
 * ConnectionPool
 * Manages a pool of HTTP/HTTPS connections per provider
 */
export class ConnectionPool {
  private logger: any;
  private providerId: string;
  private connections: Map<string, PooledConnection> = new Map();
  private config: Required<PoolConfig>;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private staleCheckInterval: NodeJS.Timeout | null = null;
  private statistics: Map<string, any> = new Map();
  private requestQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(providerId: string, config: PoolConfig = {}) {
    this.providerId = providerId;
    this.logger = createLogger(`ConnectionPool:${providerId}`);
    this.config = this.normalizeConfig(config);
    this.initializePool();
    this.startHealthChecks();
  }

  /**
   * Normalize and validate configuration
   */
  private normalizeConfig(config: PoolConfig): Required<PoolConfig> {
    return {
      minConnections: config.minConnections ?? 2,
      maxConnections: config.maxConnections ?? 20,
      connectionTimeout: config.connectionTimeout ?? 30000,
      keepAliveTimeout: config.keepAliveTimeout ?? 60000,
      maxConnectionAge: config.maxConnectionAge ?? 5 * 60 * 1000,
      maxConnectionTTL: config.maxConnectionTTL ?? 30 * 60 * 1000,
      healthCheckInterval: config.healthCheckInterval ?? 10000,
      staleCheckInterval: config.staleCheckInterval ?? 5000,
      requestsPerConnection: config.requestsPerConnection ?? 100,
      errorThreshold: config.errorThreshold ?? 5,
    };
  }

  /**
   * Initialize pool with minimum connections
   */
  private initializePool(): void {
    this.logger.info('Initializing connection pool', {
      providerId: this.providerId,
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections,
    });

    for (let i = 0; i < this.config.minConnections; i++) {
      this.createConnection();
    }
  }

  /**
   * Create a new pooled connection
   */
  private createConnection(): PooledConnection {
    const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const connection: PooledConnection = {
      id,
      state: ConnectionState.IDLE,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      requestCount: 0,
      errorCount: 0,
      httpAgent: this.createHttpAgent(),
      maxAge: this.config.maxConnectionAge,
      ttl: this.config.maxConnectionTTL,
    };

    this.connections.set(id, connection);

    this.logger.debug('Created new connection', {
      connectionId: id,
      totalConnections: this.connections.size,
    });

    return connection;
  }

  /**
   * Create HTTP/HTTPS agent with keep-alive
   */
  private createHttpAgent(): any {
    // This should use http.Agent or https.Agent depending on protocol
    // For now, we return a mock agent that would be replaced in actual implementation
    return {
      keepAlive: true,
      keepAliveMsecs: this.config.keepAliveTimeout,
      maxSockets: 1,
      maxFreeSockets: 1,
      timeout: this.config.connectionTimeout,
      freeSocketTimeout: this.config.keepAliveTimeout,
    };
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection(): Promise<PooledConnection> {
    // Try to find an idle connection
    const idleConnection = this.findIdleConnection();
    if (idleConnection) {
      return this.acquireConnection(idleConnection);
    }

    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const newConnection = this.createConnection();
      return this.acquireConnection(newConnection);
    }

    // Wait for an idle connection to become available
    return this.waitForConnection();
  }

  /**
   * Find an idle connection
   */
  private findIdleConnection(): PooledConnection | null {
    const entries = Array.from(this.connections.entries());
    for (const [, conn] of entries) {
      if (
        conn.state === ConnectionState.IDLE &&
        !this.isConnectionStale(conn) &&
        conn.errorCount < this.config.errorThreshold
      ) {
        return conn;
      }
    }
    return null;
  }

  /**
   * Acquire a connection for use
   */
  private acquireConnection(connection: PooledConnection): PooledConnection {
    connection.state = ConnectionState.ACTIVE;
    connection.lastUsedAt = new Date();

    this.logger.debug('Acquired connection', {
      connectionId: connection.id,
      state: connection.state,
      requestCount: connection.requestCount,
    });

    return connection;
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.requestQueue.indexOf({ resolve, reject });
        if (index > -1) {
          this.requestQueue.splice(index, 1);
        }
        reject(new Error('Connection pool timeout'));
      }, this.config.connectionTimeout);

      this.requestQueue.push({
        resolve: (conn: PooledConnection) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection: PooledConnection): void {
    connection.state = ConnectionState.IDLE;
    connection.requestCount++;
    connection.lastUsedAt = new Date();

    // Check if connection should be reconnected
    if (
      connection.requestCount >= this.config.requestsPerConnection ||
      this.isConnectionStale(connection)
    ) {
      this.reconnectConnection(connection);
      return;
    }

    // Process waiting requests
    this.processQueue();

    this.logger.debug('Released connection', {
      connectionId: connection.id,
      requestCount: connection.requestCount,
    });
  }

  /**
   * Mark connection error
   */
  markConnectionError(connection: PooledConnection): void {
    connection.errorCount++;

    this.logger.warn('Connection error marked', {
      connectionId: connection.id,
      errorCount: connection.errorCount,
      errorThreshold: this.config.errorThreshold,
    });

    if (connection.errorCount >= this.config.errorThreshold) {
      this.reconnectConnection(connection);
    }
  }

  /**
   * Reconnect a stale or errored connection
   */
  private reconnectConnection(connection: PooledConnection): void {
    connection.state = ConnectionState.STALE;
    connection.errorCount = 0;
    connection.requestCount = 0;
    connection.httpAgent = this.createHttpAgent();

    this.logger.info('Reconnected stale connection', {
      connectionId: connection.id,
      age: new Date().getTime() - connection.createdAt.getTime(),
    });

    // Try to reuse or recreate
    connection.state = ConnectionState.IDLE;
    this.processQueue();
  }

  /**
   * Check if connection is stale
   */
  private isConnectionStale(connection: PooledConnection): boolean {
    const age = new Date().getTime() - connection.createdAt.getTime();
    const idleTime =
      new Date().getTime() - connection.lastUsedAt.getTime();

    return (
      age > connection.maxAge ||
      idleTime > this.config.keepAliveTimeout
    );
  }

  /**
   * Process waiting requests queue
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const idleConnection = this.findIdleConnection();
      if (!idleConnection) {
        break;
      }

      const request = this.requestQueue.shift();
      if (request) {
        request.resolve(this.acquireConnection(idleConnection));
      }
    }
  }

  /**
   * Start health check interval
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.staleCheckInterval = setInterval(() => {
      this.performStaleCheck();
    }, this.config.staleCheckInterval);
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const stats = this.getStatistics();

    this.logger.debug('Health check performed', {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      totalErrors: stats.totalErrors,
      utilization: stats.poolUtilization,
    });

    // Mark unhealthy connections for reconnection
    const entries = Array.from(this.connections.entries());
    for (const [, conn] of entries) {
      if (conn.errorCount > this.config.errorThreshold / 2) {
        this.logger.warn('Unhealthy connection detected', {
          connectionId: conn.id,
          errorCount: conn.errorCount,
        });
      }
    }
  }

  /**
   * Perform stale connection check
   */
  private performStaleCheck(): void {
    const staleConnections: PooledConnection[] = [];

    const entries = Array.from(this.connections.entries());
    for (const [, conn] of entries) {
      if (this.isConnectionStale(conn) && conn.state === ConnectionState.IDLE) {
        staleConnections.push(conn);
      }
    }

    if (staleConnections.length > 0) {
      this.logger.info('Found stale connections', {
        count: staleConnections.length,
      });

      for (const conn of staleConnections) {
        this.reconnectConnection(conn);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    let stalledConnections = 0;

    const entries = Array.from(this.connections.entries());
    for (const [, conn] of entries) {
      totalConnections++;
      totalRequests += conn.requestCount;
      totalErrors += conn.errorCount;

      if (conn.state === ConnectionState.ACTIVE) {
        activeConnections++;
      } else if (conn.state === ConnectionState.IDLE) {
        idleConnections++;
      }

      if (this.isConnectionStale(conn)) {
        stalledConnections++;
      }
    }

    const poolUtilization =
      totalConnections > 0
        ? (activeConnections / totalConnections) * 100
        : 0;

    return {
      providerId: this.providerId,
      totalConnections,
      activeConnections,
      idleConnections,
      totalRequests,
      totalErrors,
      averageResponseTime: 0, // Would be calculated from metrics
      poolUtilization,
      stalledConnections,
    };
  }

  /**
   * Clear and reset pool
   */
  async reset(): Promise<void> {
    this.logger.info('Resetting connection pool', {
      connectionCount: this.connections.size,
    });

    // Close all connections
    const conns = Array.from(this.connections.values());
    for (const conn of conns) {
      conn.state = ConnectionState.CLOSED;
    }

    this.connections.clear();
    this.requestQueue = [];

    // Reinitialize pool
    this.initializePool();
  }

  /**
   * Drain and destroy pool
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying connection pool', {
      connectionCount: this.connections.size,
    });

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
    }

    // Close all connections
    const entries = Array.from(this.connections.entries());
    for (const [, conn] of entries) {
      conn.state = ConnectionState.CLOSED;
      // Actual close logic would be here
    }

    this.connections.clear();
    this.requestQueue = [];
    this.statistics.clear();
  }

  /**
   * Get connection by ID
   */
  getConnectionById(id: string): PooledConnection | null {
    return this.connections.get(id) || null;
  }

  /**
   * Get all connections
   */
  getAllConnections(): PooledConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get pool configuration
   */
  getConfig(): Required<PoolConfig> {
    return this.config;
  }
}

export default ConnectionPool;
