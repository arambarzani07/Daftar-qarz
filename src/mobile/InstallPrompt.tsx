import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem('zhirox_pwa_prompt_dismissed') === 'true';
    if (isDismissed) return;

    // Check if already in standalone mode
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    if (isStandaloneDisplay || isIosStandalone) return;

    // Detect iOS Safari
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIos && isSafari) {
      setShowIosPrompt(true);
      setDismissed(false);
    }

    // Android Chrome deferred prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('zhirox_pwa_prompt_dismissed', 'true');
  };

  if (dismissed) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-20 left-4 right-4 z-50 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-black border border-[#2C2C2E] p-2 flex items-center justify-center shrink-0 shadow">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-base">
              Z
            </div>
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#F5F5F7]">دامەزراندنی ئەپی ژیرۆکس</h4>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              بۆ کارکردنی خێراتر و شێوازی ئەپ، ئەم بەستەرە زیا بکە بۆ شاشەی سەرەکی.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7] rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showIosPrompt && (
        <div className="mt-3 pt-3 border-t border-[#2C2C2E] text-xs text-[#8E8E93] flex items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
          <span>دابگرە لەسەر</span>
          <Share className="w-4 h-4 text-emerald-400 inline" />
          <span>پاشان</span>
          <span className="font-bold text-[#F5F5F7] flex items-center gap-1">
            <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
            "Add to Home Screen"
          </span>
        </div>
      )}

      {deferredPrompt && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleInstallAndroid}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all"
          >
            <Download className="w-4 h-4" />
            <span>دامەزراندنی ئەپ</span>
          </button>
        </div>
      )}
    </div>
  );
};
