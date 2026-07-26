import React from 'react';
import { Customer } from '../types';
import { formatMoney } from '../utils/formatters';
import { Phone, CheckCircle2, AlertCircle } from 'lucide-react';

interface CustomerDebtCardProps {
  customer: Customer;
  onClick: (customer: Customer) => void;
}

export const CustomerDebtCard: React.FC<CustomerDebtCardProps> = ({ customer, onClick }) => {
  const isUsd = customer.currency === 'USD';
  const balance = isUsd ? customer.balance_usd : customer.balance_iqd;
  const currencySuffix = isUsd ? '$' : 'دینار';

  // Format amount with thousands separators
  const formattedAmount = Math.abs(balance).toLocaleString('en-US');
  const isZeroBalance = balance === 0;

  return (
    <div
      id={`customer-card-${customer.id}`}
      onClick={() => onClick(customer)}
      className="w-full bg-[#1C1C1E] hover:bg-[#252528] active:bg-[#2C2C2E] border border-[#2C2C2E] hover:border-[#3A3A3C] rounded-2xl px-4 py-3.5 transition-all cursor-pointer my-1.5 shadow-sm group"
    >
      <div className="flex items-center justify-between gap-3">
        
        {/* Sequence + Customer Name + Phone indicator */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-extrabold text-[#8E8E93] bg-[#2C2C2E] px-2 py-0.5 rounded-lg shrink-0 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
            {customer.seq_num}
          </span>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-[#F5F5F7] truncate group-hover:text-emerald-400 transition-colors">
                {customer.name}
              </span>
              {customer.phone && (
                <Phone className="w-3 h-3 text-[#8E8E93] shrink-0 opacity-60" />
              )}
            </div>
            {customer.notes && (
              <p className="text-[11px] text-[#8E8E93] truncate">{customer.notes}</p>
            )}
          </div>
        </div>

        {/* Balance Amount + Currency Text or Paid Badge */}
        {isZeroBalance ? (
          <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-xl text-xs font-bold border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>پاکتاو کراو</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0 bg-[#252528] px-3 py-1.5 rounded-xl border border-[#3A3A3C]/40">
            <span className="text-base font-black text-[#F5F5F7] tracking-tight">
              {formattedAmount}
            </span>
            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              {currencySuffix}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

