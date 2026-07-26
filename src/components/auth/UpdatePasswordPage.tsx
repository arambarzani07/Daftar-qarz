import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface UpdatePasswordPageProps {
  onSuccess: () => void;
}

export function UpdatePasswordPage({ onSuccess }: UpdatePasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function checkRecoverySession() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const tokenParam = searchParams.get('token');
        const hash = window.location.hash;
        const search = window.location.search;
        const isRecoveryUrl = hash.includes('type=recovery') || search.includes('type=recovery') || search.includes('code=') || hash.includes('access_token=') || Boolean(tokenParam);

        if (tokenParam) {
          setSessionValid(true);
          setIsLoading(false);
          return;
        }

        // Check current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session || isRecoveryUrl) {
          setSessionValid(true);
        } else {
          // Check if auth state change fires recovery
          supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (event === 'PASSWORD_RECOVERY' || currentSession) {
              setSessionValid(true);
              setIsLoading(false);
            }
          });

          setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: s } }) => {
              if (s || isRecoveryUrl || tokenParam) {
                setSessionValid(true);
              } else {
                setSessionValid(false);
              }
              setIsLoading(false);
            });
          }, 1000);
          return;
        }
      } catch (err) {
        console.error('Recovery session check error:', err);
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('token')) {
          setSessionValid(true);
        } else {
          setSessionValid(false);
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password || password.length < 6) {
      setErrorMessage('وشەی نهێنی دەبێت לפחות 6 پیت بێت');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('وشەی نهێنی و دووبارەکردنەوەکەی یەکگرتوو نین');
      return;
    }

    setIsSubmitting(true);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenParam = searchParams.get('token');

      if (tokenParam) {
        // Use backend recovery token endpoint
        const res = await fetch('/api/auth/recover/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenParam, password })
        });
        const json = await res.json();
        if (!res.ok || json.status !== 'success') {
          setErrorMessage(json.message || 'هەڵە لە گۆڕینی وشەی نهێنی. تکایە دووبارە هەوڵ بدەرەوە.');
          setIsSubmitting(false);
          return;
        }
      } else {
        // Use Supabase auth updateUser
        const { error } = await supabase.auth.updateUser({
          password: password
        });

        if (error) {
          setErrorMessage('هەڵە لە گۆڕینی وشەی نهێنی: ' + error.message);
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMessage('وشەی نهێنییەکەت بە سەرکەوتوویی گۆڕدرا. ئێستا بچۆ ژوورەوە.');
      
      try {
        await supabase.auth.signOut();
      } catch {}

      localStorage.removeItem('zhirox_session_token');
      localStorage.removeItem('zhirox_active_context');

      setTimeout(() => {
        window.history.replaceState({}, '', '/auth/login');
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      console.error('Password update error:', err);
      setErrorMessage('هەڵەیەکی نەخوازراو ڕویدا. دووبارە هەوڵ بدەرەوە.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#000000] text-[#F5F5F7] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto" />
          <p className="text-sm text-[#8E8E93]">خەریکی پشکنینی لینکی گۆڕینی وشەی نهێنی...</p>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#000000] text-[#F5F5F7] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">لینکی گۆڕینی وشەی نهێنی بەسەرچووە یان نادروستە</h1>
            <p className="text-sm text-[#8E8E93] leading-relaxed">
              تکایە داواکارییەکی نوێ بۆ گۆڕینی وشەی نهێنی بنێرە چونکە ئەم لینکە بەکارهاتووە یاخود کاتی بەسەرچووە.
            </p>
          </div>
          <button
            onClick={() => {
              window.history.replaceState({}, '', '/auth/login');
              window.location.reload();
            }}
            className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-[#E5E5EA] transition-colors flex items-center justify-center gap-2"
          >
            <span>چوونەژوورەوە / داواکاری نوێ</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#000000] text-[#F5F5F7] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-400 mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">وشەی نهێنی نوێ دابنێ</h1>
          <p className="text-sm text-[#8E8E93]">تکایە وشەی نهێنی نوێی هەژمارەکەت بنووسە</p>
        </div>

        {successMessage ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 mx-auto" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8E8E93]">وشەی نهێنی نوێ</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-[#8E8E93] focus:outline-none focus:border-emerald-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8E8E93]">دووبارەکردنەوەی وشەی نهێنی نوێ</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-[#8E8E93] focus:outline-none focus:border-emerald-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جێبەجێکردن...</span>
                </>
              ) : (
                <span>گۆڕینی وشەی نهێنی</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
