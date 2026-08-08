import { useState, useEffect, useCallback } from 'react';

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'SERVER_UNAVAILABLE';

export interface ConnectivityState {
  status: ConnectivityStatus;
  isOnline: boolean;
  isServerAvailable: boolean;
  lastCheckedAt: Date | null;
  checkConnectivity: () => Promise<void>;
}

export function useConnectivity(): ConnectivityState {
  const [status, setStatus] = useState<ConnectivityStatus>(() => 
    typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE'
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const checkConnectivity = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('OFFLINE');
      setLastCheckedAt(new Date());
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const startTime = Date.now();
      const res = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      setLastCheckedAt(new Date());

      if (res.ok) {
        if (responseTime > 2500) {
          setStatus('DEGRADED');
        } else {
          setStatus('ONLINE');
        }
      } else {
        setStatus('SERVER_UNAVAILABLE');
      }
    } catch (err: any) {
      setLastCheckedAt(new Date());
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setStatus('OFFLINE');
      } else {
        setStatus('SERVER_UNAVAILABLE');
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      checkConnectivity();
    };
    const handleOffline = () => {
      setStatus('OFFLINE');
      setLastCheckedAt(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkConnectivity();

    // Periodic health check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  return {
    status,
    isOnline: status === 'ONLINE' || status === 'DEGRADED',
    isServerAvailable: status === 'ONLINE' || status === 'DEGRADED',
    lastCheckedAt,
    checkConnectivity
  };
}
