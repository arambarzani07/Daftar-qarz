export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  timestamp: string;
  description?: string;
}

export interface SyncResult {
  successCount: number;
  failCount: number;
  total: number;
  errors: string[];
}

export interface ExtendedRequestInit extends RequestInit {
  skipQueue?: boolean;
  description?: string;
}

const OFFLINE_QUEUE_KEY = 'zhirox_offline_queue';

/**
 * Get current offline queued requests from localStorage
 */
export function getOfflineQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read offline queue from localStorage:', e);
    return [];
  }
}

/**
 * Save offline queue array to localStorage and notify listeners
 */
export function saveOfflineQueue(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
  } catch (e) {
    console.error('Failed to save offline queue to localStorage:', e);
  }
}

/**
 * Add a failed request to the offline queue
 */
export function addToOfflineQueue(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  description?: string
): QueuedRequest {
  let serializedBody: string | null = null;
  if (typeof body === 'string') {
    serializedBody = body;
  } else if (body && typeof body === 'object') {
    try {
      serializedBody = JSON.stringify(body);
    } catch (e) {
      serializedBody = String(body);
    }
  }

  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: QueuedRequest = {
    id,
    url,
    method: (method || 'POST').toUpperCase(),
    headers: { ...headers },
    body: serializedBody,
    timestamp: new Date().toISOString(),
    description: description || `${method.toUpperCase()} ${url.split('?')[0]}`
  };

  const queue = getOfflineQueue();
  queue.push(item);
  saveOfflineQueue(queue);

  console.warn(`[Offline Queue] Request added to queue: ${item.method} ${item.url} (ID: ${item.id})`);
  return item;
}

/**
 * Remove a queued request by ID
 */
export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter(req => req.id !== id);
  saveOfflineQueue(queue);
}

/**
 * Clear all queued requests
 */
export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

/**
 * Attempt to process and sync all queued requests sequentially
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  const queue = getOfflineQueue();
  const result: SyncResult = {
    successCount: 0,
    failCount: 0,
    total: queue.length,
    errors: []
  };

  if (queue.length === 0) return result;

  console.log(`[Offline Sync] Starting sync for ${queue.length} queued requests...`);

  for (const item of queue) {
    try {
      const options: ExtendedRequestInit = {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined,
        skipQueue: true
      };

      const res = await fetch(item.url, options);

      if (res.ok || res.status === 200 || res.status === 201 || res.status === 204) {
        removeFromOfflineQueue(item.id);
        result.successCount++;
        console.log(`[Offline Sync] Request synced successfully: ${item.id}`);
      } else {
        result.failCount++;
        const errorMsg = `فەشەلی ${item.method} ${item.url}: سێرڤەر وەڵامی دایەوە بە کۆدی ${res.status}`;
        result.errors.push(errorMsg);
        console.error(`[Offline Sync] ${errorMsg}`);
        // Stop sequential sync if server returned error
        break;
      }
    } catch (err: any) {
      result.failCount++;
      const errorMsg = `پەیوەندی نییە: ${err?.message || 'خەتای تۆڕ'}`;
      result.errors.push(errorMsg);
      console.error(`[Offline Sync] ${errorMsg}`);
      // Stop sync loop on network failure
      break;
    }
  }

  // Trigger app data refresh if any requests succeeded
  if (result.successCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zhirox-refresh-data'));
  }

  return result;
}

// Auto-sync listener on reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[apiClient] Network connectivity restored. Attempting auto-sync...');
    syncOfflineQueue();
  });
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const rawToken = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
  const token = rawToken ? rawToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim() : '';
  const activeCtxStr = typeof window !== 'undefined' ? localStorage.getItem('zhirox_active_context') : null;
  let marketId = '';
  if (activeCtxStr) {
    try {
      const parsed = JSON.parse(activeCtxStr);
      marketId = parsed.tenant_id || parsed.marketId || parsed.market_id || '';
    } catch (e) {}
  }

  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...customHeaders
  };

  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (marketId && marketId !== 'SYSTEM_GLOBAL' && !headers['X-Market-ID'] && !headers['x-market-id']) {
    headers['X-Market-ID'] = marketId;
  }

  return headers;
}

export async function authenticatedFetch(url: string, options: ExtendedRequestInit = {}): Promise<Response> {
  const { skipQueue, description, ...fetchInit } = options;

  const rawToken = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
  const token = rawToken ? rawToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim() : '';
  const activeCtxStr = typeof window !== 'undefined' ? localStorage.getItem('zhirox_active_context') : null;
  let marketId = '';
  if (activeCtxStr) {
    try {
      const parsed = JSON.parse(activeCtxStr);
      marketId = parsed.tenant_id || parsed.marketId || parsed.market_id || '';
    } catch (e) {}
  }

  const customHeaders = (fetchInit.headers as Record<string, string>) || {};
  const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;

  const rawHeaders: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...customHeaders
  };

  if (!isFormData && !rawHeaders['Content-Type'] && !rawHeaders['content-type']) {
    rawHeaders['Content-Type'] = 'application/json';
  }

  if (marketId && marketId !== 'SYSTEM_GLOBAL' && !rawHeaders['X-Market-ID'] && !rawHeaders['x-market-id']) {
    rawHeaders['X-Market-ID'] = marketId;
  }

  const cleanHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanHeaders[k] = String(v);
    }
  }

  const method = (fetchInit.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  try {
    const response = await fetch(url, { ...fetchInit, headers: cleanHeaders });

    if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504) && isMutation && !skipQueue) {
      const queuedItem = addToOfflineQueue(url, method, cleanHeaders, fetchInit.body, description);
      return new Response(
        JSON.stringify({
          status: 'queued',
          offline: true,
          queued_id: queuedItem.id,
          message: 'سێرڤەر بەردەست نییە. داواکارییەکە لە ڕیزی ئۆفلاین پاشەکەوت کرا.'
        }),
        {
          status: 202,
          statusText: 'Accepted (Queued Offline)',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return response;
  } catch (error: any) {
    if (isMutation && !skipQueue) {
      const queuedItem = addToOfflineQueue(url, method, cleanHeaders, fetchInit.body, description);
      return new Response(
        JSON.stringify({
          status: 'queued',
          offline: true,
          queued_id: queuedItem.id,
          message: 'پەیوەندی ئینتەرنێت پچڕاوە. داواکارییەکە لە ڕیزی ئۆفلاین پاشەکەوت کرا.'
        }),
        {
          status: 202,
          statusText: 'Accepted (Queued Offline)',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    throw error;
  }
}

