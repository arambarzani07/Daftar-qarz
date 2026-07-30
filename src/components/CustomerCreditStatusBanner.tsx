import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, CheckCircle2, AlertTriangle, Unlock, ArrowUpRight, Percent } from 'lucide-react';
import { Customer } from '../types';
import { authenticatedFetch } from '../utils/apiClient';
import { formatMoney } from '../utils/formatters';

interface CustomerCreditStatusBannerProps {
  customer: Customer;
  marketId: string;
  onOpenAdvancedProfile: () => void;
}

export const CustomerCreditStatusBanner: React.FC<CustomerCreditStatusBannerProps> = ({
  customer,
  marketId,
  onOpenAdvancedProfile
}) => {
  const [protectionData, setProtectionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProtection = async () => {
    try {
      const res = await authenticatedFetch(`/api/markets/${marketId}/customers/${customer.id}/protection`);
      const json = await res.json();
      if (json.status === 'success') {
        setProtectionData(json.data);
      }
    } catch (e) {
      console.error('Error fetching protection banner data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer?.id && marketId) {
      fetchProtection();
    }
  }, [customer?.id, marketId]);

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-2">
        <div className="h-16 bg-[#1C1C1E] rounded-2xl animate-pulse border border-[#2C2C2E]" />
      </div>
    );
  }

  // Extract limits for IQD and USD
  const creditSettings = protectionData?.credit_settings || [];
  const iqdSetting = Array.isArray(creditSettings) 
    ? creditSettings.find((s: any) => s.currency === 'IQD') 
    : (creditSettings.currency === 'IQD' ? creditSettings : null);
  
  const usdSetting = Array.isArray(creditSettings) 
    ? creditSettings.find((s: any) => s.currency === 'USD') 
    : (creditSettings.currency === 'USD' ? creditSettings : null);

  const limitIqd = Number(iqdSetting?.limit_amount || 0);
  const limitUsd = Number(usdSetting?.limit_amount || 0);
  const limitModeIqd = iqdSetting?.limit_mode || 'NO_LIMIT';
  const limitModeUsd = usdSetting?.limit_mode || 'NO_LIMIT';

  const currentIqd = Number(customer.balance_iqd || 0);
  const currentUsd = Number(customer.balance_usd || 0);

  const lockStatus = protectionData?.lock_status || 'UNLOCKED';
  const isLocked = lockStatus === 'LOCKED' || lockStatus === 'debt_locked';
  const activeUnlock = protectionData?.active_unlock;

  // Calculate percentage used if limit > 0
  const iqdPercent = limitIqd > 0 ? Math.min(100, Math.round((currentIqd / limitIqd) * 100)) : 0;
  const usdPercent = limitUsd > 0 ? Math.min(100, Math.round((currentUsd / limitUsd) * 100)) : 0;

  const exceedsIqd = limitIqd > 0 && currentIqd > limitIqd;
  const exceedsUsd = limitUsd > 0 && currentUsd > limitUsd;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-2" dir="rtl">
      <div className={`p-3.5 rounded-2xl border transition-all ${
        isLocked 
          ? 'bg-red-500/10 border-red-500/30 text-red-200' 
          : exceedsIqd || exceedsUsd
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : 'bg-[#1C1C1E] border-[#2C2C2E] text-[#F5F5F7]'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isLocked ? (
              <div className="w-7 h-7 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
            ) : exceedsIqd || exceedsUsd ? (
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-xl bg-[#34C759]/20 text-[#34C759] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="text-xs font-black flex items-center gap-1.5">
                <span>سنووری قەرز و چاودێری</span>
                {isLocked && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-black text-[9px] font-extrabold">قفڵکراو</span>}
                {activeUnlock && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[9px] font-extrabold">کراوەی کاتی</span>}
              </div>
              <div className="text-[10px] text-[#8E8E93]">
                {limitIqd > 0 || limitUsd > 0 ? 'سنووری دیاریکراو چالاکە' : 'بێ سنووری فەرمی (No Limit)'}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAdvancedProfile}
            className="px-2.5 py-1 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] rounded-xl text-[10px] font-bold transition-all flex items-center gap-1"
          >
            <span>دەستکاری سنوور</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Limit Details Grid */}
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#2C2C2E]/60 text-[11px]">
          {/* IQD Limit */}
          <div className="bg-black/30 p-2 rounded-xl">
            <div className="flex justify-between items-center text-[10px] text-[#8E8E93] mb-0.5 font-bold">
              <span>IQD سنووری دینار</span>
              <span>{limitIqd > 0 ? `${iqdPercent}%` : 'بێ سنوور'}</span>
            </div>
            <div className="font-mono font-bold text-xs text-[#F5F5F7]">
              {limitIqd > 0 ? `${formatMoney(limitIqd, 'IQD')} د.ع` : 'بێ سنوور'}
            </div>
            {limitIqd > 0 && (
              <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${exceedsIqd ? 'bg-red-500' : iqdPercent > 80 ? 'bg-amber-500' : 'bg-[#34C759]'}`}
                  style={{ width: `${Math.min(100, iqdPercent)}%` }}
                />
              </div>
            )}
          </div>

          {/* USD Limit */}
          <div className="bg-black/30 p-2 rounded-xl">
            <div className="flex justify-between items-center text-[10px] text-[#8E8E93] mb-0.5 font-bold">
              <span>USD سنووری دۆلار</span>
              <span>{limitUsd > 0 ? `${usdPercent}%` : 'بێ سنوور'}</span>
            </div>
            <div className="font-mono font-bold text-xs text-[#F5F5F7]">
              {limitUsd > 0 ? `$${limitUsd.toLocaleString()}` : 'بێ سنوور'}
            </div>
            {limitUsd > 0 && (
              <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${exceedsUsd ? 'bg-red-500' : usdPercent > 80 ? 'bg-amber-500' : 'bg-[#34C759]'}`}
                  style={{ width: `${Math.min(100, usdPercent)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Exceeded or Lock warning message */}
        {(exceedsIqd || exceedsUsd || isLocked) && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-[10px] text-red-300 font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-400" />
            <span>
              {isLocked 
                ? 'ئاگاداری: قەرزی ئەم کڕیارە قفڵکراوە و مامەڵەی نوێ ڕێگری لێدەکرێت.' 
                : 'ئاگاداری: قەرزی ئەم کڕیارە تێپەڕی بەسەر سنووری دیاریکراودا!'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
