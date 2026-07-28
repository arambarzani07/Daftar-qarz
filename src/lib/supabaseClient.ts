import { createClient } from '@supabase/supabase-js';

function cleanValue(val: string | undefined): string {
  if (!val) return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseUrl = cleanValue(rawUrl);

const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEFAULT_DUMMY_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyYW5kb20iOiJkYXRhIn0.c2lnbmF0dXJl';

const supabaseAnonKey = (rawAnonKey && cleanValue(rawAnonKey) !== 'placeholder_anon_key')
  ? cleanValue(rawAnonKey)
  : DEFAULT_DUMMY_JWT;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
