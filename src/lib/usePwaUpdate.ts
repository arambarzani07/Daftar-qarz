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
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    const handleUpdateFound = () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      const handleStateChange = () => {
        if (
          !disposed &&
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(newWorker);
          setHasUpdate(true);
        }
      };

      newWorker.addEventListener('statechange', handleStateChange);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.ready
      .then((readyRegistration) => {
        if (disposed) return;
        registration = readyRegistration;

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setHasUpdate(true);
        }

        registration.addEventListener('updatefound', handleUpdateFound);
        registration.update().catch(() => undefined);
      })
      .catch((err) => {
        console.warn('[SW] Existing registration unavailable:', err);
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      registration?.removeEventListener('updatefound', handleUpdateFound);
    };
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
