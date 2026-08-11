// PWA utilities for FleetPro installable app support
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private serviceWorkerReady = false;

  constructor() {
    this.initializeServiceWorker();
    this.detectInstallState();
    this.setupInstallPrompt();
  }

  private initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration);
          this.serviceWorkerReady = true;

          // Check for updates periodically
          setInterval(() => {
            registration.update().catch((err) => {
              console.warn('[PWA] Service Worker update check failed:', err);
            });
          }, 60000); // Check every 60 seconds
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Listen for controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker controller changed - app updated');
        this.notifyAppUpdate();
      });
    }
  }

  private detectInstallState() {
    // Check if running as installed app
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    this.isInstalled = isStandalone;
    console.log('[PWA] Install state:', this.isInstalled ? 'installed' : 'browser');
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Stash the event for later use
      this.deferredPrompt = e as BeforeInstallPromptEvent;

      // Show install prompt to user
      this.showInstallPrompt();
    });

    // Handle install success/failure
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallPrompt();
    });
  }

  private showInstallPrompt() {
    // Dispatch event so UI can show install button
    const event = new CustomEvent('pwa-install-available');
    window.dispatchEvent(event);
  }

  private hideInstallPrompt() {
    const event = new CustomEvent('pwa-install-complete');
    window.dispatchEvent(event);
  }

  private notifyAppUpdate() {
    const event = new CustomEvent('pwa-update-available');
    window.dispatchEvent(event);
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('[PWA] Install prompt not available');
      return false;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install prompt');
      this.deferredPrompt = null;
      return true;
    }

    return false;
  }

  public getInstallState(): 'installed' | 'installable' | 'unsupported' {
    if (this.isInstalled) return 'installed';
    if (this.deferredPrompt) return 'installable';
    return 'unsupported';
  }

  public isRunningAsApp(): boolean {
    return this.isInstalled;
  }

  public isServiceWorkerReady(): boolean {
    return this.serviceWorkerReady;
  }

  public async clearCache(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_CACHE',
      });
    }
  }

  public async updateApp(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    }
  }

  public getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;

    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  public isIOSWebApp(): boolean {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      (window.navigator as any).standalone === true
    );
  }

  public isAndroidApp(): boolean {
    return (
      /Android/.test(navigator.userAgent) &&
      document.referrer.includes('android-app://')
    );
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Export for use in components
export default pwaManager;
