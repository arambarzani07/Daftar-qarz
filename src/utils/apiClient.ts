export interface QueuedRequest {
  schemaVersion: 2;
  id: string;
  url: string;
  method: string;
  /** Safe, non-secret headers only. Auth/session headers are rebuilt at replay time. */
  headers: Record<string, string>;
  body: string | null;
  timestamp: string;
  description?: string;
  /** Stable across the first attempt and every retry. */
  idempotencyKey?: string;
  /** Tenant binding used to prevent a queued write from replaying into another market. */
  marketId?: string;
  /** Legacy financial writes without an original idempotency key must never auto-replay. */
  legacyUnsafe?: boolean;
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
const QUEUE_SCHEMA_VERSION = 2 as const;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const NEVER_PERSIST_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-market-id',
  'x-supabase-auth',
  'x-auth-token'
]);

function makeRequestId(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function makeIdempotencyKey(): string {
  return `zq-${makeRequestId()}`;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  try {
    const normalized = new Headers(headers);
    normalized.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  } catch {}

  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (Array.isArray(pair) && pair.length >= 2) result[String(pair[0])] = String(pair[1]);
    }
    return result;
  }

  if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers as Record<string, string>)) {
      if (value !== undefined && value !== null) result[key] = String(value);
    }
  }
  return result;
}

function getHeader(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return String(value || '');
  }
  return '';
}

function setHeaderIfMissing(headers: Record<string, string>, name: string, value: string): void {
  if (!getHeader(headers, name) && value) headers[name] = value;
}

function sanitizeHeadersForStorage(headers: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (!value) continue;
    if (NEVER_PERSIST_HEADERS.has(key.toLowerCase())) continue;
    safe[key] = String(value);
  }
  return safe;
}

function getCurrentToken(): string {
  const rawToken = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
  return rawToken ? rawToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim() : '';
}

function getCurrentMarketId(): string {
  if (typeof window === 'undefined') return '';
  const activeCtxStr = localStorage.getItem('zhirox_active_context');
  if (!activeCtxStr) return '';
  try {
    const parsed = JSON.parse(activeCtxStr);
    return String(parsed.tenant_id || parsed.marketId || parsed.market_id || '').trim();
  } catch {
    return '';
  }
}

function isMutation(method: string): boolean {
  return MUTATION_METHODS.has((method || 'GET').toUpperCase());
}

function isFinancialTransactionMutation(url: string, method: string): boolean {
  if (!isMutation(method)) return false;
  try {
    const path = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
    return /^\/api\/customers\/[^/]+\/transactions(?:\/|$)/.test(path);
  } catch {
    return /\/api\/customers\/[^/]+\/transactions(?:\/|$)/.test(url);
  }
}

function serializeQueueBody(body: any): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;

  // FormData/Blob/streams cannot be safely reconstructed from localStorage.
  if (typeof FormData !== 'undefined' && body instanceof FormData) return null;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return null;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();

  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
  return String(body);
}

function normalizeQueuedItem(raw: any): QueuedRequest | null {
  if (!raw || typeof raw !== 'object' || !raw.url) return null;

  const rawHeaders = headersToRecord(raw.headers || {});
  const method = String(raw.method || 'POST').toUpperCase();
  const existingIdempotencyKey = String(
    raw.idempotencyKey ||
    getHeader(rawHeaders, 'Idempotency-Key') ||
    getHeader(rawHeaders, 'X-Idempotency-Key') ||
    ''
  ).trim();
  const storedMarketId = String(raw.marketId || getHeader(rawHeaders, 'X-Market-ID') || '').trim();
  const legacyUnsafe = Boolean(
    raw.legacyUnsafe ||
    (raw.schemaVersion !== QUEUE_SCHEMA_VERSION && isFinancialTransactionMutation(String(raw.url), method) && !existingIdempotencyKey)
  );

  return {
    schemaVersion: QUEUE_SCHEMA_VERSION,
    id: String(raw.id || `req_${makeRequestId()}`),
    url: String(raw.url),
    method,
    headers: sanitizeHeadersForStorage(rawHeaders),
    body: typeof raw.body === 'string' ? raw.body : serializeQueueBody(raw.body),
    timestamp: String(raw.timestamp || new Date().toISOString()),
    description: raw.description ? String(raw.description) : undefined,
    idempotencyKey: existingIdempotencyKey || undefined,
    marketId: storedMarketId || undefined,
    legacyUnsafe
  };
}

function persistQueue(queue: QueuedRequest[], notify = true): void {
  if (typeof window === 'undefined') return;
  const sanitized = queue.map((item) => ({
    ...item,
    schemaVersion: QUEUE_SCHEMA_VERSION,
    headers: sanitizeHeadersForStorage(item.headers || {})
  }));
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(sanitized));
  if (notify) {
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: sanitized }));
  }
}

/**
 * Get current offline queued requests from localStorage.
 * Legacy entries are immediately scrubbed so old Bearer tokens cannot remain persisted.
 */
export function getOfflineQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(normalizeQueuedItem)
      .filter((item): item is QueuedRequest => Boolean(item));

    // Persist the sanitized v2 representation without causing an event loop.
    persistQueue(normalized, false);
    return normalized;
  } catch (e) {
    console.error('Failed to read offline queue from localStorage:', e);
    return [];
  }
}

/** Save a sanitized queue and notify listeners. */
export function saveOfflineQueue(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    persistQueue(queue, true);
  } catch (e) {
    console.error('Failed to save offline queue to localStorage:', e);
  }
}

/** Add a failed request to the offline queue without persisting auth/session secrets. */
export function addToOfflineQueue(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  description?: string
): QueuedRequest {
  const normalizedMethod = (method || 'POST').toUpperCase();
  const idempotencyKey = String(
    getHeader(headers, 'Idempotency-Key') || getHeader(headers, 'X-Idempotency-Key') || (isMutation(normalizedMethod) ? makeIdempotencyKey() : '')
  ).trim();
  const marketId = String(getHeader(headers, 'X-Market-ID') || getCurrentMarketId() || '').trim();

  const item: QueuedRequest = {
    schemaVersion: QUEUE_SCHEMA_VERSION,
    id: `req_${makeRequestId()}`,
    url,
    method: normalizedMethod,
    headers: sanitizeHeadersForStorage(headers),
    body: serializeQueueBody(body),
    timestamp: new Date().toISOString(),
    description: description || `${normalizedMethod} ${url.split('?')[0]}`,
    idempotencyKey: idempotencyKey || undefined,
    marketId: marketId || undefined,
    legacyUnsafe: false
  };

  const queue = getOfflineQueue();
  queue.push(item);
  saveOfflineQueue(queue);

  console.warn(`[Offline Queue] Request added to queue: ${item.method} ${item.url} (ID: ${item.id})`);
  return item;
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter(req => req.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

/**
 * Replay queued writes with a fresh session token, stable idempotency key and strict tenant binding.
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
      if (item.legacyUnsafe && isFinancialTransactionMutation(item.url, item.method)) {
        result.failCount++;
        result.errors.push(`مامەڵەی کۆنی ${item.id} بە خۆکار sync نەکرا؛ چونکە Idempotency-Key ـی سەرەتایی نییە و پێویستی بە پشکنینی دەستی هەیە.`);
        continue;
      }

      const currentMarketId = getCurrentMarketId();
      if (item.marketId && currentMarketId && item.marketId !== currentMarketId) {
        result.failCount++;
        result.errors.push(`مامەڵەی ${item.id} بۆ بازاڕێکی ترە و لەم context ـەدا sync ناکرێت.`);
        continue;
      }

      let changed = false;
      if (!item.marketId && currentMarketId) {
        item.marketId = currentMarketId;
        changed = true;
      }
      if (isMutation(item.method) && !item.idempotencyKey) {
        item.idempotencyKey = makeIdempotencyKey();
        changed = true;
      }
      if (changed) {
        // Persist before network I/O so a crash/reload cannot generate a second key.
        saveOfflineQueue(queue);
      }

      const replayHeaders = sanitizeHeadersForStorage(item.headers || {});
      if (item.idempotencyKey) setHeaderIfMissing(replayHeaders, 'Idempotency-Key', item.idempotencyKey);

      const options: ExtendedRequestInit = {
        method: item.method,
        headers: replayHeaders,
        body: item.body || undefined,
        skipQueue: true,
        description: item.description
      };

      // authenticatedFetch rebuilds Authorization and X-Market-ID from the current session/context.
      const res = await authenticatedFetch(item.url, options);

      if (res.ok || res.status === 200 || res.status === 201 || res.status === 202 || res.status === 204) {
        removeFromOfflineQueue(item.id);
        result.successCount++;
        console.log(`[Offline Sync] Request synced successfully: ${item.id}`);
      } else {
        result.failCount++;
        const errorMsg = res.status === 409
          ? `Idempotency conflict بۆ ${item.id}; مامەڵەکە نەسڕایەوە و پێویستی بە پشکنین هەیە.`
          : `فەشەلی ${item.method} ${item.url}: سێرڤەر وەڵامی دایەوە بە کۆدی ${res.status}`;
        result.errors.push(errorMsg);
        console.error(`[Offline Sync] ${errorMsg}`);
        if (res.status === 401 || res.status === 403 || res.status === 409) break;
      }
    } catch (err: any) {
      result.failCount++;
      const errorMsg = `پەیوەندی نییە: ${err?.message || 'خەتای تۆڕ'}`;
      result.errors.push(errorMsg);
      console.error(`[Offline Sync] ${errorMsg}`);
      break;
    }
  }

  if (result.successCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zhirox-refresh-data'));
  }

  return result;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[apiClient] Network connectivity restored. Attempting auto-sync...');
    syncOfflineQueue();
  });
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getCurrentToken();
  const marketId = getCurrentMarketId();
  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...headersToRecord(customHeaders)
  };

  if (!getHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/json';
  if (marketId && marketId !== 'SYSTEM_GLOBAL' && !getHeader(headers, 'X-Market-ID')) {
    headers['X-Market-ID'] = marketId;
  }
  return headers;
}

export async function authenticatedFetch(url: string, options: ExtendedRequestInit = {}): Promise<Response> {
  const { skipQueue, description, ...fetchInit } = options;
  const token = getCurrentToken();
  const marketId = getCurrentMarketId();
  const customHeaders = headersToRecord(fetchInit.headers);
  const isFormData = typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
  const method = (fetchInit.method || 'GET').toUpperCase();
  const mutation = isMutation(method);

  const rawHeaders: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...customHeaders
  };

  if (!isFormData && !getHeader(rawHeaders, 'Content-Type')) rawHeaders['Content-Type'] = 'application/json';
  if (marketId && marketId !== 'SYSTEM_GLOBAL' && !getHeader(rawHeaders, 'X-Market-ID')) {
    rawHeaders['X-Market-ID'] = marketId;
  }

  // Generate before the first network attempt. If the response is lost after commit,
  // the queued retry carries the exact same key and the ledger unique index deduplicates it.
  if (mutation && !getHeader(rawHeaders, 'Idempotency-Key') && !getHeader(rawHeaders, 'X-Idempotency-Key')) {
    rawHeaders['Idempotency-Key'] = makeIdempotencyKey();
  }

  const cleanHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value !== undefined && value !== null && value !== '') cleanHeaders[key] = String(value);
  }

  const queueFailedMutation = (message: string): Response => {
    // FormData/Blob payloads cannot be losslessly reconstructed from localStorage.
    if (isFormData) {
      throw new Error(`${message} FormData داواکارییەکە بەهۆی پاراستنی داتا خۆکارانە queue نەکرا.`);
    }

    const queuedItem = addToOfflineQueue(url, method, cleanHeaders, fetchInit.body, description);
    return new Response(
      JSON.stringify({
        status: 'queued',
        offline: true,
        queued_id: queuedItem.id,
        idempotency_key: queuedItem.idempotencyKey,
        message
      }),
      {
        status: 202,
        statusText: 'Accepted (Queued Offline)',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };

  try {
    const response = await fetch(url, { ...fetchInit, method, headers: cleanHeaders });

    if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504) && mutation && !skipQueue) {
      return queueFailedMutation('سێرڤەر بەردەست نییە. داواکارییەکە لە ڕیزی ئۆفلاین پاشەکەوت کرا.');
    }

    return response;
  } catch (error: any) {
    if (mutation && !skipQueue) {
      return queueFailedMutation('پەیوەندی ئینتەرنێت پچڕاوە. داواکارییەکە لە ڕیزی ئۆفلاین پاشەکەوت کرا.');
    }
    throw error;
  }
}
