import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Lock, Unlock, RefreshCw, CheckCircle2, Sliders, DollarSign, Clock } from 'lucide-react';
import { MarketProtectionPolicy, ProtectionAlert } from '../types';

interface ProtectionScreenProps {
  marketId: string;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefreshNeeded?: () => void;
}

export const ProtectionScreen: React.FC<ProtectionScreenProps> = ({
  marketId,
  apiFetch,
  onRefreshNeeded
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ALERTS' | 'POLICY'>('OVERVIEW');
  const [overview, setOverview] = useState<{
    pending_approvals_count: number;
    locked_customers_count: number;
    temporary_unlocked_count: number;
    credit_exceeded_count: number;
    open_alerts_count: number;
  }>({
    pending_approvals_count: 0,
    locked_customers_count: 0,
    temporary_unlocked_count: 0,
    credit_exceeded_count: 0,
    open_alerts_count: 0
  });

  const [alerts, setAlerts] = useState<ProtectionAlert[]>([]);
  const [policy, setPolicy] = useState<MarketProtectionPolicy>({
    market_id: marketId,
    high_value_iqd_threshold: 1000000,
    high_value_usd_threshold: 1000,
    require_approval_for_reversals: true,
    require_approval_for_credit_limit_change: true,
    max_temp_unlock_hours: 24,
    updated_at: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!marketId) return;
    setIsLoading(true);
    try {
      // 1. Overview
      const ovRes = await apiFetch(`/api/markets/${marketId}/protection/overview`);
      if (ovRes.ok) {
        const ovJson = await ovRes.json();
        if (ovJson.status === 'success' && ovJson.data) {
          setOverview(ovJson.data);
        }
      }

      // 2. Alerts
      const alRes = await apiFetch(`/api/markets/${marketId}/protection/alerts`);
      if (alRes.ok) {
        const alJson = await alRes.json();
        if (alJson.status === 'success' && Array.isArray(alJson.data)) {
          setAlerts(alJson.data);
        }
      }

      // 3. Policy
      const polRes = await apiFetch(`/api/markets/${marketId}/protection/policy`);
      if (polRes.ok) {
        const polJson = await polRes.json();
        if (polJson.status === 'success' && polJson.data) {
          setPolicy(polJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to load protection data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [marketId, apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolveAlert = async (alertId: string) => {
    setResolvingAlertId(alertId);
    try {
      const res = await apiFetch(`/api/markets/${marketId}/protection/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('ئاگادارییەکە چارەسەرکرا');
        await loadData();
        if (onRefreshNeeded) onRefreshNeeded();
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setResolvingAlertId(null);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicy(true);
    try {
      const res = await apiFetch(`/api/markets/${marketId}/protection/policy`, {
        method: 'POST',
        body: JSON.stringify(policy)
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('یاساکانی ئاسایش بەسەرکەوتوویی نوێکرانەوە');
        await loadData();
        if (onRefreshNeeded) onRefreshNeeded();
      } else {
        alert(json.message || 'هەڵەیەک ڕوویدا');
      }
    } catch (err) {
      console.error('Failed to save protection policy:', err);
      alert('پەیوەندی سەرنەکەوت');
    } finally {
      setIsSavingPolicy(false);
    }
  };

  return (
    <div dir="rtl" className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full">
      {/* Top Title */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1C1C1E]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#F5F5F7]">سەنتەری پاراستن و ئاسایش</h1>
            <p className="text-xs text-[#8E8E93]">چاودێری سەرمایە و بەرگری لە زیانی دارایی</p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#1C1C1E] text-[#8E8E93] hover:text-white transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Security Status Banner */}
      <div className="mb-4 bg-gradient-to-r from-emerald-950/40 via-[#1C1C1E] to-[#1C1C1E] border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div>
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block">
              دۆخی سیستەم: پارێزراوە
            </span>
            <span className="text-[11px] text-[#8E8E93]">
              سیستەمی رێگریکردن لە زیانی دارایی ژیرۆکس چالاکە
            </span>
          </div>
        </div>
        <ShieldCheck className="w-6 h-6 text-emerald-400 opacity-80" />
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8E8E93] font-medium">ئاگاداری کراوە</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-lg font-extrabold text-white mt-2">{overview.open_alerts_count}</p>
        </div>

        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8E8E93] font-medium">کڕیارانی بەستراو</span>
            <Lock className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-lg font-extrabold text-white mt-2">{overview.locked_customers_count}</p>
        </div>

        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8E8E93] font-medium">کردنەوەی کاتی</span>
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-extrabold text-white mt-2">{overview.temporary_unlocked_count}</p>
        </div>

        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#8E8E93] font-medium">چاوەڕوانی پەسەندکردن</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-lg font-extrabold text-white mt-2">{overview.pending_approvals_count}</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex bg-[#1C1C1E] p-1 rounded-xl mb-4 border border-[#2C2C2E]">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'OVERVIEW' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
          }`}
        >
          گشتی
        </button>
        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
            activeTab === 'ALERTS' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
          }`}
        >
          ئاگادارییەکان ({alerts.length})
        </button>
        <button
          onClick={() => setActiveTab('POLICY')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'POLICY' ? 'bg-[#2C2C2E] text-white shadow' : 'text-[#8E8E93]'
          }`}
        >
          یاساکانی ئاسایش
        </button>
      </div>

      {/* Content depending on Active Tab */}
      {activeTab === 'OVERVIEW' && (
        <div className="flex flex-col gap-3">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4">
            <h3 className="text-xs font-bold text-[#8E8E93] mb-3 uppercase tracking-wider">
              یاسا سه‌ره‌كییه‌کانی دڵنیایی
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs text-[#F5F5F7]">
              <li className="flex items-center justify-between border-b border-[#2C2C2E] pb-2">
                <span>بەرزترین ئاستی قەرز بۆ هەر کڕیارێک (دینار)</span>
                <span className="font-extrabold text-emerald-400 dir-ltr">
                  {policy.high_value_iqd_threshold.toLocaleString()} IQD
                </span>
              </li>
              <li className="flex items-center justify-between border-b border-[#2C2C2E] pb-2">
                <span>بەرزترین ئاستی قەرز بۆ هەر کڕیارێک (دۆلار)</span>
                <span className="font-extrabold text-emerald-400 dir-ltr">
                  ${policy.high_value_usd_threshold.toLocaleString()} USD
                </span>
              </li>
              <li className="flex items-center justify-between border-b border-[#2C2C2E] pb-2">
                <span>پێویستبوونی پەسەندکردن بۆ هەڵوەشاندنەوە</span>
                <span className={`font-bold ${policy.require_approval_for_reversals ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {policy.require_approval_for_reversals ? 'بەڵێ (پێویستە)' : 'نەخێر'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>ماوەی دیاریکراوی ڕێگەپێدانی کاتی</span>
                <span className="font-bold text-white dir-ltr">{policy.max_temp_unlock_hours} کاتژمێر</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'ALERTS' && (
        <div className="flex flex-col gap-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-[#1C1C1E]/40 border border-[#2C2C2E] rounded-2xl text-center p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400/60 mb-2" />
              <p className="text-xs font-bold text-[#F5F5F7]">هیچ ئاگادارییەکی ئاسایشی کێشەدار نییە</p>
            </div>
          ) : (
            alerts.map((al) => (
              <div
                key={al.id}
                className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">{al.title || 'ئاگاداری ئاسایش'}</span>
                  </div>
                  <span className="text-[10px] text-[#8E8E93]">{al.status}</span>
                </div>
                <p className="text-xs text-[#8E8E93]">{al.description}</p>

                {al.status === 'OPEN' && (
                  <button
                    onClick={() => handleResolveAlert(al.id)}
                    disabled={resolvingAlertId === al.id}
                    className="mt-1 self-end px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 active:scale-95 transition-all"
                  >
                    {resolvingAlertId === al.id ? 'چاککردن...' : 'چارەسەرکراوە'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'POLICY' && (
        <form onSubmit={handleSavePolicy} className="flex flex-col gap-4 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4">
          <h3 className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">
            دستکاریکردنی یاساکانی پاراستن
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#F5F5F7]">
              سەقفی دارایی هەستیار (دینار)
            </label>
            <input
              type="number"
              value={policy.high_value_iqd_threshold}
              onChange={(e) => setPolicy({ ...policy, high_value_iqd_threshold: Number(e.target.value) })}
              className="bg-[#000000] border border-[#2C2C2E] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 dir-ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#F5F5F7]">
              سەقفی دارایی هەستیار (دۆلار)
            </label>
            <input
              type="number"
              value={policy.high_value_usd_threshold}
              onChange={(e) => setPolicy({ ...policy, high_value_usd_threshold: Number(e.target.value) })}
              className="bg-[#000000] border border-[#2C2C2E] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 dir-ltr"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[#2C2C2E] pt-3">
            <span className="text-xs font-bold text-[#F5F5F7]">پێویستبوونی پەسەندکردنی هەڵوەشاندنەوە</span>
            <input
              type="checkbox"
              checked={policy.require_approval_for_reversals}
              onChange={(e) => setPolicy({ ...policy, require_approval_for_reversals: e.target.checked })}
              className="w-4 h-4 accent-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[#2C2C2E] pt-3">
            <span className="text-xs font-bold text-[#F5F5F7]">پێویستبوونی پەسەندکردنی گۆڕینی سەقف</span>
            <input
              type="checkbox"
              checked={policy.require_approval_for_credit_limit_change}
              onChange={(e) => setPolicy({ ...policy, require_approval_for_credit_limit_change: e.target.checked })}
              className="w-4 h-4 accent-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingPolicy}
            className="mt-2 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-extrabold hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
          >
            {isSavingPolicy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                پاشەکەوتکردنی یاساکان
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
