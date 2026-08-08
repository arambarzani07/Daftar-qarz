import React, { useState } from 'react';
import { CurrencyType } from '../types';
import { X, UserPlus, Phone, FileText, DollarSign, Send } from 'lucide-react';

interface AddCustomerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    latin_name?: string;
    phone: string;
    password?: string;
    telegram_username?: string;
    telegram_chat_id?: string;
    currency: CurrencyType;
    notes?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const AddCustomerSheet: React.FC<AddCustomerSheetProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('IQD');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('تکایە ناوی قەرزدار بنووسە');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('تکایە ژمارەی مۆبایل بنووسە (زۆرەملێیە)');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        telegram_username: telegramUsername.trim() ? telegramUsername.trim().replace(/^@/, '') : undefined,
        notes: notes.trim() || undefined,
        currency
      });
      setName('');
      setPhone('');
      setTelegramUsername('');
      setNotes('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'خەتایەک ڕوویدا لە کاتی زیادکردن');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs">
      
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Modal */}
      <div className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[32px] p-6 pb-safe animate-slide-up border-t border-[#2C2C2E] z-10 shadow-2xl">
        
        {/* Header & Title */}
        <div className="flex items-center justify-between mb-5 border-b border-[#2C2C2E] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-[#F5F5F7]">زیادکردنی قەرزداری نوێ</h2>
          </div>
          
          <button
            onClick={onClose}
            aria-label="داخستن"
            className="text-[#8E8E93] hover:text-[#F5F5F7] p-1.5 rounded-xl hover:bg-[#2C2C2E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-800/60 text-red-200 text-xs p-3 rounded-xl text-center font-bold">
              {errorMessage}
            </div>
          )}

          {/* CUSTOMER NAME INPUT */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1">ناوی سیانی قەرزدار *</label>
            <input
              id="input-customer-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نموونە: ئارام ئەحمەد عەلی..."
              className="w-full bg-black text-[#F5F5F7] text-sm p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/50 dir-rtl font-medium"
            />
          </div>

          {/* PHONE NUMBER INPUT */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>ژمارەی مۆبایل *</span>
            </label>
            <input
              id="input-customer-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0750XXXXXXX"
              className="w-full bg-black text-[#F5F5F7] text-sm p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/50 dir-ltr text-right font-medium"
            />
          </div>

          {/* TELEGRAM USERNAME INPUT */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>ئایدی تێلیگرام (Telegram @username)</span>
              </span>
              <span className="text-[10px] text-sky-400 font-normal">ئارەزوومەندانە</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-[#8E8E93] text-sm font-mono">@</span>
              <input
                id="input-customer-telegram"
                type="text"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-black text-[#F5F5F7] text-sm py-3.5 pl-8 pr-3 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-sky-500 placeholder-[#8E8E93]/50 dir-ltr text-left font-mono"
              />
            </div>
          </div>

          {/* CURRENCY SELECTOR */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>دراوی سەرەکی مامەڵە</span>
            </label>
            <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-2xl border border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setCurrency('IQD')}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all ${
                  currency === 'IQD'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                🇮🇶 دینار (IQD)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`py-2 rounded-xl text-xs font-extrabold transition-all ${
                  currency === 'USD'
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                🇺🇸 دۆلار ($)
              </button>
            </div>
          </div>

          {/* NOTES INPUT */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>تێبینی یان شوێنی نیشتەجێبوون (ئارەزوومەندانە)</span>
            </label>
            <input
              id="input-customer-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نموونە: گەڕەکی شۆڕش، بەرامبەر مزگەوت..."
              className="w-full bg-black text-[#F5F5F7] text-sm p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/50 dir-rtl font-medium"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            id="btn-submit-add-customer"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-3 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'تۆمارکردن...' : 'تۆمارکردنی قەرزدار'}
          </button>

        </form>

      </div>
    </div>
  );
};

