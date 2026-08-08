import { useState, useEffect, useCallback } from 'react';

export interface PwaUpdateState {
  hasUpdate: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setHasUpdate(true);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setHasUpdate(true);
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setHasUpdate(false);
  }, [waitingWorker]);

  const dismissUpdate = useCallback(() => {
    setHasUpdate(false);
  }, []);

  return {
    hasUpdate,
    applyUpdate,
    dismissUpdate
  };
}
