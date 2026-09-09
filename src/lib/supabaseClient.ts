import { createClient } from '@supabase/supabase-js';

function cleanValue(val: string | undefined): string {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function isAllowedSupabaseUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return import.meta.env.DEV && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

const configuredUrl = cleanValue(import.meta.env.VITE_SUPABASE_URL);
const configuredAnonKey = cleanValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabaseConfigured = Boolean(
  isAllowedSupabaseUrl(configuredUrl) &&
  configuredAnonKey &&
  configuredAnonKey !== 'placeholder_anon_key'
);

export const supabaseConfigError = supabaseConfigured
  ? ''
  : 'Supabase client configuration is missing or invalid.';

// Fail closed when client configuration is absent. The local address is intentionally
// non-routable for the app and the custom fetch prevents any network request anyway.
const supabaseUrl = supabaseConfigured ? configuredUrl : 'http://127.0.0.1:1';
const supabaseAnonKey = supabaseConfigured ? configuredAnonKey : 'supabase-disabled';

const disabledFetch: typeof fetch = async () => new Response(
  JSON.stringify({ error: supabaseConfigError }),
  {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  }
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: supabaseConfigured ? undefined : { fetch: disabledFetch }
});
