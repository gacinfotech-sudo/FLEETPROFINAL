// Background Sync API for FleetPro PWA
// Enables syncing when connection is restored via Web Background Sync
import { createLogger } from '../../server/utils/logger';

const log = createLogger('BackgroundSync');

export interface SyncTag {
  tag: 'bookings-sync' | 'customers-sync' | 'vehicles-sync' | 'drivers-sync' | 'general-sync';
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
}

class BackgroundSyncManager {
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initializeServiceWorker();
  }

  private async initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        log.info('Service Worker ready for Background Sync');
      } catch (error) {
        log.error('Failed to get Service Worker registration', { error });
      }
    }
  }

  async isSupported(): Promise<boolean> {
    return 'serviceWorker' in navigator && 'SyncManager' in window;
  }

  async registerSync(tag: string, options?: any): Promise<boolean> {
    try {
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.ready;
      }

      // Check if Background Sync is supported
      if (!('sync' in this.registration)) {
        log.warn('Background Sync not supported in this browser');
        return false;
      }

      await (this.registration.sync as any).register(tag);
      log.info('Sync registered', { tag });
      return true;
    } catch (error) {
      log.error('Failed to register sync', { tag, error });
      return false;
    }
  }

  async getTags(): Promise<string[]> {
    try {
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.ready;
      }

      if (!('sync' in this.registration)) {
        return [];
      }

      return await (this.registration.sync as any).getTags();
    } catch (error) {
      log.error('Failed to get sync tags', { error });
      return [];
    }
  }

  async syncBookings(): Promise<boolean> {
    return this.registerSync('bookings-sync', { priority: 'high' });
  }

  async syncCustomers(): Promise<boolean> {
    return this.registerSync('customers-sync', { priority: 'medium' });
  }

  async syncVehicles(): Promise<boolean> {
    return this.registerSync('vehicles-sync', { priority: 'medium' });
  }

  async syncDrivers(): Promise<boolean> {
    return this.registerSync('drivers-sync', { priority: 'medium' });
  }

  async syncAll(): Promise<boolean> {
    const results = await Promise.all([
      this.syncBookings(),
      this.syncCustomers(),
      this.syncVehicles(),
      this.syncDrivers(),
    ]);

    return results.every((r) => r === true);
  }

  setupSyncListener(callback: (tag: string) => void) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          callback(event.data.tag);
          log.info('Sync completed', { tag: event.data.tag });
        }
      });
    }
  }

  setupSyncErrorListener(callback: (tag: string, error: string) => void) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_ERROR') {
          callback(event.data.tag, event.data.error);
          log.error('Sync failed', { tag: event.data.tag, error: event.data.error });
        }
      });
    }
  }
}

export const backgroundSyncManager = new BackgroundSyncManager();

export default BackgroundSyncManager;
