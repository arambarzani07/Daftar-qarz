import React, { useState, useEffect } from 'react';
import { Customer, StatementData, AppSettings } from '../types';
import { formatMoney } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { RefreshCw, Printer, X, Check } from 'lucide-react';

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

interface PrintStatementPageProps {
  onClose?: () => void;
}

export const PrintStatementPage: React.FC<PrintStatementPageProps> = () => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [marketName, setMarketName] = useState<string>('سوپەرمارکێتی کانی چنار');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Parse query params
  const getQueryParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      customerId: params.get('customerId') || '',
      currency: (params.get('currency') as 'IQD' | 'USD') || 'IQD',
      fromDate: params.get('fromDate') || '',
      toDate: params.get('toDate') || '',
      filterType: params.get('filterType') || 'ALL',
    };
  };

  const { customerId, currency, fromDate, toDate, filterType } = getQueryParams();

  useEffect(() => {
    const loadData = async () => {
      if (!customerId) {
        setError('کۆدی کڕیار دیاری نەکراوە');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Fetch customer details
        const custRes = await authenticatedFetch(`/api/customers/${encodeURIComponent(customerId)}`);
        const custJson = await custRes.json();
        if (custJson.status !== 'success' || !custJson.data) {
          throw new Error(custJson.message || 'زانیاری کڕیار نەدۆزرایەوە');
        }
        setCustomer(custJson.data);

        // 2. Fetch statement data
        const params = new URLSearchParams();
        params.append('currency', currency);
        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        if (filterType !== 'ALL') params.append('type', filterType);

        const stmtRes = await authenticatedFetch(`/api/customers/${encodeURIComponent(customerId)}/statement?${params.toString()}`);
        const stmtJson = await stmtRes.json();
        if (stmtJson.status !== 'success' || !stmtJson.data) {
          throw new Error(stmtJson.message || 'خوێندنەوەی کەشف حساب سەرکەوتوو نەبوو');
        }
        setStatementData(stmtJson.data);

        // 3. Fetch summary/settings
        const summaryRes = await authenticatedFetch('/api/market/summary');
        const summaryJson = await summaryRes.json();
        if (summaryJson.status === 'success' && summaryJson.data) {
          setSettings(summaryJson.data.settings || null);
          const activeContextStr = localStorage.getItem('zhirox_active_context');
          let tenantName = '';
          if (activeContextStr) {
            try {
              const parsed = JSON.parse(activeContextStr);
              tenantName = parsed.tenant_name || '';
            } catch {}
          }
          setMarketName(tenantName || summaryJson.data.market_name || summaryJson.data.settings?.market_name || 'سوپەرمارکێتی کانی چنار');
        }

      } catch (err: any) {
        console.error('Failed to load print statement data:', err);
        setError(err.message || 'هەڵەیەک ڕوویدا لە کاتی بارکردنی زانیارییەکان');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [customerId, currency, fromDate, toDate, filterType]);

  // Trigger browser printing once data is loaded
  useEffect(() => {
    if (!loading && statementData && customer) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000); // 1s delay to make sure rendering and fonts are fully stabilized
      return () => clearTimeout(timer);
    }
  }, [loading, statementData, customer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-gray-800 font-sans antialiased" dir="rtl">
        <RefreshCw className="w-10 h-10 animate-spin text-[#1385A2] mb-4" />
        <h2 className="text-lg font-black mb-1">ئامادەکردنی لاپەڕەی چاپ...</h2>
        <p className="text-xs text-gray-400">زانیارییەکان لە سێرڤەر باردەکرێن و فایلی چاپ ئامادە دەکرێت.</p>
      </div>
    );
  }

  if (error || !customer || !statementData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-gray-800 font-sans antialiased" dir="rtl">
        <div className="max-w-md border border-red-100 p-8 rounded-3xl space-y-4 shadow-sm bg-red-50/20">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto">
            <X className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-red-600">هەڵە ڕوویدا</h2>
          <p className="text-xs text-gray-500 leading-relaxed">{error || 'زانیاریی کڕیار یان کەشف حساب نەدۆزرایەوە'}</p>
          <button
            onClick={() => window.close()}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
          >
            داخستنی ئەم لاپەڕەیە
          </button>
        </div>
      </div>
    );
  }

  // Dynamic values based on market settings
  const ownerPhone = settings?.owner_phone || '07504048383';
  const ownerLocation = settings?.market_name?.includes('چنار') || marketName.includes('چنار')
    ? 'دۆرێ - بارزان' 
    : 'کوردستان';

  // Filter transactions to only include debt additions ("قەرز پێدان") and NOT payments ("پارەدان")
  const printedTransactions = statementData.transactions.filter(
    (tx: any) => tx.type === 'DEBT_ADD' || tx.type === 'OPENING_BALANCE' || tx.type === 'ADJUSTMENT_DEBIT'
  );

  const printedTotal = printedTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

  // Format transaction name for print table row
  const getTxNotePrint = (tx: any) => {
    let baseLabel = '';
    if (tx.type === 'DEBT_ADD') baseLabel = 'قەرزی نوێ';
    else if (tx.type === 'OPENING_BALANCE') baseLabel = 'دەستپێکی حساب';
    else if (tx.type === 'ADJUSTMENT_DEBIT') baseLabel = 'ڕاستکردنەوە (+)';
    else baseLabel = 'قەرزی نوێ';

    if (tx.note && tx.note.trim()) {
      return tx.note.trim();
    }
    return baseLabel;
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased p-4 sm:p-10" dir="rtl">
      
      {/* Dynamic Print Styles for A4 Layout */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm 15mm 15mm 15mm;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top action bar - Hidden during print */}
      <div className="max-w-4xl mx-auto mb-8 p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1385A2] animate-pulse"></div>
          <span className="text-xs font-bold text-gray-500">پێشبینینی پسوولەی چاپ (کەشف حسابی قەرز بەبێ پارەدان)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#1385A2] hover:bg-[#0E6A82] text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>پرینتکردنەوە</span>
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <X className="w-4 h-4" />
            <span>داخستن</span>
          </button>
        </div>
      </div>

      {/* Main Printable Container */}
      <div className="max-w-4xl mx-auto bg-white p-2">
        
        {/* Logo & Market Branding Header Row */}
        <div className="flex justify-between items-center pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {/* Premium custom book SVG logo */}
            <div className="w-16 h-16 rounded-[20px] bg-[#EAF5F8] flex items-center justify-center border border-[#D5EBF0]">
              <svg viewBox="0 0 100 100" className="w-11 h-11 text-[#1385A2]" fill="currentColor">
                <path d="M50,85 C38,65 20,65 10,65 L10,25 C20,25 38,25 50,45 C62,25 80,25 90,25 L90,65 C80,65 62,65 50,85 Z" fill="#1385A2" />
                <path d="M50,85 L50,45" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M25,40 C35,40 45,43 50,47" stroke="#EAF5F8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
                <path d="M75,40 C65,40 55,43 50,47" stroke="#EAF5F8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
              </svg>
            </div>

            {/* Document Info badge */}
            <div className="border border-gray-200 rounded-2xl px-5 py-3 bg-white text-center min-w-[130px]">
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
              <th className="py-3 px-5 text-center rounded-r-2xl w-[8%]">ژمارە</th>
              <th className="py-3 px-4 text-right w-[50%]">بابەت</th>
              <th className="py-3 px-4 text-left w-[22%]">نرخ</th>
              <th className="py-3 px-5 text-center rounded-l-2xl w-[20%]">بەروار</th>
            </tr>
          </thead>
          <tbody>
            {printedTransactions.map((tx, index) => (
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

                {/* Price / Amount with word Currency */}
                <td className="py-3.5 px-4 text-left">
                  <div className="flex items-center justify-start gap-1 font-mono text-sm font-black text-[#1385A2]">
                    <span>{Number(tx.amount || 0).toLocaleString('en-US')}</span>
                    <span className="text-gray-400 font-bold text-xs">{currency === 'IQD' ? 'دینار' : '$'}</span>
                  </div>
                </td>

                {/* Date */}
                <td className="py-3.5 px-5 text-center font-bold text-gray-500 font-mono">
                  {formatPrintDate(tx.timestamp)}
                </td>
              </tr>
            ))}
            {printedTransactions.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-xs text-gray-400 font-bold">
                  هیچ مامەڵەیەکی قەرز پێدان لەم ماوەیەدا نەدۆزرایەوە
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bottom Card Area & Signature Stamp Section */}
        <div className="flex justify-between items-end mt-12 pt-8 border-t border-gray-100 print-avoid-break">
          
          {/* Left: Beautiful Grand Total Box inside double line or clean badge */}
          <div className="flex items-center gap-4 bg-[#EAF5F8]/70 border border-[#D5EBF0] rounded-[24px] p-5 w-80 text-right">
            <div className="w-12 h-12 rounded-full bg-[#1385A2] flex items-center justify-center shrink-0 shadow-sm text-white">
              <Check className="w-6 h-6 stroke-[3px]" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-extrabold mb-1">کۆی گشتی قەرز</div>
              <div className="text-2xl font-black text-[#1385A2]">
                {Number(statementData.closing_balance).toLocaleString('en-US')}{' '}
                <span className="text-sm font-bold text-gray-400">{currency === 'IQD' ? 'دینار' : 'دۆلار'}</span>
              </div>
            </div>
          </div>

          {/* Right: Circular Official Rubber Stamp (Perfect replication of the PDF) */}
          <div className="flex flex-col items-center justify-center p-2">
            <span className="text-[10px] text-gray-400 font-black mb-2 uppercase tracking-wider">مۆری فەرمی</span>
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* High fidelity SVG of the exact traditional rubber ink stamp */}
              <svg viewBox="0 0 150 150" className="w-36 h-36 text-blue-700 select-none drop-shadow-sm opacity-90 transform -rotate-[4deg]">
                {/* Outermost clean circle */}
                <circle cx="75" cy="75" r="70" fill="none" stroke="#1d4ed8" strokeWidth="2.5" />
                
                {/* Ring of stars inside */}
                <circle cx="75" cy="75" r="63" fill="none" stroke="#1d4ed8" strokeWidth="1" strokeDasharray="4 2" />
                
                {/* Arc text definitions */}
                <defs>
                  {/* Top arc path */}
                  <path id="stamp-top-arc-path" d="M 18,75 A 57,57 0 0,1 132,75" fill="none" />
                  {/* Bottom arc path */}
                  <path id="stamp-bottom-arc-path" d="M 132,75 A 57,57 0 0,1 18,75" fill="none" />
                  
                  {/* Star arc paths */}
                  <path id="stamp-top-stars-path" d="M 23,75 A 52,52 0 0,1 127,75" fill="none" />
                  <path id="stamp-bottom-stars-path" d="M 127,75 A 52,52 0 0,1 23,75" fill="none" />
                </defs>

                {/* Stars border path */}
                <text fill="#1d4ed8" fontSize="8" fontWeight="bold" letterSpacing="3">
                  <textPath href="#stamp-top-stars-path" startOffset="50%" textAnchor="middle">
                    ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
                  </textPath>
                </text>

                {/* Top Curved Text: Store Name */}
                <text fill="#1d4ed8" fontSize="10.5" fontWeight="900" letterSpacing="0.5" textAnchor="middle">
                  <textPath href="#stamp-top-arc-path" startOffset="50%">
                    {marketName}
                  </textPath>
                </text>

                {/* Center Text: Address */}
                <text x="75" y="73" fill="#1d4ed8" fontSize="9" fontWeight="bold" textAnchor="middle">
                  ناونیشان : دۆرێ
                </text>

                {/* Bottom phone icon and number */}
                <text x="75" y="90" fill="#1d4ed8" fontSize="9" fontWeight="900" textAnchor="middle" letterSpacing="0.2" className="font-mono">
                  📞 {ownerPhone}
                </text>

                {/* Bottom Curved Text: Stars or additional line */}
                <text fill="#1d4ed8" fontSize="8" fontWeight="bold" letterSpacing="3">
                  <textPath href="#stamp-bottom-stars-path" startOffset="50%" textAnchor="middle">
                    ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★
                  </textPath>
                </text>
              </svg>
            </div>
          </div>

        </div>

        {/* Running document footer */}
        <div className="mt-12 text-center border-t border-gray-100 pt-4 text-[10px] text-gray-400 font-extrabold">
          {marketName} &nbsp;&bull;&nbsp; {ownerLocation}
        </div>

      </div>

    </div>
  );
};
