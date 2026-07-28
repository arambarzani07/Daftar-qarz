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

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
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

  const customHeaders = (options.headers as Record<string, string>) || {};
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...customHeaders
  };

  if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (marketId && marketId !== 'SYSTEM_GLOBAL' && !headers['X-Market-ID'] && !headers['x-market-id']) {
    headers['X-Market-ID'] = marketId;
  }

  return fetch(url, { ...options, headers });
}
