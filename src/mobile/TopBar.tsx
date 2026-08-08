import React from 'react';
import { ChevronRight, Store, Shield, User, Building2 } from 'lucide-react';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  marketName?: string;
  userRole?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  marketName,
  userRole,
  showBack,
  onBack,
  rightAction
}) => {
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'PLATFORM_OWNER':
        return 'خاوەنی سیستەم';
      case 'MARKET_MANAGER':
        return 'بەڕێوەبەر';
      case 'EMPLOYEE':
        return 'کارمەند';
      case 'CUSTOMER':
        return 'پۆرتالی کڕیار';
      default:
        return 'ژیرۆکس';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'PLATFORM_OWNER':
        return <Shield className="w-3.5 h-3.5 text-purple-400" />;
      case 'MARKET_MANAGER':
        return <Store className="w-3.5 h-3.5 text-emerald-400" />;
      case 'EMPLOYEE':
        return <Building2 className="w-3.5 h-3.5 text-blue-400" />;
      case 'CUSTOMER':
        return <User className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return null;
    }
  };

  const nameToDisplay = marketName || title || 'سوپەرمارکێت';

  return (
    <header
      dir="rtl"
      className="sticky top-0 z-40 w-full bg-[#000000]/90 backdrop-blur-xl border-b border-[#1C1C1E] px-4 py-3 flex items-center justify-between gap-3 shrink-0 pt-[calc(0.75rem+var(--safe-top,0px))] relative min-h-[52px]"
    >
      {/* Right Side (Back Button in RTL) */}
      <div className="flex items-center gap-2 z-10 shrink-0 min-w-[36px]">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="p-1.5 -mr-1.5 hover:bg-[#1C1C1E] text-[#F5F5F7] rounded-xl active:scale-95 transition-all"
            aria-label="گەڕانەوە"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center: Supermarket Name */}
      <div className="absolute inset-x-0 flex flex-col items-center justify-center text-center px-12 pointer-events-none">
        <div className="flex items-center justify-center gap-1.5 max-w-full">
          <Store className="w-4 h-4 text-emerald-400 shrink-0" />
          <h1 className="text-base font-black text-[#F5F5F7] truncate leading-tight tracking-tight">
            {nameToDisplay}
          </h1>
          {userRole && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] text-[10px] font-bold text-[#8E8E93]">
              {getRoleIcon(userRole)}
              <span>{getRoleLabel(userRole)}</span>
            </span>
          )}
        </div>
        {subtitle && subtitle !== nameToDisplay && (
          <p className="text-xs text-[#8E8E93] truncate font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {/* Left Side (Actions in RTL) */}
      <div className="flex items-center gap-2 z-10 shrink-0 min-w-[36px] justify-end">
        {rightAction}
      </div>
    </header>
  );
};
