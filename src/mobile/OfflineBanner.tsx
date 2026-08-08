import React, { useState } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, Database, CheckCircle2 } from 'lucide-react';
import { ConnectivityStatus } from '../lib/useConnectivity';
import { useOfflineQueue } from '../lib/useOfflineQueue';

interface OfflineBannerProps {
  status: ConnectivityStatus;
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ status, onRetry }) => {
  const { queuedCount, isSyncing, syncNow, lastSyncResult } = useOfflineQueue();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  const isOffline = status === 'OFFLINE';
  const isServerDown = status === 'SERVER_UNAVAILABLE';
  const isDegraded = status === 'DEGRADED';

  const handleSyncClick = async () => {
    const res = await syncNow();
    if (res && res.successCount > 0) {
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 4000);
    }
  };

  if (status === 'ONLINE' && queuedCount === 0 && !showSyncSuccess) return null;

  return (
    <div
      dir="rtl"
      className={`w-full px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-between gap-3 shadow-md border-b shrink-0 ${
        showSyncSuccess
          ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/50'
          : queuedCount > 0 && status === 'ONLINE'
          ? 'bg-sky-950/90 text-sky-200 border-sky-800/50'
          : isOffline
          ? 'bg-rose-950/90 text-rose-200 border-rose-800/50'
          : isServerDown
          ? 'bg-amber-950/90 text-amber-200 border-amber-800/50'
          : 'bg-yellow-950/80 text-yellow-200 border-yellow-800/40'
      }`}
    >
      <div className="flex items-center gap-2">
        {showSyncSuccess ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        ) : queuedCount > 0 && status === 'ONLINE' ? (
          <Database className="w-4 h-4 shrink-0 text-sky-400 animate-pulse" />
        ) : isOffline ? (
          <WifiOff className="w-4 h-4 shrink-0 text-rose-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
        )}
        <p className="leading-tight">
          {showSyncSuccess && `سەرکەوتووانە ${lastSyncResult?.successCount || 0} مامەڵەی ئۆفلاین هاوکاتکرانەوە!`}
          {!showSyncSuccess && queuedCount > 0 && (
            <span>
              <strong className="underline decoration-sky-400 underline-offset-2 ml-1">{queuedCount}</strong>
              {' مامەڵە لە دۆخی ئۆفلایندا پاشەکەوت کراون و لە ڕیزدان بۆ هاوکاتکردنەوە.'}
            </span>
          )}
          {!showSyncSuccess && queuedCount === 0 && isOffline && 'پەیوەندی ئینتەرنێت بەردەست نییە. مامەڵەکان لە ئۆفلایندا پاشەکەوت دەکرێن.'}
          {!showSyncSuccess && queuedCount === 0 && isServerDown && 'خزمەتگوزاریی داتابەیس بەردەست نییە. بەستەری ڕاستەوخۆ کارناکات.'}
          {!showSyncSuccess && queuedCount === 0 && isDegraded && 'پەیوەندی ئینتەرنێت هێواشە. هەندێک کرداری دارایی لەوانەیە خاو ببنەوە.'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {queuedCount > 0 && (
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="px-3 py-1 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-extrabold rounded-lg text-[11px] flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'لە هاوکاتکردنەوەدایە...' : 'هاوکاتکردنەوەی ئێستا (Sync Now)'}</span>
          </button>
        )}

        {queuedCount === 0 && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition-transform"
          >
            <RefreshCw className="w-3 h-3" />
            <span>تاقیکردنەوە</span>
          </button>
        )}
      </div>
    </div>
  );
};

