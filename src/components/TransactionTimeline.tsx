import React, { useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { 
  User, 
  Edit2, 
  PlusCircle, 
  CheckCircle, 
  History, 
  TrendingUp, 
  TrendingDown, 
  Tag, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface TransactionTimelineProps {
  transactions: Transaction[];
  onReverseTx?: (transaction: Transaction) => void;
  onEditTx?: (transaction: Transaction) => void;
  isLoading?: boolean;
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({
  transactions,
  onReverseTx,
  onEditTx,
  isLoading = false
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-[75%] h-24 bg-[#1C1C1E] rounded-2xl animate-pulse self-end" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8E8E93]">
        <div className="w-16 h-16 rounded-full bg-[#1C1C1E] flex items-center justify-center mb-4 border border-[#2C2C2E]/60">
          <HelpCircle className="w-8 h-8 text-[#8E8E93]/60" />
        </div>
        <p className="text-sm font-bold text-[#F5F5F7]">هیچ مامەڵەیەک تۆمار نەکراوە</p>
        <p className="text-xs text-[#8E8E93] mt-1">تۆمارەکانی قەرز و پارەدان لێرەدا دەردەکەون</p>
      </div>
    );
  }

  // Get Kurdish label, background colors and icon for each transaction type
  const getTxTypeConfig = (type: string, isReversed: boolean) => {
    if (isReversed) {
      return {
        label: 'هەڵوەشاوەتەوە',
        icon: <AlertCircle className="w-3 h-3 text-red-400" />,
        badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20'
      };
    }

    switch (type) {
      case 'DEBT_ADD':
        return {
          label: 'قەرزی نوێ',
          icon: <PlusCircle className="w-3 h-3 text-rose-400" />,
          badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
        };
      case 'OPENING_BALANCE':
        return {
          label: 'دەستپێکی حساب',
          icon: <History className="w-3 h-3 text-amber-400" />,
          badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
        };
      case 'ADJUSTMENT_DEBIT':
        return {
          label: 'ڕاستکردنەوە (+)',
          icon: <TrendingUp className="w-3 h-3 text-indigo-400" />,
          badgeClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
        };
      case 'PAYMENT_RECEIVE':
        return {
          label: 'وەرگرتنی پارە',
          icon: <CheckCircle className="w-3 h-3 text-emerald-400" />,
          badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
        };
      case 'FORGIVENESS':
        return {
          label: 'داشکان / بڕینەوە',
          icon: <Tag className="w-3 h-3 text-teal-400" />,
          badgeClass: 'bg-teal-500/10 text-teal-400 border border-teal-500/15'
        };
      case 'ADJUSTMENT_CREDIT':
        return {
          label: 'ڕاستکردنەوە (-)',
          icon: <TrendingDown className="w-3 h-3 text-cyan-400" />,
          badgeClass: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15'
        };
      default:
        return {
          label: 'مامەڵە',
          icon: <CheckCircle className="w-3 h-3 text-gray-400" />,
          badgeClass: 'bg-gray-500/10 text-gray-400 border border-gray-500/15'
        };
    }
  };

  return (
    <div id="transaction-timeline" className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full flex flex-col gap-3">
      {transactions.map((tx) => {
        // Debits (increases debt) are displayed on the right
        const isDebt = tx.type === 'DEBT_ADD' || tx.type === 'OPENING_BALANCE' || tx.type === 'ADJUSTMENT_DEBIT';
        const isReversed = tx.reversed;
        const typeConfig = getTxTypeConfig(tx.type, !!isReversed);

        return (
          <div
            key={tx.id}
            id={`tx-bubble-${tx.id}`}
            className="w-full flex"
          >
            {/* Bubble Container - Debt: Right, Payment: Left */}
            <div
              className={`max-w-[80%] min-w-[70%] p-3.5 rounded-2xl transition-all shadow-md flex flex-col ${
                isReversed
                  ? 'tx-bubble-reversed ml-auto rounded-br-xs'
                  : isDebt
                  ? 'tx-bubble-debt ml-auto rounded-br-xs'
                  : 'tx-bubble-payment mr-auto rounded-bl-xs'
              }`}
            >
              {/* 1. Badge Row & Edit Button */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${typeConfig.badgeClass}`}>
                  {typeConfig.icon}
                  <span>{typeConfig.label}</span>
                </div>

                {!isReversed && onEditTx && (
                  <button
                    onClick={() => onEditTx(tx)}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-extrabold ${
                      isDebt
                        ? 'text-[#8E8E93] hover:text-emerald-400 hover:bg-[#2C2C2E]'
                        : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-500/10'
                    }`}
                    title="دەستکاریی مامەڵە"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>دەستکاری</span>
                  </button>
                )}
              </div>

              {/* 2. Amount Area */}
              <div className="text-xl font-extrabold tracking-tight mb-2.5">
                <span className={isReversed ? 'line-through text-red-500/60' : isDebt ? 'text-[#F5F5F7]' : 'text-emerald-600 html.light-mode:text-[#065F46]'}>
                  {formatMoney(tx.amount, tx.currency)}
                </span>
              </div>

              {/* 3. Note / Item Text */}
              {tx.note && (
                <div className={`text-xs font-bold leading-relaxed mb-3 p-2 rounded-xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/5 ${isDebt ? 'text-[#F5F5F7]/90' : 'text-emerald-950 dark:text-emerald-200/90'}`}>
                  {tx.note}
                </div>
              )}

              {/* 4. Operator Name & Timestamp */}
              <div className={`text-[10px] mt-auto pt-2 border-t flex items-center justify-between gap-1.5 ${isReversed ? 'border-red-500/10 text-red-400/60' : isDebt ? 'border-[#3A3A3C]/40 text-[#8E8E93]' : 'border-emerald-500/10 text-emerald-800 dark:text-emerald-400/70'}`}>
                <span className="font-bold flex items-center gap-1 dir-rtl truncate max-w-[120px]">
                  <User className="w-3 h-3 opacity-80 shrink-0" />
                  <span className="truncate">بەکارهێنەر: <strong className={isReversed ? 'text-red-400' : isDebt ? 'text-[#F5F5F7]' : 'text-emerald-900 dark:text-emerald-300'}>{tx.created_by || 'system'}</strong></span>
                </span>
                <span className="dir-ltr tracking-wide font-medium text-[9.5px] opacity-90 shrink-0">{formatTimestamp(tx.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
};

