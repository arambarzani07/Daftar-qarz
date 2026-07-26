import React, { useState, useEffect } from 'react';
import { formatMoney } from '../utils/formatters';
import { Users, TrendingUp, Wallet, ChevronDown, ChevronUp, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface AnalyticsDay {
  date: string;
  displayDate: string;
  addedIqd: number;
  paidIqd: number;
  addedUsd: number;
  paidUsd: number;
  netIqd: number;
  netUsd: number;
}

interface FinancialSummaryCardProps {
  totalIqd: number;
  totalUsd: number;
  customerCount: number;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  totalIqd,
  totalUsd,
  customerCount
}) => {
  const [showTrendChart, setShowTrendChart] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDay[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      setIsLoadingChart(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
        const activeCtxStr = typeof window !== 'undefined' ? localStorage.getItem('zhirox_active_context') : null;
        let marketId = 'zhirox-market-erbil';
        if (activeCtxStr) {
          try {
            const parsed = JSON.parse(activeCtxStr);
            marketId = parsed.tenant_id || parsed.market_id || marketId;
          } catch (e) {}
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (marketId && marketId !== 'SYSTEM_GLOBAL') {
          headers['X-Market-ID'] = marketId;
        }

        let url = '/api/analytics/30days';
        try {
          if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
            url = `${window.location.origin}/api/analytics/30days`;
          }
        } catch (e) {}

        const res = await fetch(url, { headers });
        const text = await res.text();
        let json: any = {};
        try {
          json = JSON.parse(text);
        } catch (e) {}
        if (isMounted && json.status === 'success' && Array.isArray(json.data)) {
          setAnalyticsData(json.data);
        }
      } catch (err) {
        console.error('Failed to load 30-day analytics:', err);
      } finally {
        if (isMounted) setIsLoadingChart(false);
      }
    };

    fetchAnalytics();
    return () => { isMounted = false; };
  }, [totalIqd, totalUsd]);

  // Calculate 30-day totals for quick KPI chips
  const total30dAdded = analyticsData.reduce(
    (acc, d) => acc + (chartCurrency === 'USD' ? d.addedUsd : d.addedIqd),
    0
  );
  const total30dPaid = analyticsData.reduce(
    (acc, d) => acc + (chartCurrency === 'USD' ? d.paidUsd : d.paidIqd),
    0
  );

  const formattedChartData = analyticsData.map((d) => ({
    displayDate: d.displayDate,
    'پێدانی قەرز (+)': chartCurrency === 'USD' ? d.addedUsd : d.addedIqd,
    'وەرگرتنەوەی پارە (-)': chartCurrency === 'USD' ? d.paidUsd : d.paidIqd
  }));

  const formatShortNumber = (val: number) => {
    if (val === 0) return '0';
    if (chartCurrency === 'USD') {
      if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
      return `$${val}`;
    } else {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
      return `${val}`;
    }
  };

  return (
    <div id="financial-summary-card" className="w-full px-4 pt-2 pb-3">
      <div className="max-w-md mx-auto bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xl transition-all">
        
        {/* TOP META ROW */}
        <div className="flex items-center justify-between text-xs text-[#8E8E93] border-b border-[#2C2C2E] pb-2.5">
          <div className="flex items-center gap-1.5 font-extrabold text-[#F5F5F7]">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>پوختەی دارایی دەفتەر</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#2C2C2E] px-2.5 py-1 rounded-xl text-emerald-400 font-extrabold text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>{customerCount} قەرزدار</span>
          </div>
        </div>

        {/* ROW 1: لەقەرزدایە & TREND CHART TOGGLE */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-[#8E8E93] font-bold mb-0.5">کۆی گشتی لەقەرزدایە:</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 tracking-tight">
              {formatMoney(totalIqd, 'IQD')}
            </span>
            {totalUsd > 0 && (
              <span className="text-xs font-extrabold text-[#F5F5F7] mt-0.5">
                {formatMoney(totalUsd, 'USD')}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowTrendChart(!showTrendChart)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-sm active:scale-95 ${
              showTrendChart
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] border-[#3A3A3C]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>ئاراستەی 30 ڕۆژ</span>
            {showTrendChart ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* EXPANDABLE RECHARTS DEBT TREND ANALYSIS SECTION */}
        {showTrendChart && (
          <div className="pt-3 border-t border-[#2C2C2E] space-y-3 animate-slide-down">
            {/* Header & Currency Switch */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-extrabold text-[#F5F5F7]">شیكاری قەرز و وەرگرتنەوە (30 ڕۆژ)</span>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center bg-black p-0.5 rounded-xl border border-[#2C2C2E]">
                <button
                  type="button"
                  onClick={() => setChartCurrency('IQD')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                    chartCurrency === 'IQD'
                      ? 'bg-emerald-500 text-black'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  IQD
                </button>
                <button
                  type="button"
                  onClick={() => setChartCurrency('USD')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                    chartCurrency === 'USD'
                      ? 'bg-emerald-500 text-black'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>

            {/* 30-Day Aggregated KPI Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#252528] p-2.5 rounded-xl border border-rose-500/20 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#8E8E93] font-bold">زیادکراو (+)</div>
                  <div className="text-xs font-black text-rose-400 dir-ltr">
                    {formatMoney(total30dAdded, chartCurrency)}
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-rose-400 shrink-0" />
              </div>

              <div className="bg-[#252528] p-2.5 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#8E8E93] font-bold">وەرگیراوە (-)</div>
                  <div className="text-xs font-black text-emerald-400 dir-ltr">
                    {formatMoney(total30dPaid, chartCurrency)}
                  </div>
                </div>
                <ArrowDownRight className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            </div>

            {/* Recharts Area Chart Visualization */}
            <div className="h-44 w-full pt-1">
              {isLoadingChart ? (
                <div className="h-full flex items-center justify-center text-xs text-[#8E8E93]">
                  بارکردنی نەخشەی دارایی...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDebtAdd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorPayment" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#8E8E93" fontSize={9} tickLine={false} />
                    <YAxis
                      stroke="#8E8E93"
                      fontSize={9}
                      tickLine={false}
                      tickFormatter={formatShortNumber}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1C1C1E',
                        borderColor: '#3A3A3C',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#F5F5F7',
                        direction: 'rtl'
                      }}
                      formatter={(val: any) => [formatMoney(Number(val) || 0, chartCurrency), '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="پێدانی قەرز (+)"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDebtAdd)"
                    />
                    <Area
                      type="monotone"
                      dataKey="وەرگرتنەوەی پارە (-)"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPayment)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-[#8E8E93] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>پێدانی قەرز (تۆمارکردن)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>وەرگرتنەوەی پارە</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


