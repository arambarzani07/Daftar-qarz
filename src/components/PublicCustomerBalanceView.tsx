import React, { useState, useEffect, useCallback } from 'react';
import { PublicCustomerBalance } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { RefreshCw, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

interface PublicCustomerBalanceViewProps {
  token: string;
}

export const PublicCustomerBalanceView: React.FC<PublicCustomerBalanceViewProps> = ({ token }) => {
  const [data, setData] = useState<PublicCustomerBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalance = useCallback(async (pin?: string) => {
    setIsRefreshing(true);
    try {
      let url = `/api/public/customer-balance/${token}`;
      if (pin) {
        url += `?pin=${encodeURIComponent(pin)}`;
      }
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'pin_required') {
        setPinRequired(true);
        if (pin) {
          setPinError('پین کۆدەکە هەڵەیە، تکایە دووبارە هەوڵبدەرەوە.');
        }
      } else if (json.status === 'success') {
        setData(json.data);
        setPinRequired(false);
        setErrorMsg(null);
        setPinError('');
      } else {
        setErrorMsg(json.message || 'ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.');
      }
    } catch (err) {
      console.error('Failed to fetch public customer balance:', err);
      setErrorMsg('ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBalance();

    // Auto refresh when browser tab becomes active
    const handleFocus = () => {
      fetchBalance(pinInput);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchBalance, pinInput]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setIsLoading(true);
    fetchBalance(pinInput.trim());
  };

  // 1. Loading State
  if (isLoading && !data && !pinRequired && !errorMsg) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#34C759] animate-spin" />
          <span className="text-sm font-semibold text-[#8E8E93]">تکایە چاوەڕێ بکە...</span>
        </div>
      </div>
    );
  }

  // 2. Error / Invalid / Revoked Link State
  if (errorMsg) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] flex flex-col items-center text-center gap-4 animate-scale-in">
          <div className="w-12 h-12 rounded-full bg-rose-900/30 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 stroke-[1.75]" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-base font-bold text-[#F5F5F7]">ژیرۆکس</h1>
            <p className="text-sm text-[#8E8E93] mt-2 font-medium">
              {errorMsg}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. PIN Prompt State
  if (pinRequired && !data) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6">
        <form
          onSubmit={handlePinSubmit}
          className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] flex flex-col gap-4 animate-scale-in"
        >
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center mb-1">
              <Lock className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h1 className="text-base font-bold text-[#F5F5F7]">لاپەڕەی پارێزراوی هەژمار</h1>
            <p className="text-xs text-[#8E8E93]">تکایە پین کۆد بنووسە بۆ بینیی باڵانسی هەژمارەکەت</p>
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="پین کۆد بنووسە..."
              className="w-full bg-black text-[#F5F5F7] text-center text-lg tracking-widest p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-purple-400"
            />
            {pinError && (
              <span className="text-xs text-rose-400 font-semibold text-center mt-1">{pinError}</span>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#2C2C2E] text-[#F5F5F7] border border-[#3A3A3C] font-bold text-sm rounded-xl active-scale"
          >
            دڵنیابوونەوە
          </button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  // 4. Valid Live Customer Balance View
  return (
    <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col pb-safe">
      
      {/* Top Header */}
      <header className="w-full bg-black pt-safe px-4 py-3 sticky top-0 z-20 border-b border-[#1C1C1E]">
        <div className="max-w-md mx-auto flex items-center justify-between h-11">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#8E8E93]">{data.market_name}</span>
            <h1 className="text-base font-bold text-[#F5F5F7]">{data.customer_name}</h1>
          </div>

          <button
            onClick={() => fetchBalance(pinInput)}
            disabled={isRefreshing}
            aria-label="نوێکردنەوە"
            className="text-[#F5F5F7] p-2 bg-[#1C1C1E] rounded-xl border border-[#2C2C2E] active:opacity-60 transition-opacity"
          >
            <RefreshCw className={`w-4 h-4 stroke-[1.75] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-4">
        
        {/* Live Total Balance Card */}
        <div className="bg-[#1C1C1E] rounded-2xl p-5 border border-[#2C2C2E] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#8E8E93]">کۆی قەرزی ئێستا</span>
            <span className="flex items-center gap-1 text-[10px] text-[#34C759] font-bold bg-[#34C759]/10 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              <span>باڵانسی ڕاستەوخۆ</span>
            </span>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            {/* IQD Balance */}
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-[#F5F5F7]">
                {data.balance_iqd === 0 && data.balance_usd === 0
                  ? '0 دینار'
                  : formatMoney(data.balance_iqd, 'IQD')}
              </span>
            </div>

            {/* USD Balance if present */}
            {data.balance_usd > 0 && (
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-[#34C759]">
                  {formatMoney(data.balance_usd, 'USD')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transaction History Timeline */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#8E8E93]">مێژووی مامەڵەکان</span>
            <span className="text-[10px] text-[#8E8E93]">({data.transactions.length} مامەڵە)</span>
          </div>

          {data.transactions.length === 0 ? (
            <div className="text-center py-12 bg-[#1C1C1E]/40 rounded-2xl border border-[#2C2C2E] text-[#8E8E93] text-xs font-medium">
              هێشتا هیچ مامەڵەیەک نییە.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.transactions.map((tx) => {
                const isDebt = tx.type === 'DEBT_ADD';
                return (
                  <div key={tx.id} className="w-full flex">
                    <div
                      className={`max-w-[78%] min-w-[65%] p-3.5 transition-all ${
                        isDebt
                          ? 'bg-[#1C1C1E] text-[#F5F5F7] ml-auto rounded-2xl rounded-br-xs'
                          : 'bg-[#A2A2A6] text-[#1C1C1E] mr-auto rounded-2xl rounded-bl-xs'
                      }`}
                    >
                      {/* Amount */}
                      <div className="text-base font-extrabold tracking-tight">
                        {isDebt ? '+ ' : '- '}
                        {formatMoney(tx.amount, tx.currency)}
                      </div>

                      {/* Divider */}
                      <div className={`w-full h-[1px] my-2 ${isDebt ? 'bg-[#3A3A3C]/50' : 'bg-[#636366]/30'}`} />

                      {/* Note */}
                      {tx.note && (
                        <div className="text-xs font-medium leading-relaxed mb-1 opacity-90">
                          {tx.note}
                        </div>
                      )}

                      {/* Timestamp & Operator Name */}
                      <div className={`text-[10px] mt-1.5 pt-1.5 border-t flex items-center justify-between gap-1 ${isDebt ? 'border-[#3A3A3C]/40 text-[#8E8E93]' : 'border-[#636366]/20 text-[#3A3A3C]'}`}>
                        <span className="font-bold">بەکارهێنەر: {tx.created_by || 'خاوەن کار'}</span>
                        <span className="dir-ltr tracking-wide">{formatTimestamp(tx.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Read-Only Footer Banner */}
        <div className="mt-6 text-center text-[11px] text-[#8E8E93]/70 py-4 border-t border-[#1C1C1E]">
          سیستەمی ژیرۆکس - لاپەڕەی پارێزراوی باڵانسی کڕیار
        </div>

      </main>
    </div>
  );
};
