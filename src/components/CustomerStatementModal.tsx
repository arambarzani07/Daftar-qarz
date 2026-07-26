import React, { useState, useEffect } from 'react';
import { Customer, Transaction, StatementData } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { 
  X, FileText, Download, Printer, Send, RefreshCw, 
  Calendar, Filter, ArrowUpRight, ArrowDownLeft, Shield, User, ExternalLink
} from 'lucide-react';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  marketName: string;
  onOpenAdvancedProfile?: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  marketName,
  onOpenAdvancedProfile
}) => {
  const [currency, setCurrency] = useState<'IQD' | 'USD'>(customer.currency || 'IQD');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'DEBT_ADD' | 'PAYMENT_RECEIVE'>('ALL');
  
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchStatement = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('currency', currency);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (filterType !== 'ALL') params.append('type', filterType);

      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/statement?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setStatementData(json.data);
      } else {
        setError(json.message || 'خوێندنەوەی کەشف حساب سەرکەوتوو نەبوو');
      }
    } catch {
      setError('پەیوەندی لەگەڵ سێرڤەر پچڕا');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatement();
    }
  }, [isOpen, customer.id, currency, fromDate, toDate, filterType]);

  if (!isOpen) return null;

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setFilterType('ALL');
  };

  const handleExportCSV = () => {
    if (!statementData) return;
    const headers = ['ژمارە', 'جۆری مامەڵە', 'بڕ', 'دراو', 'تێبینی', 'کات و بەروار', 'باڵانسی دوای مامەڵە'];
    const rows = statementData.transactions.map((t, idx) => [
      idx + 1,
      t.type === 'DEBT_ADD' ? 'پێدانی قەرز' : 'وەرگرتنەوەی قەرز',
      t.amount,
      t.currency,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      formatTimestamp(t.timestamp),
      t.running_balance
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `statement_${customer.name}_${currency}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const getWhatsAppMessage = () => {
    if (!statementData) return '';
    const periodText = fromDate && toDate
      ? `ماوەی: ${fromDate} تا ${toDate}`
      : 'گشتی مێژوو';

    return `سڵاو بەڕێز ${customer.name}\nکەشف حسابی تەواوی قەرزەکانت لە (${marketName}):\nدراو: ${currency}\n${periodText}\n\n• باڵانسی سەرەتا: ${formatMoney(statementData.opening_balance, currency)}\n• کۆی قەرزی زیادکراو: ${formatMoney(statementData.period_total_debt, currency)}\n• کۆی پارەی وەرگیراو: ${formatMoney(statementData.period_total_payments, currency)}\n• باڵانسی کۆتایی (قەرزی ئێستا): ${formatMoney(statementData.closing_balance, currency)}\n\nسوپاس بۆ مامەڵەکردنتان.`;
  };

  const handleShareWhatsApp = () => {
    const msg = getWhatsAppMessage();
    const encoded = encodeURIComponent(msg);
    const phoneNum = customer.whatsapp || customer.phone || '';
    const url = phoneNum
      ? `https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const msg = getWhatsAppMessage();
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[#1C1C1E] rounded-3xl border border-[#2C2C2E] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up text-[#F5F5F7] print:max-w-none print:w-full print:h-auto print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:m-0">
        
        {/* Printable Header - Visible ONLY during print */}
        <div className="hidden print:block p-6 text-black border-b border-gray-300">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-black">{marketName}</h1>
              <h2 className="text-lg font-bold text-gray-700">کەشف حسابی کڕیار (Financial Statement)</h2>
            </div>
            <div className="text-left text-xs dir-ltr text-gray-600">
              <div>بەرواری ڕاپۆرت: {new Date().toLocaleDateString('en-GB')}</div>
              <div>ژمارەی زنجیرەیی: #{customer.seq_num}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs bg-gray-100 p-3 rounded">
            <div>
              <span className="font-bold">ناوی کڕیار: </span>
              <span>{customer.name} {customer.latin_name ? `(${customer.latin_name})` : ''}</span>
            </div>
            <div>
              <span className="font-bold">ژمارەی تەلەفۆن: </span>
              <span className="dir-ltr">{customer.phone || 'دیاری نەکراوە'}</span>
            </div>
            <div>
              <span className="font-bold">دراوی هەڵبژێردراو: </span>
              <span>{currency === 'IQD' ? 'دیناری عێراقی (IQD)' : 'دۆلاری ئەمریکی ($ USD)'}</span>
            </div>
            <div>
              <span className="font-bold">ماوە: </span>
              <span>{fromDate && toDate ? `${fromDate} تا ${toDate}` : 'تەواوی مێژووی هەژمار'}</span>
            </div>
          </div>
        </div>

        {/* Modal UI Header - Hidden during print */}
        <div className="flex items-center justify-between p-4 border-b border-[#2C2C2E] bg-[#1C1C1E] sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#34C759]" />
            <div>
              <h3 className="text-base font-extrabold text-[#F5F5F7]">
                کەشف حسابی کڕیار
              </h3>
              <p className="text-xs text-[#8E8E93]">{customer.name} (کۆد: {customer.seq_num})</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAdvancedProfile && (
              <button
                onClick={onOpenAdvancedProfile}
                className="px-2.5 py-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#34C759] rounded-xl flex items-center gap-1 transition-all"
                title="پڕۆفایلی پێشکەوتوو"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">پڕۆفایلی پێشکەوتوو</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Currency & Filter Controls - Hidden during print */}
        <div className="p-3 bg-[#000000] border-b border-[#2C2C2E] space-y-2 print:hidden">
          
          {/* Row 1: Currency Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-[#1C1C1E] p-1 rounded-xl border border-[#2C2C2E]">
              <button
                onClick={() => setCurrency('IQD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currency === 'IQD'
                    ? 'bg-[#34C759] text-black shadow-xs'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                دیناری عێراقی (IQD)
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currency === 'USD'
                    ? 'bg-[#34C759] text-black shadow-xs'
                    : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                }`}
              >
                دۆلاری ئەمریکی ($ USD)
              </button>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportCSV}
                disabled={!statementData}
                className="px-2.5 py-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold rounded-xl flex items-center gap-1 text-[#F5F5F7]"
                title="داگرتن وەک CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#34C759]" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={!statementData}
                className="px-2.5 py-1.5 bg-[#34C759] hover:bg-[#2EB14E] text-black text-xs font-extrabold rounded-xl flex items-center gap-1"
                title="پرینتکردنی کەشف حساب"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">پرینت / PDF</span>
              </button>
            </div>
          </div>

          {/* Row 2: Date Filters & Transaction Type Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-[#1C1C1E]">
            <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
              <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
              <span className="text-[#8E8E93] whitespace-nowrap text-[10px]">لە:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
              <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
              <span className="text-[#8E8E93] whitespace-nowrap text-[10px]">بۆ:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
              <Filter className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
              >
                <option value="ALL" className="bg-[#1C1C1E]">هەموو مامەڵەکان</option>
                <option value="DEBT_ADD" className="bg-[#1C1C1E]">پێدانی قەرز (+)</option>
                <option value="PAYMENT_RECEIVE" className="bg-[#1C1C1E]">وەرگرتنەوەی قەرز (-)</option>
              </select>

              {(fromDate || toDate || filterType !== 'ALL') && (
                <button
                  onClick={handleResetFilters}
                  className="p-1 text-[#FF3B30] hover:text-white"
                  title="پاککردنەوەی فلتەر"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 print:p-6 print:overflow-visible">
          
          {loading && (
            <div className="py-12 text-center text-xs text-[#8E8E93] flex flex-col items-center gap-2 print:hidden">
              <RefreshCw className="w-6 h-6 animate-spin text-[#34C759]" />
              <span>لەبارکردنی دراو و زانیارییەکانی کەشف حساب...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-2xl text-xs text-[#FF3B30] text-center">
              {error}
            </div>
          )}

          {!loading && statementData && (
            <>
              {/* Financial Statement Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                
                {/* Opening Balance */}
                <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] print:bg-gray-50 print:border-gray-300 text-right">
                  <span className="text-[11px] text-[#8E8E93] print:text-gray-600 block mb-1">
                    باڵانسی سەرەتا
                  </span>
                  <span className="text-sm font-extrabold text-[#F5F5F7] print:text-black">
                    {formatMoney(statementData.opening_balance, currency)}
                  </span>
                </div>

                {/* Total Debt Added */}
                <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] print:bg-gray-50 print:border-gray-300 text-right">
                  <span className="text-[11px] text-[#8E8E93] print:text-gray-600 block mb-1">
                    کۆی قەرزی زیادکراو
                  </span>
                  <span className="text-sm font-extrabold text-[#F5F5F7] print:text-black">
                    {formatMoney(statementData.period_total_debt, currency)}
                  </span>
                </div>

                {/* Total Payments Received */}
                <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] print:bg-gray-50 print:border-gray-300 text-right">
                  <span className="text-[11px] text-[#8E8E93] print:text-gray-600 block mb-1">
                    کۆی پارەی وەرگیراو
                  </span>
                  <span className="text-sm font-extrabold text-[#34C759] print:text-green-700">
                    {formatMoney(statementData.period_total_payments, currency)}
                  </span>
                </div>

                {/* Closing Balance */}
                <div className="bg-[#000000] p-3 rounded-2xl border border-[#34C759]/40 print:bg-gray-100 print:border-gray-400 text-right">
                  <span className="text-[11px] text-[#34C759] print:text-black font-bold block mb-1">
                    باڵانسی کۆتایی (قەرز)
                  </span>
                  <span className="text-sm font-black text-[#34C759] print:text-black">
                    {formatMoney(statementData.closing_balance, currency)}
                  </span>
                </div>

              </div>

              {/* Transactions List / Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#8E8E93] print:text-black font-bold border-b border-[#2C2C2E] print:border-gray-300 pb-2 px-1">
                  <span>لیستی مامەڵەکان ({statementData.total_count})</span>
                  <span>دراو: {currency}</span>
                </div>

                {statementData.transactions.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[#8E8E93] bg-[#000000] rounded-2xl border border-[#2C2C2E]">
                    هیچ مامەڵەیەک لەم ماوەیەدا نەدۆزرایەوە
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statementData.transactions.map((tx, index) => (
                      <div
                        key={tx.id}
                        className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] print:bg-white print:border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        {/* Right: Type & Note */}
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            tx.type === 'DEBT_ADD' 
                              ? 'bg-[#2C2C2E] text-[#F5F5F7] print:bg-gray-200 print:text-black' 
                              : 'bg-[#34C759]/20 text-[#34C759] print:bg-green-100 print:text-green-800'
                          }`}>
                            {tx.type === 'DEBT_ADD' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-extrabold ${
                                tx.type === 'DEBT_ADD' ? 'text-[#F5F5F7] print:text-black' : 'text-[#34C759] print:text-green-700'
                              }`}>
                                {tx.type === 'DEBT_ADD' ? 'پێدانی قەرز' : 'وەرگرتنەوەی قەرز'}
                              </span>
                              <span className="text-[10px] text-[#8E8E93] print:text-gray-500 dir-ltr">
                                #{index + 1}
                              </span>
                            </div>

                            {tx.note && (
                              <p className="text-[#8E8E93] print:text-gray-700 text-[11px] mt-0.5">
                                {tx.note}
                              </p>
                            )}

                             <div className="text-[10px] text-[#8E8E93] print:text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                                <span className="dir-ltr">{formatTimestamp(tx.timestamp)}</span>
                                <span>•</span>
                                <span className="font-bold text-[#F5F5F7] print:text-black">
                                  بەکارهێنەر: {tx.created_by || 'خاوەن کار'}
                                </span>
                              </div>
                          </div>
                        </div>

                        {/* Left: Amount & Running Balance */}
                        <div className="flex sm:flex-col items-between sm:items-end justify-between border-t sm:border-t-0 border-[#2C2C2E] pt-2 sm:pt-0">
                          <div className="text-left">
                            <span className="text-xs text-[#8E8E93] sm:hidden block">بڕی مامەڵە:</span>
                            <span className={`text-sm font-extrabold ${
                              tx.type === 'DEBT_ADD' ? 'text-[#F5F5F7] print:text-black' : 'text-[#34C759] print:text-green-700'
                            }`}>
                              {formatMoney(tx.amount, tx.currency)}
                            </span>
                          </div>

                          <div className="text-left mt-0.5">
                            <span className="text-[10px] text-[#8E8E93] print:text-gray-500">
                              باڵانسی دوای مامەڵە: <strong className="text-[#F5F5F7] print:text-black">{formatMoney(tx.running_balance, tx.currency)}</strong>
                            </span>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer Actions - Hidden during print */}
        <div className="p-4 border-t border-[#2C2C2E] bg-[#1C1C1E] flex items-center gap-2 print:hidden">
          <button
            onClick={handleShareWhatsApp}
            disabled={!statementData}
            className="flex-1 py-3 bg-[#34C759] hover:bg-[#2EB14E] active:scale-98 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>ناردنی ڕاپۆرت بۆ واتساپ</span>
          </button>

          <button
            onClick={handleCopyText}
            disabled={!statementData}
            className="py-3 px-4 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <span>{copied ? 'کۆپی کرا!' : 'کۆپی دەق'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
