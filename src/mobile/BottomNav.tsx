import React from 'react';
import { LayoutDashboard, Users, CheckSquare, ShieldCheck, Settings, Home, FileText, Calendar, Bell, User, Server } from 'lucide-react';

export type TabType = 'dashboard' | 'customers' | 'approvals' | 'protection' | 'settings' | 'control_plane' | 'statement' | 'promises' | 'notifications' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  userRole?: string;
  pendingApprovalsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  userRole,
  pendingApprovalsCount = 0
}) => {
  // Define persona specific tab configurations
  const renderPersonaTabs = () => {
    if (userRole === 'PLATFORM_OWNER') {
      return [
        { id: 'control_plane' as TabType, label: 'سیستەم', icon: Server },
        { id: 'customers' as TabType, label: 'کڕیاران', icon: Users },
        { id: 'settings' as TabType, label: 'ڕێکخستن', icon: Settings },
      ];
    }

    if (userRole === 'CUSTOMER') {
      return [
        { id: 'dashboard' as TabType, label: 'سەرەکی', icon: Home },
        { id: 'statement' as TabType, label: 'کەشف حیساب', icon: FileText },
        { id: 'promises' as TabType, label: 'بەڵێنەکان', icon: Calendar },
        { id: 'notifications' as TabType, label: 'ئاگاداری', icon: Bell },
        { id: 'profile' as TabType, label: 'پڕۆفایل', icon: User },
      ];
    }

    if (userRole === 'EMPLOYEE') {
      return [
        { id: 'dashboard' as TabType, label: 'سەرەکی', icon: LayoutDashboard },
        { id: 'customers' as TabType, label: 'کڕیاران', icon: Users },
        { id: 'settings' as TabType, label: 'ڕێکخستن', icon: Settings },
      ];
    }

    // Default: MARKET_MANAGER
    return [
      { id: 'dashboard' as TabType, label: 'داشبۆرد', icon: LayoutDashboard },
      { id: 'customers' as TabType, label: 'کڕیاران', icon: Users },
      { id: 'approvals' as TabType, label: 'پەسەندکردن', icon: CheckSquare, badge: pendingApprovalsCount },
      { id: 'protection' as TabType, label: 'پاراستن', icon: ShieldCheck },
      { id: 'settings' as TabType, label: 'ڕێکخستن', icon: Settings },
    ];
  };

  const tabs = renderPersonaTabs();

  return (
    <nav
      dir="rtl"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#000000]/95 backdrop-blur-2xl border-t border-[#1C1C1E] px-2 pb-[calc(0.5rem+var(--safe-bottom,0px))] pt-2 transition-all"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-emerald-400 font-extrabold'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7] font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-black animate-pulse">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight leading-none truncate max-w-[64px]">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
