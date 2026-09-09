import assert from 'node:assert/strict';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const storage = new MemoryStorage();
const listeners = new Map<string, Array<(...args: any[]) => void>>();
const windowMock = {
  location: { origin: 'https://example.test' },
  addEventListener(type: string, cb: (...args: any[]) => void) {
    const list = listeners.get(type) || [];
    list.push(cb);
    listeners.set(type, list);
  },
  dispatchEvent(_event: any) { return true; }
};

Object.assign(globalThis as any, {
  window: windowMock,
  localStorage: storage,
  CustomEvent: (globalThis as any).CustomEvent || class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: any) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
});

storage.setItem('zhirox_session_token', 'session-token-abc');
storage.setItem('zhirox_active_context', JSON.stringify({ tenant_id: 'market-a' }));

const api = await import('../src/utils/apiClient.ts');

const requestHeaders: Record<string, string>[] = [];
(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  requestHeaders.push(Object.fromEntries(new Headers(init?.headers).entries()));
  throw new Error('simulated network outage');
};

const firstResponse = await api.authenticatedFetch('/api/customers/customer-1/transactions', {
  method: 'POST',
  headers: { Cookie: 'must-not-persist=1' },
  body: JSON.stringify({ type: 'DEBT_ADD', amount: 1000, currency: 'IQD' })
});
assert.equal(firstResponse.status, 202, 'failed financial mutation must be queued');

const firstAttemptKey = requestHeaders[0]['idempotency-key'];
assert.ok(firstAttemptKey, 'first network attempt must carry Idempotency-Key');
assert.equal(requestHeaders[0]['authorization'], 'Bearer session-token-abc');
assert.equal(requestHeaders[0]['x-market-id'], 'market-a');

let rawQueue = JSON.parse(storage.getItem('zhirox_offline_queue') || '[]');
assert.equal(rawQueue.length, 1);
const queued = rawQueue[0];
assert.equal(queued.schemaVersion, 2);
assert.equal(queued.idempotencyKey, firstAttemptKey, 'queued retry must preserve the original key');
assert.equal(queued.marketId, 'market-a');
const storedHeaderNames = Object.keys(queued.headers || {}).map((h) => h.toLowerCase());
assert.ok(!storedHeaderNames.includes('authorization'), 'Bearer token must never be persisted');
assert.ok(!storedHeaderNames.includes('cookie'), 'cookies must never be persisted');
assert.ok(!storedHeaderNames.includes('x-market-id'), 'tenant header is rebuilt from active context');

requestHeaders.length = 0;
(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  requestHeaders.push(Object.fromEntries(new Headers(init?.headers).entries()));
  return new Response(JSON.stringify({ status: 'success' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

const syncResult = await api.syncOfflineQueue();
assert.equal(syncResult.successCount, 1);
assert.equal(syncResult.failCount, 0);
assert.equal(requestHeaders.length, 1);
assert.equal(requestHeaders[0]['idempotency-key'], firstAttemptKey, 'replay must use the exact first-attempt key');
assert.equal(requestHeaders[0]['authorization'], 'Bearer session-token-abc', 'replay must rebuild auth from current session');
assert.equal(requestHeaders[0]['x-market-id'], 'market-a', 'replay must rebuild tenant binding');
assert.deepEqual(JSON.parse(storage.getItem('zhirox_offline_queue') || '[]'), []);

// Legacy financial mutations created before queue schema v2 did not send an idempotency key.
// They are scrubbed but deliberately not auto-replayed because deduplication cannot be proven.
storage.setItem('zhirox_offline_queue', JSON.stringify([{
  id: 'legacy-financial-write',
  url: '/api/customers/customer-1/transactions',
  method: 'POST',
  headers: {
    Authorization: 'Bearer leaked-old-token',
    'X-Market-ID': 'market-a',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ type: 'PAYMENT_RECEIVE', amount: 500, currency: 'IQD' }),
  timestamp: new Date().toISOString()
}]));

const normalizedLegacy = api.getOfflineQueue();
assert.equal(normalizedLegacy.length, 1);
assert.equal(normalizedLegacy[0].legacyUnsafe, true);
rawQueue = JSON.parse(storage.getItem('zhirox_offline_queue') || '[]');
assert.ok(!Object.keys(rawQueue[0].headers || {}).some((h) => h.toLowerCase() === 'authorization'));

let legacyFetchCalled = false;
(globalThis as any).fetch = async () => {
  legacyFetchCalled = true;
  return new Response('{}', { status: 200 });
};
const legacyResult = await api.syncOfflineQueue();
assert.equal(legacyResult.successCount, 0);
assert.equal(legacyResult.failCount, 1);
assert.equal(legacyFetchCalled, false, 'unsafe legacy financial write must not auto-replay');
assert.equal(api.getOfflineQueue().length, 1, 'unsafe legacy item must remain for manual review');

// A queued write is tenant-bound. Switching market context cannot redirect it.
api.clearOfflineQueue();
storage.setItem('zhirox_offline_queue', JSON.stringify([{
  schemaVersion: 2,
  id: 'market-b-write',
  url: '/api/customers/customer-2/transactions',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'DEBT_ADD', amount: 750, currency: 'IQD' }),
  timestamp: new Date().toISOString(),
  idempotencyKey: 'fixed-key-market-b',
  marketId: 'market-b',
  legacyUnsafe: false
}]));

let crossTenantFetchCalled = false;
(globalThis as any).fetch = async () => {
  crossTenantFetchCalled = true;
  return new Response('{}', { status: 200 });
};
const tenantResult = await api.syncOfflineQueue();
assert.equal(tenantResult.successCount, 0);
assert.equal(tenantResult.failCount, 1);
assert.equal(crossTenantFetchCalled, false, 'cross-tenant queued write must not be replayed');
assert.equal(api.getOfflineQueue().length, 1);

console.log('Offline queue safety verification passed.');
