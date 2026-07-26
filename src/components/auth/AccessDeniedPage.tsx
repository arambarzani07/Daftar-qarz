import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

interface AccessDeniedPageProps {
  onLogout: () => void;
}

export function AccessDeniedPage({ onLogout }: AccessDeniedPageProps) {
  return (
    <div dir="rtl" lang="ckb" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1C1C1E] border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">دەستگەیشتن ڕەتکرایەوە</h1>
          <p className="text-sm text-[#8E8E93] leading-relaxed">
            ئەم هەژمارە دەسەڵاتی چوونە ژوورەوەی بۆ ZHIROX نییە.
          </p>
        </div>
        <div className="pt-4">
          <button
            onClick={onLogout}
            className="w-full h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-white/10 active:scale-[0.98]"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <LogOut className="w-4 h-4 text-[#8E8E93]" />
            <span>گەڕانەوە بۆ پەڕەی چوونەژوورەوە</span>
          </button>
        </div>
        <p className="text-xs text-[#636366]">پارێزراو بە سیستەمی ئاسایشی ZHIROX</p>
      </div>
    </div>
  );
}
