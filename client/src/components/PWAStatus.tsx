// PWA Status Component - Shows installation and sync status
import React, { useState, useEffect } from 'react';
import usePWA from '../hooks/usePWA';
import { createLogger } from '../../server/utils/logger';

const log = createLogger('PWAStatus');

export const PWAStatus: React.FC = () => {
  const {
    status,
    updateAvailable,
    installPrompt,
    enableNotifications,
    disableNotifications,
    reloadApp,
    getDeviceType,
  } = usePWA();

  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(updateAvailable);

  useEffect(() => {
    setShowUpdateBanner(updateAvailable);
  }, [updateAvailable]);

  const handleInstall = async () => {
    try {
      const success = await installPrompt();
      if (success) {
        log.info('App installed successfully');
      }
    } catch (error) {
      log.error('Installation failed', { error });
    }
  };

  const handleEnableNotifications = async () => {
    await enableNotifications();
    setShowNotificationBanner(false);
  };

  return (
    <>
      {/* Online/Offline Status */}
      {!status.isOnline && (
        <div className="pwa-offline-banner">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">⚠️</span>
            <span className="pwa-banner-text">
              You are offline. Some features may be limited.
            </span>
            {status.queuedOperations > 0 && (
              <span className="pwa-banner-queue">
                {status.queuedOperations} operation{status.queuedOperations > 1 ? 's' : ''} queued
              </span>
            )}
          </div>
        </div>
      )}

      {/* Update Available Banner */}
      {showUpdateBanner && (
        <div className="pwa-update-banner">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">🔄</span>
            <span className="pwa-banner-text">FleetPro update available</span>
            <div className="pwa-banner-actions">
              <button
                className="pwa-button pwa-button-primary"
                onClick={reloadApp}
              >
                Reload
              </button>
              <button
                className="pwa-button pwa-button-secondary"
                onClick={() => setShowUpdateBanner(false)}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Prompt */}
      {status.isInstallable && !status.isInstalled && (
        <div className="pwa-install-banner">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">📱</span>
            <span className="pwa-banner-text">
              Install FleetPro on your {getDeviceType()}
            </span>
            <div className="pwa-banner-actions">
              <button
                className="pwa-button pwa-button-primary"
                onClick={handleInstall}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Permission Prompt */}
      {status.isInstalled && !status.notificationsEnabled && (
        <div className="pwa-notification-banner">
          <div className="pwa-banner-content">
            <span className="pwa-banner-icon">🔔</span>
            <span className="pwa-banner-text">Enable notifications to stay updated</span>
            <div className="pwa-banner-actions">
              <button
                className="pwa-button pwa-button-primary"
                onClick={handleEnableNotifications}
              >
                Enable
              </button>
              <button
                className="pwa-button pwa-button-secondary"
                onClick={() => setShowNotificationBanner(false)}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .pwa-offline-banner,
        .pwa-update-banner,
        .pwa-install-banner,
        .pwa-notification-banner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 16px;
          margin-bottom: 8px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .pwa-offline-banner {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .pwa-update-banner {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .pwa-install-banner {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }

        .pwa-notification-banner {
          background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
          color: #333;
        }

        .pwa-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: space-between;
        }

        .pwa-banner-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .pwa-banner-text {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }

        .pwa-banner-queue {
          font-size: 12px;
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .pwa-banner-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .pwa-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pwa-button-primary {
          background: rgba(255, 255, 255, 0.3);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .pwa-button-primary:hover {
          background: rgba(255, 255, 255, 0.4);
          border-color: rgba(255, 255, 255, 0.7);
        }

        .pwa-button-secondary {
          background: transparent;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .pwa-button-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 640px) {
          .pwa-banner-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .pwa-banner-text {
            width: 100%;
          }

          .pwa-banner-actions {
            width: 100%;
            justify-content: space-between;
          }

          .pwa-button {
            flex: 1;
          }
        }
      `}</style>
    </>
  );
};

export default PWAStatus;
