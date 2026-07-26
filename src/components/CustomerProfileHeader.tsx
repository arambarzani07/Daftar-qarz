import React from 'react';
import { ChevronRight, FileText, Share2 } from 'lucide-react';
import { Customer } from '../types';

interface CustomerProfileHeaderProps {
  customer: Customer;
  onBack: () => void;
  onOpenStatement: () => void;
  onShareLink: () => void;
  onShareWhatsApp?: () => void;
}

export const CustomerProfileHeader: React.FC<CustomerProfileHeaderProps> = ({
  customer,
  onBack,
  onOpenStatement,
  onShareLink,
  onShareWhatsApp
}) => {
  return (
    <header id="customer-profile-header" className="w-full bg-black pt-safe px-4 py-2 sticky top-0 z-20">
      <div className="max-w-md mx-auto flex items-center justify-between h-11">
        
        {/* Right Side (RTL start) - Back Action */}
        <button
          id="profile-back-btn"
          onClick={onBack}
          aria-label="گەڕانەوە"
          className="text-[#F5F5F7] p-1 active:opacity-60 transition-opacity"
        >
          <ChevronRight className="w-6 h-6 stroke-[1.5]" />
        </button>

        {/* Customer Name Title */}
        <div className="flex flex-col items-center min-w-0 px-2 flex-1 text-center">
          <h2 className="text-base font-bold text-[#F5F5F7] truncate max-w-[200px]">
            {customer.name}
          </h2>
        </div>

        {/* Left Side (RTL end) - Actions */}
        <div className="flex items-center gap-3">
          {/* Statement Report / PDF */}
          <button
            id="profile-statement-btn"
            onClick={onOpenStatement}
            aria-label="کەشف حیساب"
            className="text-[#F5F5F7] p-1 active:opacity-60 transition-opacity"
          >
            <FileText className="w-5 h-5 stroke-[1.5]" />
          </button>

          {/* Share Customer Live Account Link */}
          <button
            id="profile-share-btn"
            onClick={onShareLink || onShareWhatsApp}
            aria-label="بەشکردنی بەستەری ڕاستەوخۆ"
            className="text-[#F5F5F7] p-1 active:opacity-60 transition-opacity"
          >
            <Share2 className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

      </div>
    </header>
  );
};
