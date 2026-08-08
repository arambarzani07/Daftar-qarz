import React, { useState, useEffect } from 'react';
import { Customer, ShareLink } from '../types';
import { X, Copy, Share2, Send, Settings, RefreshCw, Trash2, Lock, Check, ShieldAlert, History, AlertCircle, CheckCircle2, Eye, EyeOff, Clock, Calendar } from 'lucide-react';
import { authenticatedFetch } from '../utils/apiClient';

interface ShareLinkSheetProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year} کات ${strHours}:${minutes}${ampm}`;
  } catch {
    return dateStr;
  }
};

export const ShareLinkSheet: React.FC<ShareLinkSheetProps> = ({
  isOpen,
  onClose,
  customer
}) => {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [historyLinks, setHistoryLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load active link & history on open
  useEffect(() => {
    if (!isOpen || !customer || !customer.id) {
      setIsManaging(false);
      setShowHistory(false);
      setCopied(false);
      setActionSuccessMessage(null);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const custId = encodeURIComponent(customer.id);
        const [resActive, resHist] = await Promise.all([
          authenticatedFetch(`/api/customers/${custId}/share-link`),
          authenticatedFetch(`/api/customers/${custId}/share-links/history`)
        ]);

        if (resActive.ok) {
          const jsonActive = await resActive.json();
          if (jsonActive.status === 'success') {
            setShareLink(jsonActive.data);
            setPinInput(jsonActive.data?.pin_code || '');
          }
        }

        if (resHist.ok) {
          const jsonHist = await resHist.json();
          if (jsonHist.status === 'success' && Array.isArray(jsonHist.data)) {
            setHistoryLinks(jsonHist.data);
          }
        }
      } catch (err) {
        console.error('Failed to load share link data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
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

    return 'https://zhirox.app';
  };

  const getAbsoluteShareUrl = () => {
    if (!shareLink || shareLink.status !== 'ACTIVE') return '';
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
    const msg = `سڵاو ${customer.name || ''}، لەم بەستەرە نوێیەوە دەتوانیت باڵانسی ڕاستەوخۆ و مامەڵەکانی هەژمارەکەت ببینیت. (بەستەرە کۆنەکە لەکارخراوە).`;
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
    const msg = `سڵاو ${customer.name || ''}،\nلەم بەستەرە نوێیەوە دەتوانیت باڵانسی ڕاستەوخۆی هەژمارەکەت و مامەڵەکانت ببینیت:\n\n${shareUrl}\n\n(تێبینی: بەستەرەکەی پێشوو لەکارخراوە و چیتر کار ناکات)`;
    
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

  // Deactivate old link and create new link
  const handleRegenerateLink = async () => {
    const confirmRegen = window.confirm('ئایا دڵنیایت لە لەکارخستنی بەستەری کۆن و دروستکردنی بەستەری نوێ؟ بەستەری پێشوو ئیتر کار ناکات.');
    if (!confirmRegen) return;

    setIsLoading(true);
    setActionSuccessMessage(null);
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
        setActionSuccessMessage(json.message || 'بەستەری کۆن لەکارخرا و بەستەری نوێ بە سەرکەوتوویی دروستکرا!');
        
        // Refresh history
        const resHist = await authenticatedFetch(`/api/customers/${custId}/share-links/history`);
        if (resHist.ok) {
          const jsonHist = await resHist.json();
          if (jsonHist.status === 'success' && Array.isArray(jsonHist.data)) {
            setHistoryLinks(jsonHist.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to regenerate link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Deactivate/Revoke link
  const handleRevokeLink = async () => {
    const confirmRevoke = window.confirm('ئایا دڵنیایت لە هەڵوەشاندنەوە و لەکارخستنی بەستەرەکە؟ کڕیار چیتر ناتوانێت هەژمارەکەی بەو بەستەرە ببينێت.');
    if (!confirmRevoke) return;

    setIsLoading(true);
    setActionSuccessMessage(null);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/share-link/revoke`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'success') {
        setShareLink(null);
        setIsManaging(false);
        setActionSuccessMessage(json.message || 'بەستەرەکە بە سەرکەوتوویی لەکارخرا');

        // Refresh history
        const resHist = await authenticatedFetch(`/api/customers/${custId}/share-links/history`);
        if (resHist.ok) {
          const jsonHist = await resHist.json();
          if (jsonHist.status === 'success' && Array.isArray(jsonHist.data)) {
            setHistoryLinks(jsonHist.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to revoke link:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePin = async () => {
    if (!shareLink) return;
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
        setPinMessage('پین کۆد بە سەرکەوتوویی پاشەکەوت کرا!');
        setTimeout(() => setPinMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save PIN:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const revokedLinks = historyLinks.filter(l => l.status === 'REVOKED');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
      {/* Background Overlay Click to Close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[32px] p-6 pb-safe animate-slide-up border-t border-[#2C2C2E] z-10 text-[#F5F5F7] max-h-[90vh] overflow-y-auto" dir="rtl">
        
        {/* Top bar with Close */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]/80 mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#34C759]" />
            <span className="font-extrabold text-base">بەستەری پۆرتالی کڕیار</span>
          </div>
          <button onClick={onClose} className="p-1 text-[#8E8E93] hover:text-[#F5F5F7]">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {actionSuccessMessage && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-[#8E8E93] text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <span>تکایە چاوەڕێ بکە...</span>
          </div>
        ) : !shareLink ? (
          <div className="py-6 text-center flex flex-col gap-4">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-rose-400 mb-1" />
              <p className="text-sm font-bold text-rose-300">
                هیچ بەستەرێکی چالاک نییە (بەستەرە کۆنەکە لەکارخراوە)
              </p>
              <p className="text-xs text-[#8E8E93]">
                تکایە بەستەری نوێ دروستبکە بۆ ئەوەی کڕیار بتوانێت باڵانسەکەی ببينێت.
              </p>
            </div>
            
            <button
              onClick={handleRegenerateLink}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-2xl active-scale transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>دروستکردنی بەستەری نوێ بۆ پۆرتالی کڕیار</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Customer & Link Status Card */}
            <div className="bg-black/60 p-4 rounded-2xl border border-[#2C2C2E] flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E93] font-bold">ناوی کڕیار:</span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-extrabold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>بەستەری نوێ چالاکە</span>
                </div>
              </div>

              <span className="font-extrabold text-sm text-[#F5F5F7]">{customer.name}</span>
              
              <div className="bg-[#1C1C1E] p-2.5 rounded-xl border border-[#2C2C2E] flex items-center justify-between gap-2">
                <span className="text-xs text-[#8E8E93] truncate dir-ltr text-right flex-1 font-mono">
                  {shareUrl}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>{shareLink.access_count || 0} بینین</span>
                </span>
              </div>

              {/* Customer Access / Last Opened Time Badge */}
              <div className="pt-2 border-t border-[#2C2C2E]/70 flex items-center justify-between text-xs">
                <span className="text-[#8E8E93] font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>دواین کاتی کردنەوەی بەستەر:</span>
                </span>
                {shareLink.last_accessed_at ? (
                  <span className="text-cyan-300 font-extrabold dir-ltr font-mono bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1">
                    <span>{formatDateTime(shareLink.last_accessed_at)}</span>
                  </span>
                ) : (
                  <span className="text-amber-400/90 font-bold text-[11px] flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-xl">
                    <EyeOff className="w-3 h-3" />
                    <span>تائێستا نەکراوەتەوە</span>
                  </span>
                )}
              </div>
            </div>

            {!isManaging && !showHistory ? (
              /* MAIN ACTIONS */
              <div className="flex flex-col gap-3">
                
                {/* Deactivate Old Link & Generate New Link (Primary Action) */}
                <button
                  onClick={handleRegenerateLink}
                  className="w-full p-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black rounded-2xl flex items-center justify-between font-extrabold text-xs active-scale transition-all shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4.5 h-4.5 stroke-[2.5]" />
                    <span>لە کارخستنی بەستەری کۆن و دروستکردنی بەستەری نوێ</span>
                  </div>
                  <span className="text-[10px] bg-black/20 px-2 py-1 rounded-lg">خێرا</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  
                  {/* Copy Link */}
                  <button
                    onClick={handleCopyLink}
                    className="p-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-bold text-xs active-scale transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#34C759]" /> : <Copy className="w-4 h-4 text-blue-400" />}
                    <span>{copied ? 'کۆپی کرا!' : 'کۆپی بەستەری نوێ'}</span>
                  </button>

                  {/* Native Share */}
                  <button
                    onClick={handleNativeShare}
                    className="p-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-bold text-xs active-scale transition-colors"
                  >
                    <Send className="w-4 h-4 text-cyan-400" />
                    <span>ناردنی راستەوخۆ</span>
                  </button>

                  {/* Share to WhatsApp */}
                  <button
                    onClick={handleWhatsAppShare}
                    className="col-span-2 p-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-xl flex items-center justify-center gap-2 border border-[#3A3A3C] font-extrabold text-xs text-[#34C759] active-scale transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-[#34C759]" />
                    <span>ناردنی بەستەری نوێ بۆ واتساپ</span>
                  </button>

                </div>

                {/* Secondary options: Settings & Deactivated History */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#2C2C2E]">
                  <button
                    onClick={() => setIsManaging(true)}
                    className="p-3 bg-black rounded-xl flex items-center justify-center gap-2 border border-[#2C2C2E] font-bold text-xs text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>ڕێکخستن و هەڵوەشاندنەوە</span>
                  </button>

                  <button
                    onClick={() => setShowHistory(true)}
                    className="p-3 bg-black rounded-xl flex items-center justify-center gap-2 border border-[#2C2C2E] font-bold text-xs text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
                  >
                    <History className="w-4 h-4 text-amber-400" />
                    <span>بەستەرە لەکارخراوەکان ({revokedLinks.length})</span>
                  </button>
                </div>

              </div>
            ) : showHistory ? (
              /* HISTORY SCREEN */
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
                  <span className="text-xs font-extrabold text-[#F5F5F7] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>مێژووی بەستەرە لەکارخراوەکان</span>
                  </span>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-xs text-blue-400 font-bold"
                  >
                    گەڕانەوە
                  </button>
                </div>

                {revokedLinks.length === 0 ? (
                  <div className="p-6 text-center text-[#8E8E93] text-xs">
                    هیچ بەستەرێکی کۆنی لەکارخراو تۆمار نەکراوە.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {revokedLinks.map((l) => (
                      <div key={l.id} className="p-3 bg-black/60 rounded-xl border border-rose-900/30 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">لەکارخراوە</span>
                          <span className="text-[#8E8E93] text-[10px] flex items-center gap-1 font-mono">
                            <Eye className="w-3 h-3 text-emerald-400" />
                            <span>{l.access_count || 0} بینین</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2C2C2E]/50">
                          <span className="text-[#8E8E93]">دواین کاتی کردنەوە:</span>
                          <span className="text-cyan-400 font-mono font-bold">
                            {l.last_accessed_at ? formatDateTime(l.last_accessed_at) : 'تائێستا نەکراوەتەوە'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* MANAGE & REVOKE SCREEN */
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
                  <span className="text-xs font-bold text-[#8E8E93]">بەڕێوەبردنی پۆرتال</span>
                  <button
                    onClick={() => setIsManaging(false)}
                    className="text-xs text-blue-400 font-bold"
                  >
                    گەڕانەوە
                  </button>
                </div>

                {/* Explicit Button 1: Deactivate Old & Recreate New */}
                <button
                  onClick={handleRegenerateLink}
                  className="w-full p-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-2xl border border-amber-500/40 flex items-center justify-between text-xs font-bold text-[#F5F5F7] active-scale"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>لە کارخستنی بەستەری کۆن و دروستکردنی نوێ</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold">کۆنەکە ڕادەگرێت</span>
                </button>

                {/* Explicit Button 2: Revoke / Deactivate current active link only */}
                <button
                  onClick={handleRevokeLink}
                  className="w-full p-3.5 bg-black hover:bg-rose-950/20 rounded-2xl border border-rose-900/40 flex items-center justify-between text-xs font-bold text-rose-400 active-scale"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>تەنها لەکارخستنی بەستەری ئێستا</span>
                  </div>
                  <span className="text-[10px] text-rose-400/80">ڕاگرتنی پۆرتال</span>
                </button>

                {/* PIN Code Protection Option */}
                <div className="bg-black p-3.5 rounded-2xl border border-[#2C2C2E] flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F7]">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span>پاراستنی بەستەر بە پین کۆد (ئیختیاری)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="پین کۆدی ٤-٦ ژمارەیی..."
                      className="flex-1 bg-[#1C1C1E] text-xs text-[#F5F5F7] p-2.5 rounded-xl border border-[#3A3A3C] focus:outline-none focus:border-purple-400"
                    />
                    <button
                      onClick={handleSavePin}
                      className="px-4 py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold rounded-xl border border-[#3A3A3C] text-[#F5F5F7]"
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

