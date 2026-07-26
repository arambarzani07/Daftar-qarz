import React, { useState } from 'react';
import { CurrencyType } from '../types';
import { formatMoney } from '../utils/formatters';
import { ChevronUp, ChevronDown, PlusCircle, ArrowDownCircle, Tag, Sparkles, Check, DollarSign } from 'lucide-react';

interface TransactionComposerProps {
  balanceIqd: number;
  balanceUsd: number;
  customerCurrency: CurrencyType;
  onAddTransaction: (
    type: 'DEBT_ADD' | 'PAYMENT_RECEIVE',
    amount: number,
    currency: CurrencyType,
    note: string
  ) => Promise<void>;
  isSubmitting?: boolean;
}

const IQD_PRESETS = [5000, 10000, 25000, 50000, 100000];
const USD_PRESETS = [5, 10, 20, 50, 100];
const QUICK_TAGS = [
  '🛒 سوپەرمارکێت',
  '🍞 نان و خۆراک',
  '🥩 گۆشت و مریشک',
  '🍏 میوە و سەوزە',
  '💳 کارتی مۆبایل',
  '📦 وەسڵی نوێ'
];

export const TransactionComposer: React.FC<TransactionComposerProps> = ({
  balanceIqd,
  balanceUsd,
  customerCurrency,
  onAddTransaction,
  isSubmitting = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('IQD');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiText, setAiText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  const handleAiParse = async () => {
    if (!aiText.trim()) {
      setErrorMessage('تکایە دەقێک بنووسە بۆ شیکارکردن');
      return;
    }
    setErrorMessage('');
    setAiSuccessMessage('');
    setIsAiParsing(true);

    try {
      const res = await fetch('/api/gemini/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText })
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const parsed = data.data;
        if (parsed.amount) {
          setAmount(parsed.amount.toLocaleString('en-US'));
        }
        if (parsed.currency) {
          setCurrency(parsed.currency);
        }
        if (parsed.note) {
          setNote(parsed.note);
        }
        setAiSuccessMessage('ژیری دەستکرد: زانیارییەکان بە سەرکەوتوویی دەرهێنران!');
        setTimeout(() => setAiSuccessMessage(''), 4000);
        setShowAiPanel(false);
      } else {
        throw new Error(data.message || 'شیکارکردنی دەقەکە سەرکەوتوو نەبوو');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خەتایەک ڕوویدا لە کاتی پەیوەندیکردن بە ژیری دەستکرد');
    } finally {
      setIsAiParsing(false);
    }
  };

  const displayTotal = customerCurrency === 'USD'
    ? formatMoney(balanceUsd, 'USD')
    : formatMoney(balanceIqd, 'IQD');

  const currentBalanceForCurrency = currency === 'USD' ? balanceUsd : balanceIqd;

  const handleDirectSubmit = async (type: 'DEBT_ADD' | 'PAYMENT_RECEIVE') => {
    setErrorMessage('');
    const numericAmount = parseFloat(amount.replace(/,/g, ''));

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('تکایە بڕی پارەکە بە دروستی بنووسە');
      return;
    }

    try {
      await onAddTransaction(type, numericAmount, currency, note);
      setAmount('');
      setNote('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2500);
      setIsExpanded(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'خەتایەک ڕوویدا لە کاتی تۆمارکردن');
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    if (!raw) {
      setAmount('');
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      setAmount(num.toLocaleString('en-US'));
    } else {
      setAmount(raw);
    }
  };

  const handleApplyPreset = (val: number) => {
    setAmount(val.toLocaleString('en-US'));
  };

  const handleFillFullBalance = () => {
    if (currentBalanceForCurrency > 0) {
      setAmount(Math.abs(currentBalanceForCurrency).toLocaleString('en-US'));
    }
  };

  const handleToggleTag = (tagText: string) => {
    if (!note) {
      setNote(tagText);
    } else if (note.includes(tagText)) {
      setNote(note.replace(tagText, '').trim());
    } else {
      setNote(`${note} - ${tagText}`);
    }
  };

  return (
    <div id="transaction-composer" className="w-full bg-[#1C1C1E] border-t border-[#2C2C2E] sticky bottom-0 z-30 pb-safe shadow-2xl">
      <div className="max-w-md mx-auto px-4 py-3">
        
        {/* SUCCESS TOAST FEEDBACK */}
        {showSuccessToast && (
          <div className="mb-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-extrabold flex items-center justify-center gap-2 animate-bounce">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>مامەڵەکە بە سەرکەوتوویی تۆمارکرا!</span>
          </div>
        )}

        {/* 1. CURRENT BALANCE HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8E8E93]">کۆی گشتی :</span>
            <span className="text-base font-extrabold text-[#F5F5F7]">
              {displayTotal}
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 text-xs font-extrabold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 ${
              isExpanded 
                ? 'bg-[#2C2C2E] text-[#8E8E93] border border-[#3A3A3C]' 
                : 'bg-emerald-500 text-black shadow-emerald-500/20'
            }`}
          >
            <span>{isExpanded ? 'داخستن' : 'تۆمارکردنی مامەڵە'}</span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* EXPANDED COMPOSER FORM */}
        {isExpanded && (
          <div className="flex flex-col gap-3.5 pt-4 animate-slide-up">
            
            {/* Error Feedback */}
            {errorMessage && (
              <div className="bg-red-950/80 border border-red-800/60 text-red-200 text-xs p-2.5 rounded-xl text-center font-bold">
                {errorMessage}
              </div>
            )}

            {/* AI Smart Parser Toggle / Panel */}
            <div className="bg-[#2C2C2E]/40 border border-emerald-500/10 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-[#F5F5F7]">ژیری دەستکرد (AI): شیکارکەری خێرا</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-all active:scale-95"
                >
                  {showAiPanel ? 'داخستن' : 'شیکارکەر'}
                </button>
              </div>

              {showAiPanel && (
                <div className="flex flex-col gap-2 mt-2.5 animate-slide-up">
                  <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                    لیستی شتومەک یان داواکاری کڕیار لێرە بنووسە، سیستەمەکە خۆی نرخەکان کۆدەکاتەوە و تێبینی ڕێکدەخات.
                  </p>
                  <textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="نموونە: ٣ کارت کۆڕەک بە ١٥٠٠٠ و یەک کارت ئاسیا بە ٥٠٠٠"
                    className="w-full bg-black text-[#F5F5F7] text-xs p-2.5 rounded-xl border border-[#3A3A3C] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/40 min-h-[60px] dir-rtl resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isAiParsing}
                      onClick={handleAiParse}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                    >
                      {isAiParsing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>لە کاتی شیکارکردندایە...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>شیکارکردنی دەقەکە بە ژیری دەستکرد</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {aiSuccessMessage && (
                <div className="mt-1.5 text-[11px] font-bold text-emerald-400 text-center animate-fade-in">
                  {aiSuccessMessage}
                </div>
              )}
            </div>

            {/* CURRENCY SELECTOR */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#8E8E93]">جۆری دراو:</span>
              <div className="grid grid-cols-2 gap-1 bg-black p-1 rounded-xl border border-[#2C2C2E] flex-1 max-w-[220px]">
                <button
                  type="button"
                  onClick={() => setCurrency('IQD')}
                  className={`py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    currency === 'IQD'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  🇮🇶 دینار (IQD)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    currency === 'USD'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  🇺🇸 دۆلار ($)
                </button>
              </div>
            </div>

            {/* AMOUNT INPUT & FULL SETTLEMENT */}
            <div className="relative">
              <input
                id="composer-amount-input"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full bg-black text-[#F5F5F7] text-xl font-extrabold p-3.5 pl-24 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/40 text-right dir-ltr"
              />
              {currentBalanceForCurrency > 0 && (
                <button
                  type="button"
                  onClick={handleFillFullBalance}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-emerald-400 text-[11px] font-extrabold rounded-xl border border-emerald-500/20 transition-all flex items-center gap-1 active:scale-95"
                  title="پڕکردنەوەی هەموو باڵانسی قەرزەکە"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>کۆی قەرزەکە</span>
                </button>
              )}
            </div>

            {/* PRESET AMOUNT QUICK CHIPS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] font-bold text-[#8E8E93] shrink-0">بڕی خێرا:</span>
              {(currency === 'IQD' ? IQD_PRESETS : USD_PRESETS).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleApplyPreset(val)}
                  className="px-2.5 py-1 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] text-xs font-extrabold border border-[#3A3A3C] shrink-0 active:scale-95 transition-all"
                >
                  {val.toLocaleString('en-US')} {currency === 'IQD' ? 'د.ع' : '$'}
                </button>
              ))}
            </div>

            {/* NOTE INPUT */}
            <div>
              <input
                id="composer-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="تێبینی / هۆکاری قەرز یان ژمارەی وەسڵ..."
                className="w-full bg-black text-[#F5F5F7] text-sm p-3 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/50 dir-rtl"
              />
            </div>

            {/* QUICK CATEGORY / ITEM TAGS */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const isSelected = note.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#2C2C2E]/60 text-[#8E8E93] border-[#3A3A3C]/40 hover:text-[#F5F5F7]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              {/* Add Debt Button (RIGHT in RTL) */}
              <button
                id="btn-add-debt"
                onClick={() => handleDirectSubmit('DEBT_ADD')}
                disabled={isSubmitting}
                className="py-3.5 px-3 rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white shadow-lg shadow-rose-950/30 border border-rose-400/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>{isSubmitting ? 'تۆمارکردن...' : 'پێدانی قەرز (+)'}</span>
              </button>

              {/* Receive Payment Button (LEFT in RTL) */}
              <button
                id="btn-receive-payment"
                onClick={() => handleDirectSubmit('PAYMENT_RECEIVE')}
                disabled={isSubmitting}
                className="py-3.5 px-3 rounded-2xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black shadow-lg shadow-emerald-950/30 border border-emerald-400/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span>{isSubmitting ? 'تۆمارکردن...' : 'وەرگرتنەوەی پارە (-)'}</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

