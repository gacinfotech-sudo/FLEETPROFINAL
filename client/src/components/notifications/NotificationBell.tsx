/**
 * NotificationBell Component
 * Real-time notification badge and bell icon
 * Displays unread notification count and opens notification center
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import './notification-bell.css';

interface NotificationBellProps {
  onOpenNotificationCenter?: () => void;
  unreadCount?: number;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  onOpenNotificationCenter,
  unreadCount: initialUnreadCount = 0,
}) => {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isAnimating, setIsAnimating] = useState(false);
  const notificationCountRef = useRef(initialUnreadCount);

  // Listen for notification events from service worker
  useEffect(() => {
    if (!navigator.serviceWorker) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'NOTIFICATION_EVENT') {
        const { type } = event.data.data || {};

        // Increment count on new notifications
        if (type === 'displayed') {
          setUnreadCount((prev) => prev + 1);
          notificationCountRef.current += 1;
          triggerPulseAnimation();
        }

        // Decrement count when notifications are clicked
        if (type === 'clicked') {
          setUnreadCount((prev) => Math.max(0, prev - 1));
          notificationCountRef.current = Math.max(
            0,
            notificationCountRef.current - 1
          );
        }

        // Decrement count when notifications are dismissed
        if (type === 'dismissed') {
          setUnreadCount((prev) => Math.max(0, prev - 1));
          notificationCountRef.current = Math.max(
            0,
            notificationCountRef.current - 1
          );
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Periodically fetch unread count from server
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/notifications/unread-count');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.count || 0);
          notificationCountRef.current = data.count || 0;
        }
      } catch (error) {
        console.error('[NOTIF] Failed to fetch unread count:', error);
      }
    };

    // Fetch on mount
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const triggerPulseAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
  };

  const handleClick = () => {
    onOpenNotificationCenter?.();
    // Reset unread count when notification center is opened
    setUnreadCount(0);
    notificationCountRef.current = 0;
  };

  return (
    <div className="notification-bell-container">
      <button
        className={`notification-bell ${isAnimating ? 'animating' : ''}`}
        onClick={handleClick}
        title="View notifications"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell size={24} />

        {unreadCount > 0 && (
          <div className="notification-badge">
            <span className="badge-count">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;
