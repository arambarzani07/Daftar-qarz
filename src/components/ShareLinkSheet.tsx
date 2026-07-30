import React, { useState, useEffect } from 'react';
import { Customer, ShareLink } from '../types';
import { X, Copy, Share2, Send, Settings, RefreshCw, Trash2, Lock, Check } from 'lucide-react';
import { authenticatedFetch } from '../utils/apiClient';

interface ShareLinkSheetProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export const ShareLinkSheet: React.FC<ShareLinkSheetProps> = ({
  isOpen,
  onClose,
  customer
}) => {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  // Fetch active link on open
  useEffect(() => {
    if (!isOpen || !customer || !customer.id) {
      setIsManaging(false);
      setCopied(false);
      return;
    }

    const loadLink = async () => {
      setIsLoading(true);
      try {
        const custId = encodeURIComponent(customer.id);
        const res = await authenticatedFetch(`/api/customers/${custId}/share-link`);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = await res.json();
        if (json.status === 'success') {
          setShareLink(json.data);
          setPinInput(json.data?.pin_code || '');
        }
      } catch (err) {
        console.error('Failed to load share link:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadLink();
  }, [isOpen, customer?.id]);

  if (!isOpen || !customer) return null;

  const getPublicBaseUrl = () => {
    const envUrl = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || import.meta.env.VITE_APP_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      let trimmed = envUrl.trim().replace(/\/+$/, '');
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = `https://${trimmed}`;
      }
      return trimmed;
    }

    try {
      if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.origin.startsWith('http')) {
        return window.location.origin.replace(/\/+$/, '');
      }
      if (typeof window !== 'undefined' && window.location && window.location.host) {
        const protocol = window.location.protocol && window.location.protocol.startsWith('http') ? window.location.protocol : 'https:';
        return `${protocol}//${window.location.host}`.replace(/\/+$/, '');
      }
    } catch (e) {}

    return 'https://zhirox.com';
  };

  const getAbsoluteShareUrl = () => {
    if (!shareLink) return '';
    let url = shareLink.share_url || `/b/${shareLink.token}`;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const base = getPublicBaseUrl();
      url = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };

  const shareUrl = getAbsoluteShareUrl();

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    const msg = `سڵاو، لەم بەستەرەوە دەتوانیت باڵانسی نوێکراوە و مامەڵەکانی هەژمارەکەت ببینیت.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `هەژماری ${customer.name || ''}`,
          text: msg,
          url: shareUrl
        });
        return;
      } catch (err) {
        console.warn('Native share dismissed or failed, falling back to copy:', err);
      }
    }
    handleCopyLink();
  };

  const handleWhatsAppShare = () => {
    if (!shareUrl) return;
    const msg = `سڵاو ${customer.name || ''}،\nلەم بەستەرەوە دەتوانیت باڵانسی نوێکراوەی هەژمارەکەت و مامەڵەکانت ببینیت:\n\n${shareUrl}`;
    
    let waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (customer.phone) {
      const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');
      if (cleanPhone) {
        waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      }
    }
    try {
      window.open(waUrl, '_blank');
    } catch (e) {
      console.warn('Failed to open WhatsApp window:', e);
    }
  };

  const handleRegenerateLink = async () => {
    const confirmRegen = window.confirm('ئایا دڵنیایت لە دروستکردنی بەستەری نوێ؟ بەستەرەکەی پێشوو چیتر کار ناکات.');
    if (!confirmRegen) return;

    setIsLoading(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/share-link/regenerate`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'success') {
        setShareLink(json.data);
        setPinInput(json.data?.pin_code || '');
        setCopied(false);
      }
    } catch (err) {
      console.error('Failed to regenerate link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    const confirmRevoke = window.confirm('ئایا دڵنیایت لە هەڵوەشاندنەوەی بەستەرەکە؟ کڕیار چیتر ناتوانێت هەژمارەکەی ببينێت.');
    if (!confirmRevoke) return;

    setIsLoading(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/share-link/revoke`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'success') {
        setShareLink(null);
        setIsManaging(false);
      }
    } catch (err) {
      console.error('Failed to revoke link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePin = async () => {
    setIsLoading(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/share-link/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setShareLink(json.data);
        setPinMessage('پین کۆد پاشەکەوت کرا!');
        setTimeout(() => setPinMessage(''), 2000);
      }
    } catch (err) {
      console.error('Failed to save PIN:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      {/* Background Overlay Click to Close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[32px] p-6 pb-safe animate-slide-up border-t border-[#2C2C2E] z-10 text-[#F5F5F7]">
        
        {/* Top bar with Close */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]/80 mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#34C759]" />
            <span className="font-bold text-base">بەستەری هەژماری کڕیار</span>
          </div>
          <button onClick={onClose} className="p-1 text-[#8E8E93] hover:text-[#F5F5F7]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-[#8E8E93] text-sm">
            تکایە چاوەڕێ بکە...
          </div>
        ) : !shareLink ? (
          <div className="py-6 text-center flex flex-col gap-4">
            <p className="text-sm text-[#8E8E93]">
              هیچ بەستەرێکی چالاک نییە بۆ ئەم کڕیارە.
            </p>
            <button
              onClick={handleRegenerateLink}
              className="w-full py-3.5 bg-[#2C2C2E] text-[#F5F5F7] border border-[#3A3A3C] font-bold rounded-xl active-scale"
            >
              دروستکردنی بەستەری ڕاستەوخۆ
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Customer Name & Info */}
            <div className="bg-black/60 p-3 rounded-2xl border border-[#2C2C2E] flex flex-col gap-1">
              <span className="text-xs text-[#8E8E93]">ناوی کڕیار:</span>
              <span className="font-bold text-sm text-[#F5F5F7]">{customer.name}</span>
              <span className="text-[11px] text-[#8E8E93] truncate dir-ltr text-right mt-1">
                {shareUrl}
              </span>
            </div>

            {!isManaging ? (
              /* MAIN SHARE ACTIONS */
              <div className="grid grid-cols-2 gap-2.5">
                
                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="p-3.5 bg-[#2C2C2E] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-bold text-sm active-scale transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-[#34C759]" /> : <Copy className="w-4 h-4 text-blue-400" />}
                  <span>{copied ? 'کۆپی کرا!' : 'کۆپی بەستەر'}</span>
                </button>

                {/* Native Share */}
                <button
                  onClick={handleNativeShare}
                  className="p-3.5 bg-[#2C2C2E] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-bold text-sm active-scale transition-colors"
                >
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span>ناردن</span>
                </button>

                {/* Share to WhatsApp */}
                <button
                  onClick={handleWhatsAppShare}
                  className="col-span-2 p-3.5 bg-[#2C2C2E] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-extrabold text-sm text-[#34C759] active-scale transition-colors"
                >
                  <Share2 className="w-4 h-4 text-[#34C759]" />
                  <span>ناردن بۆ واتساپ</span>
                </button>

                {/* Manage Link */}
                <button
                  onClick={() => setIsManaging(true)}
                  className="col-span-2 p-3.5 bg-black rounded-xl flex items-center justify-center gap-2 border border-[#2C2C2E] font-bold text-xs text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>بەڕێوەبردنی بەستەر</span>
                </button>

              </div>
            ) : (
              /* MANAGE LINK SCREEN */
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
                  <span className="text-xs font-bold text-[#8E8E93]">ڕێکخستنەکانی بەستەر</span>
                  <button
                    onClick={() => setIsManaging(false)}
                    className="text-xs text-blue-400 font-bold"
                  >
                    گەڕانەوە
                  </button>
                </div>

                {/* Regenerate Link */}
                <button
                  onClick={handleRegenerateLink}
                  className="w-full p-3 bg-black rounded-xl border border-[#2C2C2E] flex items-center justify-between text-xs font-bold text-[#F5F5F7] active-scale"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>دروستکردنی بەستەری نوێ</span>
                  </div>
                  <span className="text-[10px] text-[#8E8E93]">کۆنەکە پەکدەخات</span>
                </button>

                {/* Revoke Link */}
                <button
                  onClick={handleRevokeLink}
                  className="w-full p-3 bg-black rounded-xl border border-rose-900/40 flex items-center justify-between text-xs font-bold text-rose-400 active-scale"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>هەڵوەشاندنەوەی بەستەر</span>
                  </div>
                </button>

                {/* PIN Code Protection Option */}
                <div className="bg-black p-3 rounded-xl border border-[#2C2C2E] flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F7]">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span>پاراستن بە پین کۆد (ئیختیاری)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="پین کۆد بڕیار بدە..."
                      className="flex-1 bg-[#1C1C1E] text-xs text-[#F5F5F7] p-2.5 rounded-lg border border-[#3A3A3C] focus:outline-none"
                    />
                    <button
                      onClick={handleSavePin}
                      className="px-4 py-2 bg-[#2C2C2E] text-xs font-bold rounded-lg border border-[#3A3A3C] text-[#F5F5F7]"
                    >
                      پاشەکەوت
                    </button>
                  </div>
                  {pinMessage && (
                    <span className="text-[11px] text-[#34C759] font-semibold">{pinMessage}</span>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
