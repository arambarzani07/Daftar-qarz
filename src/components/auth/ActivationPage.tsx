import React, { useState, useEffect } from 'react';
import { Store, ShieldCheck, Lock, AlertCircle, ArrowRight, CheckCircle2, User, Phone, KeyRound } from 'lucide-react';

interface ActivationPageProps {
  onActivationSuccess: (sessionToken: string, activeContext: any, contexts: any[]) => void;
}

interface TokenDetails {
  token_status: string;
  tenant_name: string;
  recipient_name: string;
  manager_login_phone: string;
  role_label: string;
}

export const ActivationPage: React.FC<ActivationPageProps> = ({ onActivationSuccess }) => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Extract token from URL search params (?token=...) or pathname
    const urlParams = new URLSearchParams(window.location.search);
    let extractedToken = urlParams.get('token');

    if (!extractedToken) {
      const parts = window.location.pathname.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'activate' && lastPart !== 'manager') {
        extractedToken = lastPart;
      }
    }

    if (!extractedToken) {
      setIsLoading(false);
      setErrorMessage('کۆدی بانگهێشتنامە یان بەستەرەکە نەنێردراوە.');
      return;
    }

    setToken(extractedToken);

    // Validate token
    fetch(`/api/auth/activate/${extractedToken}`)
      .then(async (res) => {
        const json = await res.json();
        setIsLoading(false);
        if (res.ok && json.status === 'success' && json.data) {
          setTokenDetails(json.data);
        } else {
          setErrorMessage(json.message || 'ئەم بەستەرە دروست نییە یان چیتر کار ناکات.');
        }
      })
      .catch((err) => {
        console.error('Failed to validate activation token:', err);
        setIsLoading(false);
        setErrorMessage('کێشە لە پەیوەندیکردن بە ڕاژەکارەوە ڕوویدا.');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password || password.trim().length < 6) {
      setSubmitError('تکایە وشەی نهێنی نوێ بنووسە (لانیکەم ٦ پیت یان ژمارە)');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('وشەی نهێنی دووبارەکراوە هاوشێوە نییە');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.trim() })
      });

      const json = await res.json();
      setIsSubmitting(false);

      if (res.ok && json.status === 'success' && json.data) {
        const { session_token, activeContext, contexts } = json.data;
        if (session_token && activeContext) {
          onActivationSuccess(session_token, activeContext, contexts || [activeContext]);
          return;
        }
      }

      if (json.status === 'success') {
        // Fallback if data wasn't fully structured
        window.location.href = '/auth/login?activated=1';
        return;
      }

      setSubmitError(json.message || 'چالاککردنی هەژمارەکە سەرکەوتوو نەبوو.');
    } catch (err) {
      console.error('Activation submit failed:', err);
      setIsSubmitting(false);
      setSubmitError('کێشەیەک لە پەیوەندی تۆڕ ڕوویدا.');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col justify-center items-center px-4 py-8">
      {/* Container */}
      <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Accent Radial Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
            <Store className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">ZHIROX</h1>
          <p className="text-xs text-[#8E8E93] mt-1 font-medium">سیستەمی ژیرانەی بەڕێوەبردنی مارکێت و دەفتەری قەرز</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8E8E93] font-medium">پشکنینی بەستەری چالاککردن...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMessage && (
          <div className="space-y-6 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">بەستەرەکە چالاک نییە</h2>
              <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 p-3 rounded-xl leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={() => { window.location.href = '/auth/login'; }}
              className="w-full py-3 px-4 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>چوون بۆ پەڕەی چوونەژوورەوە</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        )}

        {/* Valid Token & Activation Form */}
        {!isLoading && tokenDetails && (
          <div className="space-y-6">
            {/* Target Market & Recipient Card */}
            <div className="bg-[#2C2C2E]/60 border border-[#3A3A3C] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#3A3A3C]">
                <span className="text-xs text-[#8E8E93] font-medium">مارکێتی بەئامانجکراو:</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" />
                  {tokenDetails.tenant_name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[11px] text-[#8E8E93] flex items-center gap-1">
                    <User className="w-3 h-3" /> ناوی بەڕێوەبەر:
                  </div>
                  <div className="font-bold text-white mt-0.5">{tokenDetails.recipient_name}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8E8E93] flex items-center gap-1">
                    <Phone className="w-3 h-3" /> ژمارەی مۆبایل:
                  </div>
                  <div className="font-mono font-semibold text-emerald-300 mt-0.5 dir-ltr text-right">{tokenDetails.manager_login_phone}</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">چالاککردنی هەژمار و دانانی پاسۆرد</h2>
              <p className="text-xs text-[#8E8E93] mt-1">تکایە وشەیەکی نهێنی بەهێز بۆ هەژمارەکەت دیاری بکه</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8E8E93] mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  وشەی نهێنی نوێ (پاسۆرد)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="لانیکەم ٦ پیت یان ژمارە"
                  required
                  autoFocus
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm font-sans placeholder-[#8E8E93] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8E8E93] mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  دووبارەکردنەوەی وشەی نهێنی
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="وشەی نهێنی دووبارە بنووسەرەوە"
                  required
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm font-sans placeholder-[#8E8E93] focus:outline-none transition-colors"
                />
              </div>

              {submitError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 leading-relaxed flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>خەریکی چالاککردن...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>چالاککردنی هەژمار و چوونەنێو مارکێت</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
