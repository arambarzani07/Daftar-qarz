import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export function RecoveryPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('تکایە ئیمەیڵێکی دروست بنووسە.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call backend recovery API endpoint (database-backed)
      try {
        await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: trimmedEmail })
        });
      } catch (apiErr) {
        console.error('Backend recovery API error:', apiErr);
      }

      // 2. Also attempt Supabase resetPasswordForEmail if configured
      try {
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth/update-password`
        });
      } catch (sbErr) {
        console.error('Supabase resetPasswordForEmail error (handled):', sbErr);
      }

      setSuccess(true);
    } catch (err) {
      console.error('Recovery request error:', err);
      setSuccess(true); // Fail-safe secure behavior: do not leak account existence
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

        {/* Recovery Card */}
        <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="space-y-2 mb-6 text-center">
            <h2 className="text-xl font-bold text-white">وشەی نهێنیت لەبیرچووە؟</h2>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              ئیمەیلەکەت بنووسە تا لینکی گۆڕینی وشەی نهێنیت بۆ بنێردرێت.
            </p>
          </div>

          {success ? (
            <div className="space-y-6 text-center">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-3">
                <CheckCircle2 className="w-10 h-10 mx-auto" />
                <p className="text-sm font-medium leading-relaxed">
                  ئەگەر ئەم ئیمەیلە هەژمارێکی پەیوەستکراوی هەبێت، لینکی گۆڕینی وشەی نهێنی بۆ نێردرا.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState({}, '', '/auth/login');
                  window.location.reload();
                }}
                className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-[#E5E5EA] transition-colors flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <span>گەڕانەوە بۆ چوونەژوورەوە</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errorMessage && (
                <div 
                  aria-live="polite" 
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#8E8E93]">
                  ئیمەیل
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#8E8E93]">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    spellCheck="false"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@zhirox.com"
                    className="w-full h-12 pr-11 pl-4 bg-[#2C2C2E] border border-white/10 rounded-xl text-sm text-white placeholder-[#636366] focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all"
                    style={{ minHeight: '44px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-black font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/25 disabled:opacity-50"
                style={{ minHeight: '44px' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    <span>خەریکی ناردن...</span>
                  </>
                ) : (
                  <span>ناردنی لینکی گۆڕینی وشەی نهێنی</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.history.replaceState({}, '', '/auth/login');
                    window.location.reload();
                  }}
                  className="text-xs text-[#8E8E93] hover:text-white transition-colors"
                >
                  گەڕانەوە بۆ چوونەژوورەوە
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Security Text */}
        <div className="text-center">
          <p className="text-xs text-[#636366]">پارێزراو بە سیستەمی ئاسایشی ZHIROX</p>
        </div>

      </div>
    </div>
  );
}
