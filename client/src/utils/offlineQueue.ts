// Offline Queue System for FleetPro PWA
// Handles offline operations and syncs when connection returns
import { createLogger } from '../../server/utils/logger';

const log = createLogger('OfflineQueue');

export interface QueuedOperation {
  id: string;
  timestamp: number;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, any>;
  headers?: Record<string, string>;
  retries: number;
  lastError?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

class OfflineQueue {
  private dbName = 'FleetProOfflineDB';
  private storeName = 'operations';
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private maxRetries = 3;

  constructor() {
    this.initializeDatabase();
    this.setupOnlineListener();
  }

  private initializeDatabase() {
    if (!('indexedDB' in window)) {
      console.warn('[OfflineQueue] IndexedDB not available');
      return;
    }

    const request = indexedDB.open(this.dbName, 1);

    request.onerror = () => {
      console.error('[OfflineQueue] Database initialization failed');
    };

    request.onsuccess = () => {
      this.db = request.result;
      console.log('[OfflineQueue] Database initialized');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(this.storeName)) {
        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('endpoint', 'endpoint', { unique: false });
        console.log('[OfflineQueue] Object store created');
      }
    };
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Connection restored');
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Connection lost');
      this.notifyOfflineStatus();
    });
  }

  async queueOperation(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, any>
  ): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      endpoint,
      method,
      body,
      headers: {
        'Content-Type': 'application/json',
      },
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(operation);

      request.onsuccess = () => {
        log.info(`Operation queued: ${endpoint}`, { id: operation.id });
        this.notifyQueuedOperation(operation);
        resolve(operation.id);
      };

      request.onerror = () => {
        reject(new Error('Failed to queue operation'));
      };
    });
  }

  async getQueuedOperations(): Promise<QueuedOperation[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  }

  async syncQueue(): Promise<SyncResult> {
    if (this.syncInProgress || !navigator.onLine) {
      return { success: false, synced: 0, failed: 0, errors: [] };
    }

    this.syncInProgress = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      const operations = await this.getQueuedOperations();

      for (const operation of operations) {
        try {
          const response = await fetch(operation.endpoint, {
            method: operation.method,
            headers: operation.headers,
            body: operation.body ? JSON.stringify(operation.body) : undefined,
          });

          if (response.ok) {
            await this.removeOperation(operation.id);
            result.synced++;
            log.info(`Operation synced: ${operation.endpoint}`, { id: operation.id });
          } else {
            result.failed++;
            result.errors.push({
              id: operation.id,
              error: `HTTP ${response.status}`,
            });

            if (operation.retries < this.maxRetries) {
              await this.incrementRetries(operation.id);
            } else {
              await this.removeOperation(operation.id);
              log.error(`Operation failed after retries: ${operation.endpoint}`, {
                id: operation.id,
              });
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: operation.id,
            error: (error as Error).message,
          });
        }
      }

      this.notifySyncComplete(result);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  private async removeOperation(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private async incrementRetries(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result as QueuedOperation;
        operation.retries++;
        operation.lastError = new Date().toISOString();
        const updateRequest = store.put(operation);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => resolve();
      };
    });
  }

  private notifyQueuedOperation(operation: QueuedOperation) {
    window.dispatchEvent(
      new CustomEvent('pwa-operation-queued', {
        detail: { operation },
      })
    );
  }

  private notifyOfflineStatus() {
    window.dispatchEvent(new CustomEvent('pwa-offline-status'));
  }

  private notifySyncComplete(result: SyncResult) {
    window.dispatchEvent(
      new CustomEvent('pwa-sync-complete', {
        detail: { result },
      })
    );
  }

  getQueueStatus(): Promise<{ total: number; pending: number; failed: number }> {
    return this.getQueuedOperations().then((ops) => ({
      total: ops.length,
      pending: ops.filter((op) => op.retries < this.maxRetries).length,
      failed: ops.filter((op) => op.retries >= this.maxRetries).length,
    }));
  }
}

export const offlineQueue = new OfflineQueue();

export default OfflineQueue;
