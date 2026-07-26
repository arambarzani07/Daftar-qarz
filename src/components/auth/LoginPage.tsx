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
      // 1. Try backend API /api/auth/login first (direct PostgreSQL & system user auth)
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: trimmedIdentifier, password })
        });
        const loginJson = await loginRes.json();
        if (loginRes.ok && loginJson.status === 'success' && loginJson.data) {
          const { session_token, activeContext, identity } = loginJson.data;
          const cleanToken = String(session_token || '').replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
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
        }
      } catch (backendErr) {
        console.error('Backend login API error, falling back to Supabase:', backendErr);
      }

      // 2. Fallback to Supabase client auth
      let authResponse;
      if (isEmail) {
        authResponse = await supabase.auth.signInWithPassword({
          email: trimmedIdentifier,
          password
        });
      } else {
        authResponse = await supabase.auth.signInWithPassword({
          phone: trimmedIdentifier.replace(/\s+/g, ''),
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

        {/* Footer Security Text */}
        <div className="text-center">
          <p className="text-xs text-[#636366]">پارێزراو بە سیستەمی ئاسایشی ZHIROX</p>
        </div>

      </div>
    </div>
  );
}
