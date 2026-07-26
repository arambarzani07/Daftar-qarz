import React from 'react';
import { ChevronRight, Filter, Search, X } from 'lucide-react';

interface SearchHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  onBack: () => void;
  onOpenFilters: () => void;
  hasActiveFilters?: boolean;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  query,
  onQueryChange,
  onBack,
  onOpenFilters,
  hasActiveFilters = false
}) => {
  return (
    <header id="search-header" className="w-full bg-black pt-safe px-4 py-3 sticky top-0 z-20 border-b border-[#1C1C1E]">
      <div className="max-w-md mx-auto flex items-center gap-2">
        
        {/* Back Button */}
        <button
          id="search-back-btn"
          onClick={onBack}
          aria-label="گەڕانەوە"
          className="text-[#F5F5F7] p-1 active:opacity-60 transition-opacity shrink-0"
        >
          <ChevronRight className="w-6 h-6 stroke-[1.5]" />
        </button>

        {/* Input Bar */}
        <div className="flex-1 relative flex items-center">
          <Search className="w-4 h-4 text-[#8E8E93] absolute right-3 pointer-events-none" />
          <input
            id="search-input-field"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="بگەڕێ بە ناو یان پارە"
            className="w-full bg-[#1C1C1E] text-[#F5F5F7] text-sm pr-9 pl-8 py-2.5 rounded-xl border border-[#2C2C2E] focus:outline-none focus:border-[#34C759] placeholder-[#8E8E93] dir-rtl"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="absolute left-2 text-[#8E8E93] hover:text-[#F5F5F7]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Advanced Filters Button */}
        <button
          id="search-filter-btn"
          onClick={onOpenFilters}
          aria-label="فلتەرەکان"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
            hasActiveFilters
              ? 'bg-[#34C759] text-black font-bold'
              : 'bg-[#1C1C1E] text-[#F5F5F7] active:bg-[#2C2C2E]'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>

      </div>
    </header>
  );
};
