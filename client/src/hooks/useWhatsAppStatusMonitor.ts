import { useEffect, useState } from 'react';

interface WhatsAppStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'checking';
  lastCheck: Date;
}

export function useWhatsAppStatusMonitor() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    status: 'checking',
    lastCheck: new Date(),
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isMounted = true;

    const checkWhatsAppStatus = async () => {
      try {
        const response = await fetch('/api/whatsapp/session/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null);

        if (!isMounted) return;

        if (response && response.ok) {
          const data = await response.json();
          setStatus({
            connected: data.status === 'connected',
            status: data.status,
            lastCheck: new Date(),
          });

          // If disconnected, try auto-reconnect
          if (data.status !== 'connected') {
            console.log('⚠️ WhatsApp disconnected, attempting auto-reconnect...');
            tryAutoReconnect();
          }
        } else {
          setStatus(prev => ({
            ...prev,
            connected: false,
            status: 'disconnected',
            lastCheck: new Date(),
          }));
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('WhatsApp status check failed:', error);
        setStatus(prev => ({
          ...prev,
          connected: false,
          status: 'disconnected',
          lastCheck: new Date(),
        }));
      }
    };

    const tryAutoReconnect = async () => {
      try {
        await fetch('/api/whatsapp/session/auto-reconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.warn('Auto-reconnect attempt failed:', error);
      }
    };

    // Initial check
    checkWhatsAppStatus();

    // Check every 5 seconds
    intervalId = setInterval(checkWhatsAppStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return status;
}
