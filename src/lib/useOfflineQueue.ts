import React, { useState, useEffect, useCallback } from 'react';
import {
  QueuedRequest,
  SyncResult,
  getOfflineQueue,
  syncOfflineQueue,
  clearOfflineQueue,
  removeFromOfflineQueue
} from '../utils/apiClient';

/**
 * React Hook to monitor and control offline queue
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedRequest[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    const handleQueueChange = (e: Event) => {
      const customEvt = e as CustomEvent<QueuedRequest[]>;
      setQueue(customEvt.detail || getOfflineQueue());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline-queue-changed', handleQueueChange);
      return () => {
        window.removeEventListener('offline-queue-changed', handleQueueChange);
      };
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      setLastSyncResult(res);
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return {
    queue,
    queuedCount: queue.length,
    isSyncing,
    lastSyncResult,
    syncNow,
    clearQueue: clearOfflineQueue,
    removeRequest: removeFromOfflineQueue
  };
}
