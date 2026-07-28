import React from 'react';
import { RefreshCw, UserPlus, Search, Settings, Store, Lock } from 'lucide-react';

interface TopActionBarProps {
  onRefresh: () => void;
  onAddCustomer: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  isRefreshing?: boolean;
  marketName?: string;
  canAddCustomer?: boolean;
}

export const TopActionBar: React.FC<TopActionBarProps> = ({
  onRefresh,
  onAddCustomer,
  onOpenSearch,
  onOpenSettings,
  isRefreshing = false,
  marketName,
  canAddCustomer = true
}) => {
  const displayName = marketName?.trim() || 'سوپەرمارکێت';

  return (
    <header id="top-action-bar" className="w-full bg-black pt-safe px-4 py-2 sticky top-0 z-20 border-b border-[#2C2C2E]/50 backdrop-blur-md bg-black/90">
      <div className="max-w-md mx-auto flex items-center justify-between h-11">
        
        {/* Right Side Actions (RTL start) */}
        <div className="flex items-center gap-2">
          <button
            id="action-refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="نوێکردنەوە"
            className="text-[#F5F5F7] p-1.5 rounded-xl hover:bg-[#1C1C1E] active:scale-95 transition-all text-[#8E8E93] hover:text-emerald-400"
            title="نوێکردنەوەی داتاکان"
          >
            <RefreshCw className={`w-5 h-5 stroke-[2] ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            id="action-add-customer"
            onClick={onAddCustomer}
            aria-label="زیادکردنی قەرزدار"
            className={`p-1.5 rounded-xl active:scale-95 transition-all flex items-center gap-1 ${
              canAddCustomer
                ? 'text-[#8E8E93] hover:text-emerald-400 hover:bg-[#1C1C1E]'
                : 'text-[#8E8E93]/40 hover:text-amber-500'
            }`}
            title={canAddCustomer ? "زیادکردنی قەرزداری نوێ" : "زیادکردنی کڕیار ڕێگەپێنەدراوە"}
          >
            {canAddCustomer ? (
              <UserPlus className="w-5 h-5 stroke-[2]" />
            ) : (
              <div className="relative">
                <UserPlus className="w-5 h-5 stroke-[2] opacity-50" />
                <Lock className="w-3 h-3 text-amber-500 absolute -bottom-1 -left-1" />
              </div>
            )}
          </button>
        </div>

        {/* Center: Supermarket Name Display */}
        <div
          id="supermarket-title-badge"
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl shadow-sm max-w-[200px] hover:border-emerald-500/40 transition-colors"
          title={`ناوی مارکێت: ${displayName}`}
        >
          <Store className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black text-[#F5F5F7] truncate tracking-tight dir-rtl">
            {displayName}
          </span>
        </div>

        {/* Left Side Actions (RTL end) */}
        <div className="flex items-center gap-2">
          <button
            id="action-search"
            onClick={onOpenSearch}
            aria-label="گەڕان"
            className="text-[#F5F5F7] p-1.5 rounded-xl hover:bg-[#1C1C1E] active:scale-95 transition-all text-[#8E8E93] hover:text-emerald-400"
            title="گەڕانی خێرا"
          >
            <Search className="w-5 h-5 stroke-[2]" />
          </button>

          <button
            id="action-settings"
            onClick={onOpenSettings}
            aria-label="ڕێکخستنەکان"
            className="text-[#F5F5F7] p-1.5 rounded-xl hover:bg-[#1C1C1E] active:scale-95 transition-all text-[#8E8E93] hover:text-emerald-400"
            title="ڕێکخستنی سیستەم"
          >
            <Settings className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

      </div>
    </header>
  );
};

