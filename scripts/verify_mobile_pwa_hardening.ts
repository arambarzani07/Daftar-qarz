import fs from 'node:fs';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const main = read('src/main.tsx');
const register = read('src/registerServiceWorker.ts');
const sw = read('public/sw.js');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const supabase = read('src/lib/supabaseClient.ts');
const capacitor = read('capacitor.config.ts');
const packageJson = JSON.parse(read('package.json'));

assert(main.includes('registerServiceWorker()'), 'PWA service worker must be activated from main.tsx');
assert(register.includes("register('/sw.js'"), 'PWA worker registration must target /sw.js');
assert(register.includes("updateViaCache: 'none'"), 'PWA worker updates must bypass HTTP cache');

assert(sw.includes("request.headers.has('authorization')"), 'Service worker must never cache Authorization-bearing requests');
assert(sw.includes('url.search'), 'Service worker must not cache query-bearing requests');
assert(sw.includes("url.pathname.startsWith('/api/')"), 'Service worker must exclude API requests');
assert(sw.includes("url.pathname.includes('/auth/')"), 'Service worker must exclude auth requests');
assert(sw.includes("url.pathname.startsWith('/portal/')"), 'Service worker must exclude customer portal requests');
assert(sw.includes('STATIC_ASSET_RE'), 'Service worker must use an explicit static-asset allowlist');

assert(!supabase.includes('placeholder.supabase.co'), 'Supabase client must not fall back to a placeholder remote host');
assert(!supabase.includes('DEFAULT_DUMMY_JWT'), 'Supabase client must not use a dummy JWT fallback');
assert(supabase.includes('supabaseConfigured'), 'Supabase client must expose explicit configuration state');
assert(supabase.includes('disabledFetch'), 'Unconfigured Supabase client must fail closed without network access');

assert(manifest.id === '/', 'PWA manifest must have a stable app id');
assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'PWA manifest must declare at least one icon');
assert(manifest.icons.every((icon: any) => icon.src === '/icons/icon.svg'), 'PWA install must use the real vector icon, not placeholder PNG assets');

assert(capacitor.includes("appId: 'com.zhirox.debt'"), 'Capacitor appId must remain stable');
assert(capacitor.includes("webDir: 'dist'"), 'Capacitor must point to the production web bundle');
assert(capacitor.includes('cleartext: false'), 'Capacitor Android cleartext traffic must remain disabled');

const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
const nativeReady = Boolean(deps['@capacitor/core'] && deps['@capacitor/cli'] && deps['@capacitor/ios'] && deps['@capacitor/android']);
if (!nativeReady) {
  console.warn('[Mobile Gate] Capacitor config is hardened, but native Capacitor packages/projects are not yet installed.');
}

console.log('Mobile/PWA hardening verification passed.');
