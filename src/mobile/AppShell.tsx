import React from 'react';
import { useConnectivity } from '../lib/useConnectivity';
import { usePwaUpdate } from '../lib/usePwaUpdate';
import { OfflineBanner } from './OfflineBanner';
import { UpdateBanner } from './UpdateBanner';
import { InstallPrompt } from './InstallPrompt';
import { BottomNav, TabType } from './BottomNav';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  userRole?: string;
  marketName?: string;
  title?: string;
  subtitle?: string;
  showTopBar?: boolean;
  showBottomNav?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  pendingApprovalsCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab = 'dashboard',
  onTabChange,
  userRole,
  marketName,
  title,
  subtitle,
  showTopBar = true,
  showBottomNav = true,
  showBack = false,
  onBack,
  rightAction,
  pendingApprovalsCount = 0
}) => {
  const { status, checkConnectivity } = useConnectivity();
  const { hasUpdate, applyUpdate, dismissUpdate } = usePwaUpdate();

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-black text-[#F5F5F7] flex flex-col relative select-none font-sans antialiased overflow-x-hidden"
    >
      {/* Top Banners */}
      <OfflineBanner status={status} onRetry={checkConnectivity} />
      {hasUpdate && <UpdateBanner onApply={applyUpdate} onDismiss={dismissUpdate} />}

      {/* Top Bar */}
      {showTopBar && (
        <TopBar
          title={title}
          subtitle={subtitle}
          marketName={marketName}
          userRole={userRole}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction}
        />
      )}

      {/* Main Content Viewport */}
      <main className={`flex-1 flex flex-col w-full max-w-7xl mx-auto ${showBottomNav ? 'pb-24' : 'pb-6'}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && onTabChange && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          userRole={userRole}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
};
