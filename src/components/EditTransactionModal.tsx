import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { X, Edit3, Save, Trash2, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSave: (txId: string, updatedData: { amount: number; currency: 'IQD' | 'USD'; type: 'DEBT_ADD' | 'PAYMENT_RECEIVE'; note: string }) => Promise<void>;
  onReverse?: (tx: Transaction) => Promise<void>;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSave,
  onReverse
}) => {
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [type, setType] = useState<'DEBT_ADD' | 'PAYMENT_RECEIVE'>('DEBT_ADD');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setCurrency(transaction.currency);
      setType(transaction.type);
      setNote(transaction.note || '');
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('تکایە بڕی پارەیەکی دروست بنووسە');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(transaction.id, {
        amount: numAmount,
        currency,
        type,
        note: note.trim()
      });
      onClose();
    } catch {
      setError('دەستکاریی مامەڵەکە سەرکەوتوو نەبوو');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReverseClick = async () => {
    if (!onReverse) return;
    if (confirm('ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم مامەڵەیە؟')) {
      setIsSubmitting(true);
      try {
        await onReverse(transaction);
        onClose();
      } catch {
        setError('هەڵوەشاندنەوە سەرکەوتوو نەبوو');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-[#F5F5F7]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#F5F5F7]">دەستکاریی مامەڵە</h3>
              <p className="text-xs text-[#8E8E93]">گۆڕینی بڕ، دراو، تێبینی یان جۆری مامەڵە</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-[#2C2C2E] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Transaction Type Picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1">جۆری مامەڵە</label>
            <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-2xl border border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setType('DEBT_ADD')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'DEBT_ADD'
                    ? 'bg-[#2C2C2E] text-rose-400 shadow-sm border border-rose-500/30'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>پێدانی قەرز (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('PAYMENT_RECEIVE')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'PAYMENT_RECEIVE'
                    ? 'bg-[#2C2C2E] text-emerald-400 shadow-sm border border-emerald-500/30'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>وەرگرتنەوەی پارە (-)</span>
              </button>
            </div>
          </div>

          {/* Amount & Currency Row */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1">بڕی پارە و دراو *</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-1 bg-black p-1 rounded-2xl border border-[#2C2C2E] order-2 sm:order-1">
                <button
                  type="button"
                  onClick={() => setCurrency('IQD')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    currency === 'IQD'
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  IQD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    currency === 'USD'
                      ? 'bg-emerald-500 text-black shadow-xs'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  $ USD
                </button>
              </div>

              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="flex-1 bg-black text-[#F5F5F7] text-lg font-black p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 dir-ltr text-right order-1 sm:order-2"
                required
              />
            </div>
          </div>

          {/* Note / Item details */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1">تێبینی / ئایتمەکان</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="تێبینی، کالا، یان هۆکاری مامەڵە بنووسە..."
              rows={3}
              className="w-full bg-black text-[#F5F5F7] text-xs p-3 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 dir-rtl font-medium resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>پاشەکەوتکردنی گۆڕانکارییەکان</span>
            </button>

            {onReverse && (
              <button
                type="button"
                onClick={handleReverseClick}
                disabled={isSubmitting}
                className="py-3.5 px-4 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs rounded-2xl flex items-center gap-1.5 border border-rose-800/50 transition-all active:scale-95 disabled:opacity-50"
                title="هەڵوەشاندنەوە"
              >
                <Trash2 className="w-4 h-4" />
                <span>هەڵوەشاندنەوە</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
