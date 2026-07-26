import React, { useState } from 'react';
import { CurrencyType } from '../types';
import { X, UserPlus, Phone, FileText, DollarSign, Lock, Eye, EyeOff } from 'lucide-react';

interface AddCustomerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    latin_name?: string;
    phone: string;
    password: string;
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
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (!password.trim()) {
      setErrorMessage('تکایە وشەی نهێنی (پاسۆرد) بۆ کڕیار بنووسە (زۆرەملێیە)');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim(),
        notes: notes.trim() || undefined,
        currency
      });
      setName('');
      setPhone('');
      setPassword('');
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

          {/* PASSWORD INPUT */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#8E8E93] px-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>وشەی نهێنی چوونەژوورەوەی کڕیار *</span>
            </label>
            <div className="relative">
              <input
                id="input-customer-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black text-[#F5F5F7] text-sm p-3.5 pl-10 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]/50 dir-ltr text-right font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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

