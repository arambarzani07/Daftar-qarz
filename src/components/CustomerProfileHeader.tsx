import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, User, FileText, Share2, MessageCircle, Settings, Camera, Shield, ExternalLink } from 'lucide-react';
import { Customer } from '../types';

interface CustomerProfileHeaderProps {
  customer: Customer;
  onBack: () => void;
  onOpenStatement: () => void;
  onShareLink: () => void;
  onShareWhatsApp?: () => void;
  onOpenAdvancedProfile?: () => void;
}

export const CustomerProfileHeader: React.FC<CustomerProfileHeaderProps> = ({
  customer,
  onBack,
  onOpenStatement,
  onShareLink,
  onShareWhatsApp,
  onOpenAdvancedProfile
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header id="customer-profile-header" className="w-full bg-black pt-safe px-4 py-2 sticky top-0 z-30 border-b border-[#2C2C2E]/60">
      <div className="max-w-md mx-auto flex items-center justify-between h-11">
        
        {/* Right Side (RTL start) - Back Action */}
        <button
          id="profile-back-btn"
          onClick={onBack}
          aria-label="گەڕانەوە"
          className="text-[#F5F5F7] p-1.5 active:opacity-60 transition-opacity flex items-center gap-1"
        >
          <ChevronRight className="w-6 h-6 stroke-[1.5]" />
        </button>

        {/* Customer Name Title & Avatar */}
        <div 
          onClick={() => {
            if (onOpenAdvancedProfile) onOpenAdvancedProfile();
          }}
          className="flex items-center gap-2.5 min-w-0 px-2 flex-1 justify-center cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2C2C2E] border border-[#34C759]/40 flex items-center justify-center shrink-0">
            {customer.avatar_url ? (
              <img src={customer.avatar_url} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black text-[#34C759]">
                {customer.name ? customer.name.charAt(0) : 'ک'}
              </span>
            )}
          </div>
          <div className="text-right truncate">
            <h2 className="text-sm font-bold text-[#F5F5F7] truncate max-w-[160px] group-hover:text-[#34C759] transition-colors">
              {customer.name}
            </h2>
            <div className="text-[10px] text-[#8E8E93] font-mono">{customer.phone || 'بەستراوی کڕیار'}</div>
          </div>
        </div>

        {/* Left Side (RTL end) - Single Human Head / Profile Menu Icon */}
        <div className="relative" ref={menuRef}>
          <button
            id="profile-customer-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="کۆنتڕۆڵی کڕیار"
            className="w-10 h-10 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#34C759]/50 text-[#F5F5F7] flex items-center justify-center transition-all shadow-sm active:scale-95"
          >
            {customer.avatar_url ? (
              <div className="w-full h-full rounded-full overflow-hidden">
                <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <User className="w-5 h-5 text-[#34C759] stroke-[1.8]" />
            )}
          </button>

          {/* Neatly Organized Dropdown Menu */}
          {menuOpen && (
            <div 
              className="absolute left-0 mt-2 w-64 bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              dir="rtl"
            >
              <div className="px-4 py-2.5 border-b border-[#2C2C2E] mb-1">
                <div className="text-xs font-black text-[#F5F5F7] truncate">{customer.name}</div>
                <div className="text-[10px] text-[#8E8E93]">بەڕێوەبردنی تایبەتمەندییەکانی کڕیار</div>
              </div>

              <div className="space-y-0.5 px-1.5">
                {/* 1. Advanced Profile & Camera Photo */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (onOpenAdvancedProfile) onOpenAdvancedProfile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#2C2C2E] text-right text-xs font-bold text-[#F5F5F7] transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#34C759]/10 text-[#34C759] flex items-center justify-center shrink-0 group-hover:bg-[#34C759] group-hover:text-black transition-all">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold">زانیاری و وێنەی پڕۆفایل</div>
                    <div className="text-[10px] text-[#8E8E93]">گۆڕینی وێنە بە کەمێرا یان دەستکاری</div>
                  </div>
                </button>

                {/* 2. Statement Report */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenStatement();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#2C2C2E] text-right text-xs font-bold text-[#F5F5F7] transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold">کەشفی حیساب (Statement)</div>
                    <div className="text-[10px] text-[#8E8E93]">بینین و چاپکردنی ڕاپۆرتی قەرز</div>
                  </div>
                </button>

                {/* 3. Share Live Link */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onShareLink();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#2C2C2E] text-right text-xs font-bold text-[#F5F5F7] transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-all">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold">بەشکردنی بەستەری ڕاستەوخۆ</div>
                    <div className="text-[10px] text-[#8E8E93]">ناردنی لینکی حیساب بۆ کڕیار</div>
                  </div>
                </button>

                {/* Open Customer Portal Directly */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    const tenantId = customer.market_id || 'default';
                    const customerId = customer.id;
                    window.open(`/portal/${tenantId}/${customerId}`, '_blank');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#2C2C2E] text-right text-xs font-bold text-[#F5F5F7] transition-all group border-t border-[#2C2C2E]/60 mt-1 pt-2.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-emerald-400">چوونە ژوورەوە بۆ پۆرتالی کڕیار</div>
                    <div className="text-[10px] text-[#8E8E93]">کردنەوەی پۆرتالی تایبەتی کڕیار لە تاتەیەکی نوێدا</div>
                  </div>
                </button>

                {/* 4. WhatsApp Sharing (if provided) */}
                {onShareWhatsApp && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onShareWhatsApp();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-[#2C2C2E] text-right text-xs font-bold text-[#F5F5F7] transition-all group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-extrabold">ناردنی نامە لە وەتسአپ</div>
                      <div className="text-[10px] text-[#8E8E93]">نامەی ئاگادارکردنەوەی قەرز</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
