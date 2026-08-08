import React from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

interface UpdateBannerProps {
  onApply: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onApply, onDismiss }) => {
  return (
    <div
      dir="rtl"
      className="w-full bg-emerald-950/90 text-emerald-100 border-b border-emerald-800/60 px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3 shadow-lg shrink-0"
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Download className="w-3.5 h-3.5" />
        </div>
        <span>وەشانی نوێی ژیرۆکس بەردەستە</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onApply}
          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-extrabold flex items-center gap-1 active:scale-95 transition-transform shadow"
        >
          <RefreshCw className="w-3 h-3" />
          <span>نوێکردنەوە</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 text-emerald-300 rounded-lg transition-colors"
          title="دواتر"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
