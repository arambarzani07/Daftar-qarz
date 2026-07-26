import React, { useState } from 'react';
import { SearchFilters } from '../types';
import { X, RotateCcw } from 'lucide-react';

interface SearchFiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApplyFilters: (newFilters: SearchFilters) => void;
}

export const SearchFiltersSheet: React.FC<SearchFiltersSheetProps> = ({
  isOpen,
  onClose,
  filters,
  onApplyFilters
}) => {
  const [txType, setTxType] = useState<'ALL' | 'DEBT_ADD' | 'PAYMENT_RECEIVE'>(filters.txType || 'ALL');
  const [currency, setCurrency] = useState<'ALL' | 'IQD' | 'USD'>(filters.currency || 'ALL');
  const [startDate, setStartDate] = useState(filters.startDate || '');
  const [endDate, setEndDate] = useState(filters.endDate || '');

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyFilters({
      txType,
      currency,
      startDate,
      endDate
    });
    onClose();
  };

  const handleReset = () => {
    setTxType('ALL');
    setCurrency('ALL');
    setStartDate('');
    setEndDate('');
    onApplyFilters({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[32px] p-5 pb-safe animate-slide-up border-t border-[#2C2C2E] z-10">
        
        <div className="w-12 h-1 bg-[#3A3A3C] rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2C2C2E]">
          <h3 className="text-base font-extrabold text-[#F5F5F7]">
            فلتەرەکانی بگەڕێ
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs text-[#8E8E93] hover:text-[#F5F5F7] flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاشگەزبوونەوە</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          
          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] mb-1.5">
              جۆری مامەڵە
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#000000] p-1 rounded-xl border border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setTxType('ALL')}
                className={`py-2 rounded-lg text-xs font-bold ${txType === 'ALL' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#8E8E93]'}`}
              >
                هەمووی
              </button>
              <button
                type="button"
                onClick={() => setTxType('DEBT_ADD')}
                className={`py-2 rounded-lg text-xs font-bold ${txType === 'DEBT_ADD' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#8E8E93]'}`}
              >
                قەرزی نوێ
              </button>
              <button
                type="button"
                onClick={() => setTxType('PAYMENT_RECEIVE')}
                className={`py-2 rounded-lg text-xs font-bold ${txType === 'PAYMENT_RECEIVE' ? 'bg-[#2C2C2E] text-[#34C759]' : 'text-[#8E8E93]'}`}
              >
                پارەی وەرگیراو
              </button>
            </div>
          </div>

          {/* Currency Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] mb-1.5">
              دراو
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-[#000000] p-1 rounded-xl border border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setCurrency('ALL')}
                className={`py-2 rounded-lg text-xs font-bold ${currency === 'ALL' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#8E8E93]'}`}
              >
                هەمووی
              </button>
              <button
                type="button"
                onClick={() => setCurrency('IQD')}
                className={`py-2 rounded-lg text-xs font-bold ${currency === 'IQD' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#8E8E93]'}`}
              >
                IQD دینار
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`py-2 rounded-lg text-xs font-bold ${currency === 'USD' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#8E8E93]'}`}
              >
                USD دۆلار
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] mb-1">
                لە بەرواری
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#000000] text-[#F5F5F7] text-xs p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8E8E93] mb-1">
                بۆ بەرواری
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#000000] text-[#F5F5F7] text-xs p-3 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759]"
              />
            </div>
          </div>

          <button
            onClick={handleApply}
            className="w-full mt-2 py-3.5 bg-[#34C759] active:bg-[#2EB14E] text-black font-extrabold text-sm rounded-xl transition-all active-scale"
          >
            بگەڕێ
          </button>

        </div>

      </div>
    </div>
  );
};
