import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { AlertTriangle, Clock, ShieldAlert, ChevronDown, ChevronUp, UserX, Phone, ExternalLink } from 'lucide-react';

interface AgingBucket {
  count: number;
  total_iqd: number;
  total_usd: number;
}

interface HighRiskCustomer {
  id: string;
  name: string;
  phone: string;
  balance_iqd: number;
  balance_usd: number;
  days_old: number;
  last_activity: string;
}

interface AgingData {
  under_30_days: AgingBucket;
  between_30_60_days: AgingBucket;
  over_60_days: AgingBucket;
  high_risk_customers: HighRiskCustomer[];
  total_debtors: number;
  total_debt_iqd: number;
  total_debt_usd: number;
}

interface DebtAgingCardProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const DebtAgingCard: React.FC<DebtAgingCardProps> = ({ onSelectCustomer }) => {
  const [agingData, setAgingData] = useState<AgingData | null>(null);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [isLoading, setIsLoading] = useState(false);
  const [showHighRiskList, setShowHighRiskList] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAgingData = async () => {
      setIsLoading(true);
      try {
        const res = await authenticatedFetch('/api/analytics/aging');
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.status === 'success' && json.data) {
          setAgingData(json.data);
        }
      } catch (err) {
        console.error('Failed to load aging data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAgingData();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full px-4 py-2">
        <div className="max-w-md mx-auto bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 text-center text-xs text-[#8E8E93]">
          بارکردنی شیكاری تەمەنی قەرزەکان...
        </div>
      </div>
    );
  }

  if (!agingData) return null;

  const totalAmount = currency === 'USD' ? agingData.total_debt_usd : agingData.total_debt_iqd;
  const under30Amount = currency === 'USD' ? agingData.under_30_days.total_usd : agingData.under_30_days.total_iqd;
  const between3060Amount = currency === 'USD' ? agingData.between_30_60_days.total_usd : agingData.between_30_60_days.total_iqd;
  const over60Amount = currency === 'USD' ? agingData.over_60_days.total_usd : agingData.over_60_days.total_iqd;

  const getPercent = (val: number) => {
    if (totalAmount <= 0) return 0;
    return Math.min(100, Math.round((val / totalAmount) * 100));
  };

  const pUnder30 = getPercent(under30Amount);
  const pBetween3060 = getPercent(between3060Amount);
  const pOver60 = getPercent(over60Amount);

  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-md mx-auto bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        
        {/* CARD HEADER */}
        <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#F5F5F7]">دابەشکردنی قەرزەکان بەپێی تەمەن</h3>
              <p className="text-[10px] text-[#8E8E93]">شیکاری ماوەی قەرزەکان و مەترسی فەوتان</p>
            </div>
          </div>

          {/* CURRENCY SELECTOR */}
          <div className="flex items-center bg-black p-0.5 rounded-xl border border-[#2C2C2E]">
            <button
              type="button"
              onClick={() => setCurrency('IQD')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                currency === 'IQD'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7]'
              }`}
            >
              دینار
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                currency === 'USD'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7]'
              }`}
            >
              دۆلار ($)
            </button>
          </div>
        </div>

        {/* COMBINED PROGRESS STACK BAR */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-[#8E8E93]">کۆی گشتی قەرزدارانی چالاک:</span>
            <span className="text-[#F5F5F7] font-black">{agingData.total_debtors} کڕیار</span>
          </div>
          
          <div className="w-full h-3.5 bg-black rounded-full overflow-hidden flex border border-[#2C2C2E]">
            <div
              style={{ width: `${pUnder30}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`کەمتر لە ٣٠ ڕۆژ: ${pUnder30}%`}
            />
            <div
              style={{ width: `${pBetween3060}%` }}
              className="bg-amber-500 h-full transition-all duration-500"
              title={`٣٠ - ٦٠ ڕۆژ: ${pBetween3060}%`}
            />
            <div
              style={{ width: `${pOver60}%` }}
              className="bg-rose-500 h-full transition-all duration-500"
              title={`سەروو ٦٠ ڕۆژ: ${pOver60}%`}
            />
          </div>
        </div>

        {/* BUCKETS GRID */}
        <div className="grid grid-cols-3 gap-2 text-right">
          
          {/* BUCKET 1: < 30 DAYS */}
          <div className="bg-[#252528] border border-emerald-500/20 p-2.5 rounded-xl flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {pUnder30}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8E8E93] block">کەمتر لە ٣٠ ڕۆژ</span>
              <span className="text-xs font-black text-[#F5F5F7] block tracking-tight">
                {formatMoney(under30Amount, currency)}
              </span>
              <span className="text-[9px] text-[#8E8E93] block">
                {agingData.under_30_days.count} کڕیار
              </span>
            </div>
          </div>

          {/* BUCKET 2: 30 - 60 DAYS */}
          <div className="bg-[#252528] border border-amber-500/20 p-2.5 rounded-xl flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {pBetween3060}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8E8E93] block">٣٠ - ٦٠ ڕۆژ</span>
              <span className="text-xs font-black text-amber-300 block tracking-tight">
                {formatMoney(between3060Amount, currency)}
              </span>
              <span className="text-[9px] text-[#8E8E93] block">
                {agingData.between_30_60_days.count} کڕیار
              </span>
            </div>
          </div>

          {/* BUCKET 3: > 60 DAYS (CRITICAL RISK) */}
          <div className="bg-[#252528] border border-rose-500/30 p-2.5 rounded-xl flex flex-col justify-between space-y-1 bg-rose-500/5">
            <div className="flex items-center justify-between">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                {pOver60}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-rose-300 block">سەروو ٦٠ ڕۆژ</span>
              <span className="text-xs font-black text-rose-400 block tracking-tight">
                {formatMoney(over60Amount, currency)}
              </span>
              <span className="text-[9px] text-[#8E8E93] block">
                {agingData.over_60_days.count} کڕیار
              </span>
            </div>
          </div>

        </div>

        {/* HIGH RISK WARNING BANNER & TOGGLE */}
        {agingData.over_60_days.count > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowHighRiskList(!showHighRiskList)}
              className="w-full bg-rose-950/40 border border-rose-800/40 hover:bg-rose-950/60 p-3 rounded-xl flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="text-right">
                  <span className="text-xs font-black text-rose-300 block">
                    مەترسی فەوتانی قەرز ({agingData.over_60_days.count} کڕیار)
                  </span>
                  <span className="text-[10px] text-rose-400/80 font-bold block">
                    قەرزی زۆر کۆن بەبێ جووڵەی زیاتر لە ٦٠ ڕۆژ
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-rose-400 font-bold">
                <span>{showHighRiskList ? 'شاردنەوە' : 'بینینی لیست'}</span>
                {showHighRiskList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* EXPANDABLE HIGH RISK CUSTOMER LIST */}
            {showHighRiskList && (
              <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto dir-rtl pr-1 animate-slide-down">
                {agingData.high_risk_customers.map((cust) => {
                  const custBalance = currency === 'USD' ? cust.balance_usd : cust.balance_iqd;
                  return (
                    <div
                      key={cust.id}
                      className="bg-[#252528] border border-[#3A3A3C] hover:border-rose-500/40 p-2.5 rounded-xl flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-black text-xs">
                          <UserX className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-[#F5F5F7] block leading-tight">
                            {cust.name}
                          </span>
                          <span className="text-[10px] text-rose-400 font-bold block">
                            بێ جووڵەیە لە {cust.days_old} ڕۆژ پێش ئێستا
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-left">
                          <span className="text-xs font-black text-rose-400 block">
                            {formatMoney(custBalance, currency)}
                          </span>
                          {cust.phone && (
                            <a
                              href={`tel:${cust.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-[#8E8E93] hover:text-emerald-400 flex items-center gap-0.5 justify-end"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>{cust.phone}</span>
                            </a>
                          )}
                        </div>

                        {onSelectCustomer && (
                          <button
                            type="button"
                            onClick={() => onSelectCustomer(cust.id)}
                            className="p-1.5 rounded-lg bg-[#3A3A3C] hover:bg-emerald-500 hover:text-black text-[#F5F5F7] transition-all"
                            title="کردنەوەی پڕۆفایل"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
