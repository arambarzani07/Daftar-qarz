import React from 'react';
import { RefreshCw, UserPlus, Lock, HelpCircle } from 'lucide-react';

interface TopActionBarProps {
  onRefresh: () => void;
  onAddCustomer: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onStartTour?: () => void;
  isRefreshing?: boolean;
  marketName?: string;
  canAddCustomer?: boolean;
}

export const TopActionBar: React.FC<TopActionBarProps> = ({
  onRefresh,
  onAddCustomer,
  onStartTour,
  isRefreshing = false,
  canAddCustomer = true
}) => {
  return (
    <header id="top-action-bar" className="w-full bg-black/60 px-4 py-2 sticky top-0 z-20 border-b border-[#2C2C2E]/30 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-between h-9">
        
        {/* Right Side Actions (RTL start) */}
        <div className="flex items-center gap-2">
          <button
            id="action-refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="نوێکردنەوە"
            className="p-1.5 rounded-xl hover:bg-[#1C1C1E] active:scale-95 transition-all text-[#8E8E93] hover:text-emerald-400"
            title="نوێکردنەوەی داتاکان"
          >
            <RefreshCw className={`w-4 h-4 stroke-[2] ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {onStartTour && (
            <button
              id="action-start-tour"
              onClick={onStartTour}
              aria-label="فێرکاری خێرا"
              className="p-1.5 rounded-xl hover:bg-[#1C1C1E] active:scale-95 transition-all text-[#8E8E93] hover:text-sky-400"
              title="فێرکاری و ڕێنمایی خێرا (Quick Tour)"
            >
              <HelpCircle className="w-4 h-4 stroke-[2]" />
            </button>
          )}

          <button
            id="action-add-customer"
            onClick={onAddCustomer}
            aria-label="زیادکردنی قەرزدار"
            className={`px-2 py-1 rounded-xl active:scale-95 transition-all flex items-center gap-1 text-xs font-bold ${
              canAddCustomer
                ? 'text-[#8E8E93] hover:text-emerald-400 hover:bg-[#1C1C1E]'
                : 'text-[#8E8E93]/40 hover:text-amber-500'
            }`}
            title={canAddCustomer ? "زیادکردنی قەرزداری نوێ" : "زیادکردنی کڕیار ڕێگەپێنەدراوە"}
          >
            {canAddCustomer ? (
              <UserPlus className="w-4 h-4 stroke-[2]" />
            ) : (
              <div className="relative">
                <UserPlus className="w-4 h-4 stroke-[2] opacity-50" />
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -bottom-1 -left-1" />
              </div>
            )}
            <span>زیادکردنی کڕیار</span>
          </button>
        </div>

      </div>
    </header>
  );
};



