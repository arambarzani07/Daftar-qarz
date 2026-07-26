import React from 'react';
import { Building2, ChevronLeft, LogOut } from 'lucide-react';

interface SelectContextPageProps {
  contexts: any[];
  onSelectContext: (context: any) => void;
  onLogout: () => void;
}

export function SelectContextPage({ contexts, onSelectContext, onLogout }: SelectContextPageProps) {
  return (
    <div dir="rtl" lang="ckb" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1C1C1E] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto text-[#10B981]">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">دیاریکردنی مارکێت</h1>
          <p className="text-sm text-[#8E8E93]">تکایە ئەو مارکێتە هەڵبژێرە کە دەتهەوێت بچیتە ناوەوە</p>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto">
          {contexts.map((ctx, idx) => (
            <button
              key={ctx.context_id || idx}
              onClick={() => onSelectContext(ctx)}
              className="w-full p-4 bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/5 rounded-xl flex items-center justify-between transition-all duration-200 text-right group active:scale-[0.98]"
              style={{ minHeight: '44px' }}
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white group-hover:text-[#10B981] transition-colors">
                  {ctx.tenant_name || 'مارکێت'}
                </div>
                <div className="text-xs text-[#8E8E93]">
                  {ctx.role_label_ku || ctx.role}
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-[#8E8E93] group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-white/10 flex justify-between items-center">
          <button
            onClick={onLogout}
            className="text-xs text-[#8E8E93] hover:text-white flex items-center gap-1.5 transition-colors"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <LogOut className="w-4 h-4" />
            <span>چوونەدەرەوە</span>
          </button>
          <span className="text-xs text-[#636366]">پارێزراو بە ZHIROX</span>
        </div>
      </div>
    </div>
  );
}
