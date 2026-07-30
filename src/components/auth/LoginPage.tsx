import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, User, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface LoginPageProps {
  onLoginSuccess: (sessionToken: string, activeContext: any, contexts: any[]) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setErrorMessage('تکایە ژمارەی مۆبایل یان ئیمەیڵ بنووسە.');
      return;
    }
    if (!password) {
      setErrorMessage('تکایە وشەی نهێنی بنووسە.');
      return;
    }

    // 1. Explicit classification: Email vs Phone vs Invalid format
    const isEmail = trimmedIdentifier.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
    const isPhone = /^[0-9+]+$/.test(trimmedIdentifier) && trimmedIdentifier.length >= 7;

    if (!isEmail && !isPhone) {
      setErrorMessage('تکایە ئیمەیڵێکی ڕاست یان ژمارەی مۆبایلێکی دروست بنووسە.');
      return;
    }

    setIsLoading(true);

    try {
      let backendErrorMessage: string | null = null;
      let hasTriedBackend = false;

      // 1. Try backend API /api/auth/login first (direct PostgreSQL & system user auth)
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: trimmedIdentifier, password })
        });
        const loginJson = await loginRes.json();
        hasTriedBackend = true;
        if (loginRes.ok && loginJson.status === 'success' && loginJson.data) {
          const { session_token, activeContext, identity } = loginJson.data;
          const cleanToken = String(session_token || '').replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
          if (!cleanToken) {
            throw new Error('تۆکنی هاتوو بەتاڵە یان نادروستە');
          }
          localStorage.setItem('zhirox_session_token', cleanToken);
          localStorage.removeItem('zhirox_active_context');
          
          // Fetch contexts
          const ctxRes = await fetch('/api/auth/context', {
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Accept': 'application/json'
            }
          });
          const ctxJson = await ctxRes.json();
          const contexts = ctxRes.ok && ctxJson.status === 'success' ? ctxJson.data.contexts : [activeContext];
          
          onLoginSuccess(cleanToken, activeContext, contexts || [activeContext]);
          return;
        } else if (loginJson && loginJson.message) {
          backendErrorMessage = loginJson.message;
        }
      } catch (backendErr) {
        console.error('Backend login API error, falling back to Supabase:', backendErr);
      }

      // Check if Supabase client is a placeholder
      const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || 
                            import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
                            !import.meta.env.VITE_SUPABASE_ANON_KEY || 
                            import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder');

      if (isPlaceholder) {
        setErrorMessage(backendErrorMessage || 'ژمارەی مۆبایل/ئیمەیڵ یان وشەی نهێنی هەڵەیە.');
        setIsLoading(false);
        return;
      }

      // 2. Fallback to Supabase client auth
      let authResponse;
      if (isEmail) {
        authResponse = await supabase.auth.signInWithPassword({
          email: trimmedIdentifier,
          password
        });
      } else {
        const rawPhone = trimmedIdentifier.replace(/\D/g, '');
        let formattedPhone = '+' + rawPhone;
        if (rawPhone.startsWith('964')) {
          formattedPhone = '+' + rawPhone;
        } else if (rawPhone.startsWith('07')) {
          formattedPhone = '+964' + rawPhone.slice(1);
        } else if (rawPhone.startsWith('7')) {
          formattedPhone = '+964' + rawPhone;
        }
        authResponse = await supabase.auth.signInWithPassword({
          phone: formattedPhone,
          password
        });
      }

      const { data, error } = authResponse;

      if (error || !data || !data.session) {
        setErrorMessage('ژمارەی مۆبایل/ئیمەیڵ یان وشەی نهێنی هەڵەیە.');
        setIsLoading(false);
        return;
      }

      const sessionToken = data.session.access_token;
      if (sessionToken) {
        localStorage.setItem('zhirox_session_token', sessionToken);
      }

      // Fetch authoritative contexts via /api/auth/context
      const ctxRes = await fetch('/api/auth/context', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
      const ctxJson = await ctxRes.json();

      if (ctxRes.ok && ctxJson.status === 'success' && ctxJson.data) {
        onLoginSuccess(sessionToken, ctxJson.data.defaultContext || ctxJson.data.contexts?.[0], ctxJson.data.contexts || []);
      } else {
        const fallbackContext = {
          context_id: 'mem-user',
          tenant_id: 'SYSTEM_GLOBAL',
          tenant_name: 'سیستەمی سەرەکی ژیرۆکس',
          role: 'PLATFORM_OWNER',
          role_label_ku: 'خاوەنی سیستەم',
          permissions: ['all']
        };
        onLoginSuccess(sessionToken, fallbackContext, [fallbackContext]);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('لە ئێستادا خزمەتگوزارییەکە بەردەست نییە. دووبارە هەوڵ بدەرەوە.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" lang="ckb" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto space-y-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/5 border border-[#10B981]/30 items-center justify-center shadow-2xl">
            <span className="text-3xl font-black text-[#10B981] tracking-wider">Z</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-white">ZHIROX</h1>
            <p className="text-xs font-medium text-[#8E8E93]">سیستەمی بەڕێوەبردنی قەرزی ژیرۆکس</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2 mb-6">
            <h2 className="text-lg font-bold text-white">بەخێربێیتەوە</h2>
            <p className="text-xs text-[#8E8E93]">بە زانیارییەکانی هەژمارەکەت بچۆ ژوورەوە</p>
          </div>

          {errorMessage && (
            <div 
              aria-live="polite" 
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#8E8E93]">
                ژمارەی مۆبایل یان ئیمەیڵ
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#8E8E93]">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ژمارەی مۆبایل یان ئیمەیڵەکەت بنووسە"
                  aria-invalid={Boolean(errorMessage)}
                  className="w-full h-12 pr-11 pl-4 bg-[#2C2C2E] border border-white/10 rounded-xl text-sm text-white placeholder-[#636366] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#8E8E93]">
                  وشەی نهێنی
                </label>
                <button
                  type="button"
                  onClick={() => {
                    window.history.replaceState({}, '', '/auth/recovery');
                    window.location.reload();
                  }}
                  className="text-xs text-[#10B981] hover:underline"
                >
                  وشەی نهێنیت لەبیرچووە؟
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#8E8E93]">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="وشەی نهێنییەکەت بنووسە"
                  aria-invalid={Boolean(errorMessage)}
                  className="w-full h-12 pr-11 pl-11 bg-[#2C2C2E] border border-white/10 rounded-xl text-sm text-white placeholder-[#636366] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all"
                  style={{ minHeight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'شاراردنەوەی وشەی نهێنی' : 'پیشاندانی وشەی نهێنی'}
                  className="absolute inset-y-0 left-0 pl-4 flex items-center text-[#8E8E93] hover:text-white transition-colors"
                  style={{ minHeight: '44px', minWidth: '44px' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{ minHeight: '44px' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                  <span>چوونە ژوورەوە...</span>
                </>
              ) : (
                <span>چوونە ژوورەوە</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Text and Snapchat & WhatsApp Icons */}
        <div className="text-center space-y-4">
          {/* Social Icons Badge/Links */}
          <div className="flex items-center justify-center gap-3">
            {/* Snapchat Icon */}
            <a
              href="https://snapchat.com/t/OUXQ4qdw"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-2xl bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-white/10 hover:border-[#FFFC00]/50 flex items-center justify-center text-[#FFFC00] transition-all shadow-lg group"
              title="سناپچاتی خاوەنی سیستەم"
            >
              <div className="w-6 h-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                {/* Snapchat Vector Ghost Icon */}
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#FFFC00]">
                  <path d="M12.016 2c-3.15 0-5.736 2.45-5.736 5.46 0 1.636.726 3.1 1.87 4.144-.45.32-.97.714-1.503 1.258-.813.826-1.527 1.838-2.074 2.872-.256.49.07 1.09.617 1.137.935.08 1.968-.137 2.864-.595.666-.342 1.268-.785 1.76-1.222.784.344 1.643.542 2.548.542.905 0 1.764-.198 2.548-.542.492.437 1.094.88 1.76 1.222.896.458 1.93.675 2.864.595.547-.047.873-.647.617-1.137-.547-1.034-1.26-2.046-2.074-2.872-.533-.544-1.053-.938-1.503-1.258 1.144-1.044 1.87-2.508 1.87-4.144C17.752 4.45 15.166 2 12.016 2z"/>
                </svg>
              </div>
            </a>

            {/* WhatsApp Icon */}
            <a
              href="https://wa.me/9647503713171"
              target="_blank"
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-2xl bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-white/10 hover:border-[#25D366]/50 flex items-center justify-center text-[#25D366] transition-all shadow-lg group"
              title="واتسەپی خاوەنی سیستەم: 07503713171"
            >
              <div className="w-6 h-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                {/* WhatsApp Vector Icon */}
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.124-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
              </div>
            </a>
          </div>

          <p className="text-xs text-[#636366]">پارێزراو بە سیستەمی ئاسایشی ZHIROX</p>
        </div>

      </div>
    </div>
  );
}
