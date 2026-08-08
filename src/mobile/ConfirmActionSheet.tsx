import React from 'react';
import { AlertTriangle, Check, X, ShieldAlert, DollarSign } from 'lucide-react';
import { formatIQD, formatUSD } from '../utils/formatters';

interface ConfirmActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  customerName: string;
  amount: number;
  currency: 'IQD' | 'USD';
  actionType: 'ADD_DEBT' | 'RECEIVE_PAYMENT' | 'REVERSAL' | 'FORGIVENESS';
  isSubmitting?: boolean;
}

export const ConfirmActionSheet: React.FC<ConfirmActionSheetProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  customerName,
  amount,
  currency,
  actionType,
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  const getActionTheme = () => {
    switch (actionType) {
      case 'ADD_DEBT':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          badge: 'تۆمارکردنی قەرز',
          btnBg: 'bg-rose-600 hover:bg-rose-700 text-white'
        };
      case 'RECEIVE_PAYMENT':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          badge: 'وەرگرتنی وەسڵ/پارە',
          btnBg: 'bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold'
        };
      case 'REVERSAL':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          badge: 'گەڕاندنەوە/پاشگەزبوونەوە',
          btnBg: 'bg-amber-500 hover:bg-amber-600 text-black font-extrabold'
        };
      case 'FORGIVENESS':
        return {
          bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
          badge: 'بەخشینی قەرز',
          btnBg: 'bg-purple-600 hover:bg-purple-700 text-white font-extrabold'
        };
    }
  };

  const theme = getActionTheme();
  const formattedAmount = currency === 'IQD' ? formatIQD(amount) : formatUSD(amount);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#1C1C1E] border border-[#2C2C2E] rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-250">
        
        {/* Top Handle / Icon */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${theme.bg}`}>
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#F5F5F7]">{title}</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${theme.bg}`}>
            {theme.badge}
          </span>
        </div>

        {/* Details Card */}
        <div className="bg-black/60 p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#8E8E93] font-bold">کڕیار:</span>
            <span className="text-[#F5F5F7] font-extrabold text-sm">{customerName}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2E]/60">
            <span className="text-[#8E8E93] font-bold">بڕی دارایی:</span>
            <span className="text-emerald-400 font-extrabold text-base dir-ltr font-mono">
              {formattedAmount}
            </span>
          </div>
        </div>

        {/* Warning Note */}
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>ئەم کرداره ئەنجام دەدرێت و بە شێوەیەکی تێک نەچوو (Immutable) لە دەفتەری ژیرۆکسدا جێگیر دەبێت.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 py-3.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] rounded-2xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            پاشگەزبوونەوە
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className={`flex-1 py-3.5 rounded-2xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${theme.btnBg}`}
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'لە بەجێهێناندایە...' : 'دووپاتکردنەوە'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
