import React from 'react';
import { Loader2 } from 'lucide-react';

export function AuthLoadingScreen() {
  return (
    <div dir="rtl" lang="ckb" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/5 border border-[#10B981]/30 flex items-center justify-center shadow-2xl">
          <span className="text-2xl font-black text-[#10B981] tracking-wider">Z</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">ZHIROX</h1>
          <p className="text-sm text-[#8E8E93]">سیستەمی بەڕێوەبردنی قەرزی ژیرۆکس</p>
        </div>
        <div className="flex items-center justify-center space-x-2 space-x-reverse pt-4 text-[#10B981]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-medium text-[#8E8E93]">بارکردنی زانیارییەکانی چوونەژوورەوە...</span>
        </div>
      </div>
    </div>
  );
}
