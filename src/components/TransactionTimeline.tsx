import React, { useEffect, useRef } from 'react';
import { Transaction } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { User, Edit2 } from 'lucide-react';

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
          <div key={i} className="w-[70%] h-20 bg-[#1C1C1E] rounded-2xl animate-pulse self-end" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8E8E93]">
        <p className="text-sm font-medium">هیچ مامەڵەیەک تۆمار نەکراوە</p>
      </div>
    );
  }

  return (
    <div id="transaction-timeline" className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full flex flex-col gap-3">
      {transactions.map((tx) => {
        const isDebt = tx.type === 'DEBT_ADD';
        const isReversed = tx.reversed;

        return (
          <div
            key={tx.id}
            id={`tx-bubble-${tx.id}`}
            className="w-full flex"
          >
            {/* Bubble Container - Debt: Dark Right, Payment: Neutral Light Gray Left */}
            <div
              className={`max-w-[75%] min-w-[65%] p-3.5 transition-all ${
                isReversed
                  ? 'bg-[#1C1C1E]/40 border border-red-900/30 opacity-50 text-[#F5F5F7] ml-auto rounded-2xl rounded-br-xs'
                  : isDebt
                  ? 'bg-[#1C1C1E] text-[#F5F5F7] ml-auto rounded-2xl rounded-br-xs'
                  : 'bg-[#A2A2A6] text-[#1C1C1E] mr-auto rounded-2xl rounded-bl-xs'
              }`}
            >
              {/* 1. Amount & Edit Button */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-extrabold tracking-tight">
                  <span className={isReversed ? 'line-through text-red-400/80' : isDebt ? 'text-[#F5F5F7]' : 'text-[#1C1C1E]'}>
                    {formatMoney(tx.amount, tx.currency)}
                  </span>
                </div>

                {!isReversed && onEditTx && (
                  <button
                    onClick={() => onEditTx(tx)}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold ${
                      isDebt
                        ? 'text-[#8E8E93] hover:text-emerald-400 hover:bg-[#2C2C2E]'
                        : 'text-[#3A3A3C] hover:text-emerald-900 hover:bg-[#8E8E93]/40'
                    }`}
                    title="دەستکاریی مامەڵە"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>دەستکاری</span>
                  </button>
                )}
              </div>

              {/* 2. Thin Divider */}
              <div className={`w-full h-[1px] my-2 ${isDebt ? 'bg-[#3A3A3C]/50' : 'bg-[#636366]/30'}`} />

              {/* 3. Note / Item Text */}
              {tx.note && (
                <div className={`text-xs font-medium mb-1.5 leading-snug ${isDebt ? 'text-[#F5F5F7]/90' : 'text-[#1C1C1E]/90'}`}>
                  {tx.note}
                </div>
              )}

              {/* 4. Operator Name & Timestamp */}
              <div className={`text-[10px] mt-1.5 pt-1.5 border-t flex items-center justify-between gap-1.5 ${isDebt ? 'border-[#3A3A3C]/40 text-[#8E8E93]' : 'border-[#636366]/20 text-[#3A3A3C]'}`}>
                <span className="font-bold flex items-center gap-1 dir-rtl">
                  <User className="w-3 h-3 opacity-80 shrink-0" />
                  <span>بەکارهێنەر: <strong className={isDebt ? 'text-[#F5F5F7]' : 'text-black'}>{tx.created_by || 'خاوەن کار'}</strong></span>
                </span>
                <span className="dir-ltr tracking-wide font-medium text-[9.5px] opacity-90">{formatTimestamp(tx.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
};
