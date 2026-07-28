import React, { useState, useEffect } from 'react';
import { Customer, Transaction, StatementData, AppSettings } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { 
  X, FileText, Download, Printer, Send, RefreshCw, 
  Calendar, Filter, ArrowUpRight, ArrowDownLeft, User
} from 'lucide-react';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  marketName: string;
  settings?: AppSettings;
  onOpenAdvancedProfile?: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  isOpen,
  onClose,
  customer,
  marketName,
  settings,
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

  // Helper to format date cleanly for A4 invoice print (e.g., 11/07/2026)
  const formatPrintDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  };

  // Helper to format current date/time for print statement (e.g., 21/07/2026 19:01)
  const getCurrentPrintDateTime = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Dynamic values based on market settings
  const ownerPhone = settings?.owner_phone || '07504048383';
  const ownerLocation = settings?.market_name?.includes('چنار') || marketName.includes('چنار')
    ? 'دۆرێ - بارزان' 
    : 'کوردستان';

  // Format transaction name for print table row
  const getTxNotePrint = (tx: Transaction) => {
    let baseLabel = '';
    if (tx.type === 'DEBT_ADD') baseLabel = 'قەرزی نوێ';
    else if (tx.type === 'PAYMENT_RECEIVE') baseLabel = 'وەرگرتنی پارە';
    else if (tx.type === 'OPENING_BALANCE') baseLabel = 'دەستپێکی حساب';
    else if (tx.type === 'FORGIVENESS') baseLabel = 'داشکان / بڕینەوە';
    else if (tx.type === 'ADJUSTMENT_DEBIT') baseLabel = 'ڕاستکردنەوە (+)';
    else if (tx.type === 'ADJUSTMENT_CREDIT') baseLabel = 'ڕاستکردنەوە (-)';
    else baseLabel = 'مامەڵە';

    if (tx.note && tx.note.trim()) {
      return tx.note.trim();
    }
    return baseLabel;
  };

  return (
    <>
      {/* CSS Injected specifically for print optimization and page breaks */}
      <style>{`
        @media print {
          /* Hide absolutely everything in the body of the web application */
          body * {
            visibility: hidden;
            background: none !important;
          }
          /* Show ONLY the high-fidelity invoice statement wrapper and its children */
          #print-statement-container, #print-statement-container * {
            visibility: visible;
          }
          #print-statement-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            color: black !important;
            direction: rtl !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            padding: 4mm 10mm 10mm 10mm !important;
            box-shadow: none !important;
          }
          /* Custom print properties and default margins */
          @page {
            size: A4;
            margin: 15mm 15mm 15mm 15mm;
          }
          /* Ensure table rows do not split across pages */
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Prevent summary / stamp block from breaking */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 1. Modal Dialog UI - Visible ONLY on screen, hidden on print */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs print:hidden">
        <div className="relative w-full max-w-2xl bg-[#1C1C1E] rounded-3xl border border-[#2C2C2E] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up text-[#F5F5F7]">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2C2C2E] bg-[#1C1C1E] sticky top-0 z-10">
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

          {/* Currency & Filters */}
          <div className="p-3 bg-[#000000] border-b border-[#2C2C2E] space-y-2">
            
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
                <a
                  href={`/market/print-statement?customerId=${customer.id}&currency=${currency}&fromDate=${fromDate}&toDate=${toDate}&filterType=${filterType}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-2.5 py-1.5 bg-[#34C759] hover:bg-[#2EB14E] text-black text-xs font-extrabold rounded-xl flex items-center gap-1 ${
                    !statementData ? 'pointer-events-none opacity-50' : ''
                  }`}
                  title="پرینتکردنی کەشف حساب"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">پرینت / PDF</span>
                </a>
              </div>
            </div>

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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {loading && (
              <div className="py-12 text-center text-xs text-[#8E8E93] flex flex-col items-center gap-2">
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
                {/* On-screen Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] text-right">
                    <span className="text-[11px] text-[#8E8E93] block mb-1">باڵانسی سەرەتا</span>
                    <span className="text-sm font-extrabold text-[#F5F5F7]">
                      {formatMoney(statementData.opening_balance, currency)}
                    </span>
                  </div>

                  <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] text-right">
                    <span className="text-[11px] text-[#8E8E93] block mb-1">کۆی قەرزی زیادکراو</span>
                    <span className="text-sm font-extrabold text-[#F5F5F7]">
                      {formatMoney(statementData.period_total_debt, currency)}
                    </span>
                  </div>

                  <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] text-right">
                    <span className="text-[11px] text-[#8E8E93] block mb-1 font-bold text-emerald-500/80">کۆی پارەی وەرگیراو</span>
                    <span className="text-sm font-extrabold text-[#34C759]">
                      {formatMoney(statementData.period_total_payments, currency)}
                    </span>
                  </div>

                  <div className="bg-[#000000] p-3 rounded-2xl border border-[#34C759]/40 text-right">
                    <span className="text-[11px] text-[#34C759] font-bold block mb-1">باڵانسی کۆتایی (قەرز)</span>
                    <span className="text-sm font-black text-[#34C759]">
                      {formatMoney(statementData.closing_balance, currency)}
                    </span>
                  </div>
                </div>

                {/* On-screen Ledger Table Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8E8E93] font-bold border-b border-[#2C2C2E] pb-2 px-1">
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
                          className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              tx.type === 'DEBT_ADD' 
                                ? 'bg-[#2C2C2E] text-[#F5F5F7]' 
                                : 'bg-[#34C759]/20 text-[#34C759]'
                            }`}>
                              {tx.type === 'DEBT_ADD' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-extrabold ${
                                  tx.type === 'DEBT_ADD' ? 'text-[#F5F5F7]' : 'text-[#34C759]'
                                }`}>
                                  {tx.type === 'DEBT_ADD' ? 'پێدانی قەرز' : 'وەرگرتنەوەی قەرز'}
                                </span>
                                <span className="text-[10px] text-[#8E8E93] dir-ltr">
                                  #{index + 1}
                                </span>
                              </div>

                              {tx.note && (
                                <p className="text-[#8E8E93] text-[11px] mt-0.5">
                                  {tx.note}
                                </p>
                              )}

                              <div className="text-[10px] text-[#8E8E93] mt-1 flex flex-wrap items-center gap-2">
                                <span className="dir-ltr">{formatTimestamp(tx.timestamp)}</span>
                                <span>•</span>
                                <span className="font-bold text-[#F5F5F7]">
                                  بەکارهێنەر: {tx.created_by || 'system'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-between sm:items-end justify-between border-t sm:border-t-0 border-[#2C2C2E] pt-2 sm:pt-0">
                            <div className="text-left">
                              <span className="text-xs text-[#8E8E93] sm:hidden block">بڕی مامەڵە:</span>
                              <span className={`text-sm font-extrabold ${
                                tx.type === 'DEBT_ADD' ? 'text-[#F5F5F7]' : 'text-[#34C759]'
                              }`}>
                                {formatMoney(tx.amount, currency)}
                              </span>
                            </div>

                            <div className="text-left mt-0.5">
                              <span className="text-[10px] text-[#8E8E93]">
                                باڵانسی دوای مامەڵە: <strong className="text-[#F5F5F7]">{formatMoney(tx.running_balance, currency)}</strong>
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

          {/* Modal Footer Actions */}
          <div className="p-4 border-t border-[#2C2C2E] bg-[#1C1C1E] flex items-center gap-2">
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


      {/* 2. PRINT-ONLY CONTAINER - Beautiful High-Fidelity A4 PDF Invoice Template */}
      {statementData && (
        <div id="print-statement-container" className="hidden print:block w-full">
          
          {/* Logo & Market Branding Header Row */}
          <div className="flex justify-between items-center pb-6 border-b border-gray-200">
            {/* Left: Document type badge & logo shape */}
            <div className="flex items-center gap-5">
              {/* Premium custom book SVG logo */}
              <div className="w-20 h-20 rounded-2xl bg-[#EAF5F8] flex items-center justify-center border border-[#D5EBF0]">
                <svg viewBox="0 0 100 100" className="w-14 h-14 text-[#1385A2]" fill="currentColor">
                  <path d="M50,85 C38,65 20,65 10,65 L10,25 C20,25 38,25 50,45 C62,25 80,25 90,25 L90,65 C80,65 62,65 50,85 Z" fill="#1385A2" />
                  <path d="M50,85 L50,45" stroke="#FFFFFF" strokeWidth="2" />
                  <path d="M25,40 C35,40 45,43 50,47" stroke="#EAF5F8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
                  <path d="M75,40 C65,40 55,43 50,47" stroke="#EAF5F8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
                </svg>
              </div>

              {/* Document Info badge */}
              <div className="border border-gray-200 rounded-2xl p-3.5 bg-white text-center w-40">
                <div className="text-[10px] text-gray-400 font-extrabold mb-0.5">جۆری بەڵگە</div>
                <div className="text-sm font-black text-[#1385A2]">کەشفی حساب</div>
              </div>
            </div>

            {/* Right: Dynamic Market Branding Info */}
            <div className="text-right">
              <h1 className="text-3xl font-black text-[#1385A2] tracking-tight mb-1">{marketName}</h1>
              <p className="text-xs font-bold text-gray-400">{ownerLocation} &nbsp;&bull;&nbsp; <span className="dir-ltr inline-block font-mono">{ownerPhone}</span></p>
            </div>
          </div>

          {/* Core Title and subtitle */}
          <div className="pt-6 pb-6 text-right">
            <span className="text-[11px] text-[#1385A2] font-black tracking-wide uppercase">کەشفی حساب</span>
            <h2 className="text-2xl font-black text-gray-800 mt-1">کەشفی حسابی قەرز</h2>
            <p className="text-xs text-gray-400 mt-1 font-bold">وردەکاری هەموو مامەڵەکانی قەرزی کڕیار</p>
          </div>

          {/* Information Cards Grid (3 Columns) */}
          <div className="grid grid-cols-3 gap-4">
            {/* Card 1: Print Date */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white text-right">
              <span className="text-[10px] text-gray-400 font-extrabold block mb-1">بەرواری چاپ</span>
              <span className="text-xs font-black text-gray-800 dir-ltr inline-block">{getCurrentPrintDateTime()}</span>
            </div>

            {/* Card 2: Date Range */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white text-right">
              <span className="text-[10px] text-gray-400 font-extrabold block mb-1">ماوەی حساب</span>
              <span className="text-xs font-black text-gray-800">
                {fromDate && toDate 
                  ? `${formatPrintDate(fromDate)} بۆ ${formatPrintDate(toDate)}` 
                  : 'تەواوی مێژووی هەژمار'}
              </span>
            </div>

            {/* Card 3: Customer Details */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-white text-right">
              <span className="text-[10px] text-gray-400 font-extrabold block mb-1">ناوی کڕیار</span>
              <span className="text-xs font-black text-gray-800">
                {customer.name} {customer.latin_name ? `(${customer.latin_name})` : ''}
              </span>
            </div>
          </div>

          {/* Main Statement Ledger Table */}
          <table className="w-full border-collapse mt-8">
            <thead>
              <tr className="bg-[#1385A2] text-white text-xs font-black">
                {/* RTL: Index/Number column is far right, Date is far left */}
                <th className="py-3 px-5 text-center rounded-r-2xl w-[8%]">ژمارە</th>
                <th className="py-3 px-4 text-right w-[50%]">بابەت</th>
                <th className="py-3 px-4 text-left w-[22%]">نرخ</th>
                <th className="py-3 px-5 text-center rounded-l-2xl w-[20%]">بەروار</th>
              </tr>
            </thead>
            <tbody>
              {statementData.transactions.map((tx, index) => (
                <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors text-right text-xs">
                  {/* Row Index */}
                  <td className="py-3.5 px-5 text-center">
                    <div className="w-7 h-7 rounded-full bg-[#EAF5F8] text-[#1385A2] flex items-center justify-center font-black text-[11px] mx-auto">
                      {index + 1}
                    </div>
                  </td>
                  
                  {/* Note / Item Subject */}
                  <td className="py-3.5 px-4 text-right font-bold text-gray-800 text-sm leading-relaxed">
                    {getTxNotePrint(tx)}
                  </td>

                  {/* Price / Amount */}
                  <td className="py-3.5 px-4 text-left font-black text-[#1385A2] text-sm font-mono whitespace-nowrap">
                    {formatMoney(tx.amount, currency)}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-5 text-center font-bold text-gray-500 font-mono">
                    {formatPrintDate(tx.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Card Area & Signature Stamp Section */}
          <div className="flex justify-between items-end mt-12 pt-8 border-t border-gray-100 print-avoid-break">
            
            {/* Grand Total Debt Box (Left aligned in RTL, so left side of paper) */}
            <div className="flex items-center gap-4 bg-[#EAF5F8] border border-[#D5EBF0] rounded-3xl p-5 w-80 text-right">
              {/* Checked circle design */}
              <div className="w-12 h-12 rounded-full bg-[#1385A2] flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-extrabold mb-1">کۆی گشتی قەرز</div>
                <div className="text-2xl font-black text-[#1385A2]">
                  {formatMoney(statementData.closing_balance, currency)}
                </div>
              </div>
            </div>

            {/* Circular Official Stamp (Right aligned in RTL, so right side of paper) */}
            <div className="flex flex-col items-center justify-center p-2">
              <span className="text-[10px] text-gray-400 font-extrabold mb-2 uppercase tracking-wider">مۆری فەرمی</span>
              <div className="w-32 h-32 rounded-full border-4 border-dashed border-[#1385A2]/60 flex flex-col items-center justify-center text-center p-2 relative rotate-[-6deg] bg-[#1385A2]/3">
                <div className="absolute inset-2 border border-dotted border-[#1385A2]/40 rounded-full"></div>
                <span className="text-[9px] font-black text-[#1385A2] leading-tight max-w-[100px] select-none">
                  {marketName}
                </span>
                <span className="text-[8px] text-gray-500 font-extrabold mt-1 select-none">
                  ناونیشان: {marketName?.includes('چنار') || settings?.market_name?.includes('چنار') ? 'دۆرێ' : 'کوردستان'}
                </span>
                <span className="text-[8px] text-gray-500 font-black mt-0.5 select-none font-mono dir-ltr">
                  {ownerPhone}
                </span>
              </div>
            </div>

          </div>

          {/* Running document footer */}
          <div className="mt-12 text-center border-t border-gray-100 pt-4 text-[10px] text-gray-400 font-extrabold">
            {marketName} &nbsp;&bull;&nbsp; {ownerLocation}
          </div>

        </div>
      )}
    </>
  );
};
