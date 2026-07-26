import React, { useState, useMemo } from 'react';
import { Customer, SortOption } from '../types';
import { CustomerDebtCard } from './CustomerDebtCard';
import { UserPlus, ArrowUpDown, ChevronDown, Filter, Users, CheckCircle2, AlertCircle } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer: () => void;
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  isLoading?: boolean;
}

type FilterStatus = 'all' | 'debtors' | 'settled';

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  onSelectCustomer,
  onAddCustomer,
  currentSort,
  onSortChange,
  isLoading = false
}) => {
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sortLabels: Record<SortOption, string> = {
    newest: 'تازەترین قەرزدار',
    oldest: 'کۆنترین قەرزدار',
    highest_debt: 'زۆرترین قەرز',
    lowest_debt: 'کەمترین قەرز',
    recent: 'دوایین چالاکی',
    alphabetical: 'بەپێی پیت (ئ-ی)'
  };

  const getCustomerBalance = (c: Customer) => {
    return c.currency === 'USD' ? (c.balance_usd ?? 0) : (c.balance_iqd ?? 0);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const bal = getCustomerBalance(cust);
      
      // Status filter
      if (filterStatus === 'debtors' && bal === 0) return false;
      if (filterStatus === 'settled' && bal !== 0) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = cust.name.toLowerCase().includes(q);
        const matchesSeq = String(cust.seq_num).includes(q);
        const matchesPhone = cust.phone ? cust.phone.includes(q) : false;
        return matchesName || matchesSeq || matchesPhone;
      }

      return true;
    });
  }, [customers, filterStatus, searchQuery]);

  const debtorsCount = useMemo(() => customers.filter(c => getCustomerBalance(c) !== 0).length, [customers]);
  const settledCount = useMemo(() => customers.filter(c => getCustomerBalance(c) === 0).length, [customers]);

  return (
    <div id="customer-list-section" className="w-full px-4 pt-2 pb-24">
      <div className="max-w-md mx-auto space-y-3">
        
        {/* QUICK SEARCH & FILTER CONTROL BAR */}
        {customers.length > 0 && (
          <div className="space-y-2 bg-[#1C1C1E] p-3 rounded-2xl border border-[#2C2C2E]">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان بەپێی ناو، ژمارە یان مۆبایل..."
                className="w-full bg-black text-[#F5F5F7] text-xs p-2.5 pr-8 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-emerald-500 placeholder-[#8E8E93]"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] text-xs bg-[#2C2C2E] w-4 h-4 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips & Sort Trigger */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2C2C2E]">
              {/* Status Filters */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shrink-0 ${
                    filterStatus === 'all'
                      ? 'bg-emerald-500 text-black shadow-sm'
                      : 'bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  هەموان ({customers.length})
                </button>

                <button
                  onClick={() => setFilterStatus('debtors')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shrink-0 flex items-center gap-1 ${
                    filterStatus === 'debtors'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>قەرزداران ({debtorsCount})</span>
                </button>

                <button
                  onClick={() => setFilterStatus('settled')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all shrink-0 flex items-center gap-1 ${
                    filterStatus === 'settled'
                      ? 'bg-teal-500 text-black shadow-sm'
                      : 'bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>پاکتاوکراو ({settledCount})</span>
                </button>
              </div>

              {/* Sort Button */}
              <button
                onClick={() => setShowSortSheet(true)}
                className="px-2.5 py-1 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] text-[11px] font-extrabold border border-[#3A3A3C] flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                title="ڕێکخستنی ڕێزبەندی"
              >
                <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">{sortLabels[currentSort]}</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-18 bg-[#1C1C1E] rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCustomers.length === 0 && (
          <div className="w-full bg-[#1C1C1E] rounded-2xl p-8 my-4 text-center border border-[#2C2C2E]/40">
            <p className="text-[#8E8E93] text-base font-medium mb-4">
              {searchQuery || filterStatus !== 'all'
                ? 'هیچ قەرزدارێک نەدۆزرایەوە بەپێی ئەم فلتەرە'
                : 'هێشتا هیچ قەرزدارێک زیاد نەکراوە'}
            </p>
            <button
              id="empty-state-add-btn"
              onClick={onAddCustomer}
              className="inline-flex items-center justify-center gap-2 bg-[#2C2C2E] active:bg-[#3A3A3C] text-[#F5F5F7] font-bold px-5 py-3 rounded-xl transition-all"
            >
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <span>زیادکردنی قەرزدار</span>
            </button>
          </div>
        )}

        {/* Customer Cards */}
        {!isLoading && filteredCustomers.length > 0 && (
          <div className="flex flex-col">
            {filteredCustomers.map((cust) => (
              <CustomerDebtCard
                key={cust.id}
                customer={cust}
                onClick={onSelectCustomer}
              />
            ))}
          </div>
        )}

      </div>

      {/* Sort Options Bottom Sheet */}
      {showSortSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#1C1C1E] rounded-t-[28px] p-5 animate-slide-up border-t border-[#2C2C2E]">
            <div className="w-12 h-1 bg-[#3A3A3C] rounded-full mx-auto mb-4" />
            
            <h3 className="text-base font-bold text-[#F5F5F7] mb-4 text-center">
              ڕێکخستنی ڕێزبەندی لیستی قەرزداران
            </h3>

            <div className="flex flex-col gap-1 mb-4">
              {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    onSortChange(key);
                    setShowSortSheet(false);
                  }}
                  className={`w-full text-right p-3.5 rounded-xl font-medium text-sm flex items-center justify-between transition-colors ${
                    currentSort === key
                      ? 'bg-[#2C2C2E] text-emerald-400 font-bold'
                      : 'text-[#F5F5F7] active:bg-[#242426]'
                  }`}
                >
                  <span>{sortLabels[key]}</span>
                  {currentSort === key && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSortSheet(false)}
              className="w-full py-3 bg-[#242426] text-[#8E8E93] rounded-xl font-bold text-sm"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

