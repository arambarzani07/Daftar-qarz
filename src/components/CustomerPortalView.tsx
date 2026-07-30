import React, { useState, useEffect } from 'react';
import { Customer, Transaction, PaymentPromise, CustomerReminder, CustomerDispute, CurrencyType } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { LogOut, RefreshCw, User, Phone, DollarSign, Calendar, Bell, ShieldCheck, CheckCircle2, Clock, Lock, ShieldAlert, AlertTriangle, MessageSquare, Send, Sun, Moon } from 'lucide-react';

interface CustomerPortalViewProps {
  customerId?: string;
  token?: string;
  onLogout: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({ customerId, token, onLogout }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [disputes, setDisputes] = useState<CustomerDispute[]>([]);
  const [creditSettings, setCreditSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // PIN state for public token
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // New Dispute / Chat message state
  const [disputeTitle, setDisputeTitle] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeTxId, setDisputeTxId] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const fetchCustomerData = async (pin?: string) => {
    setIsRefreshing(true);
    try {
      if (token) {
        let url = `/api/public/customer-balance/${token}`;
        if (pin) {
          url += `?pin=${encodeURIComponent(pin)}`;
        }
        const res = await fetch(url);
        const json = await res.json();

        if (json.status === 'pin_required') {
          setPinRequired(true);
          if (pin) {
            setPinError('پین کۆدەکە هەڵەیە، تکایە دووبارە هەوڵبدەرەوە.');
          }
        } else if (json.status === 'success') {
          const d = json.data;
          setCustomer({
            id: 'public',
            market_id: '',
            name: d.customer_name,
            phone: '',
            currency: d.currency || 'IQD',
            balance_iqd: d.balance_iqd,
            balance_usd: d.balance_usd,
            status: 'ACTIVE',
            created_at: '',
            updated_at: d.updated_at
          });
          setTransactions(d.transactions || []);
          setPromises([]);
          setDisputes([]);
          setReminders([]);
          setCreditSettings(d.credit_settings || null);
          setPinRequired(false);
          setErrorMessage(null);
          setPinError('');
        } else {
          setErrorMessage(json.message || 'ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.');
        }
      } else {
        const qs = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : '';
        const [resProf, resTx, resProm, resDisp, resNotif] = await Promise.all([
          authenticatedFetch(`/api/portal/profile${qs}`),
          authenticatedFetch(`/api/portal/transactions${qs}`),
          authenticatedFetch(`/api/portal/promises${qs}`),
          authenticatedFetch(`/api/portal/disputes${qs}`),
          authenticatedFetch(`/api/portal/notifications${qs}`)
        ]);

        const jsonProf = await resProf.json();
        const jsonTx = await resTx.json();
        const jsonProm = await resProm.json();
        const jsonDisp = await resDisp.json();
        const jsonNotif = await resNotif.json();

        if (jsonProf.status === 'success') {
          setCustomer(jsonProf.data.customer);
          setTransactions(jsonTx.status === 'success' ? jsonTx.data : []);
          setPromises(jsonProm.status === 'success' ? jsonProm.data : []);
          setDisputes(jsonDisp.status === 'success' ? jsonDisp.data : []);
          setReminders(jsonNotif.status === 'success' ? jsonNotif.data : []);
          setCreditSettings(jsonProf.data.credit_settings || null);
          setErrorMessage(null);
        } else {
          setErrorMessage(jsonProf.message || 'ناتوانرێت داتای هەژمار بهێنرێت');
        }
      }
    } catch (err) {
      console.error('Failed to load customer profile:', err);
      setErrorMessage('خەتایەک ڕوویدا لە پەیوەندیکردن بە سێرڤەر');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setIsLoading(true);
    fetchCustomerData(pinInput.trim());
  };

  const handleSendDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTitle.trim()) return;
    setSubmittingDispute(true);
    try {
      const qs = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : '';
      const res = await authenticatedFetch(`/api/portal/disputes${qs}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customerId ? { 'x-customer-id': customerId } : {})
        },
        body: JSON.stringify({
          title: disputeTitle.trim(),
          description: disputeDesc.trim(),
          transaction_id: disputeTxId || undefined
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setDisputeTitle('');
        setDisputeDesc('');
        setDisputeTxId('');
        await fetchCustomerData();
      } else {
        alert(json.message || 'هەڵە لە ناردنی تێبینی/کێشە');
      }
    } catch (err) {
      console.error('Error sending dispute:', err);
      alert('خەتایەک ڕوویدا');
    } finally {
      setSubmittingDispute(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();

    if (token) {
      const handleFocus = () => {
        fetchCustomerData(pinInput);
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [customerId, token, pinInput]);

  if (isLoading && !customer && !pinRequired && !errorMessage) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <span className="text-sm font-semibold text-[#8E8E93]">تکایە چاوەڕێ بکە، زانیارییەکانت دەهێنرێن...</span>
      </div>
    );
  }

  // PIN Prompt State for Public Share Token
  if (pinRequired && !customer) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6">
        <form
          onSubmit={handlePinSubmit}
          className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] flex flex-col gap-4 animate-scale-in"
        >
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center mb-1">
              <Lock className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h1 className="text-base font-bold text-[#F5F5F7]">لاپەڕەی پارێزراوی هەژمار</h1>
            <p className="text-xs text-[#8E8E93]">تکایە پین کۆد بنووسە بۆ بینینی باڵانسی هەژمارەکەت</p>
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="password"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError('');
              }}
              placeholder="پین کۆد بنووسە..."
              className="w-full bg-black text-[#F5F5F7] text-center text-lg tracking-widest p-3.5 rounded-2xl border border-[#2C2C2E] focus:outline-none focus:border-purple-400"
            />
            {pinError && (
              <span className="text-xs text-rose-400 font-semibold text-center mt-1">{pinError}</span>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#2C2C2E] text-[#F5F5F7] border border-[#3A3A3C] font-bold text-sm rounded-xl active-scale"
          >
            دڵنیابوونەوە
          </button>
        </form>
      </div>
    );
  }

  if (errorMessage || !customer) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-900/30 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm text-rose-400 font-bold">{errorMessage || 'کڕیار نەدۆزرایەوە یان بەستەرەکە کۆتایی هاتووە'}</p>
          <button
            onClick={onLogout}
            className="w-full py-3 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] rounded-2xl font-bold text-sm transition-all"
          >
            داخستن / چوونەدەرەوە
          </button>
        </div>
      </div>
    );
  }

  const activeCurrency: CurrencyType = customer.currency || 'IQD';
  const balance = activeCurrency === 'USD' ? customer.balance_usd : customer.balance_iqd;

  return (
    <div dir="rtl" className={`min-h-screen font-sans antialiased flex flex-col pb-safe transition-colors duration-200 ${
      isDarkMode ? 'bg-black text-[#F5F5F7]' : 'bg-[#F2F2F7] text-[#1C1C1E]'
    }`}>
      
      {/* Top Header */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 py-4 flex items-center justify-between transition-colors duration-200 ${
        isDarkMode ? 'bg-[#1C1C1E]/90 border-[#2C2C2E]' : 'bg-white/90 border-[#E5E5EA]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-base">
            {customer.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <h1 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDarkMode ? 'text-[#F5F5F7]' : 'text-[#1C1C1E]'}`}>
              <span>{customer.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">کڕیار</span>
            </h1>
            <span className={`text-xs ${isDarkMode ? 'text-[#8E8E93]' : 'text-[#6C6C70]'} dir-ltr text-right`}>{customer.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-xl transition-colors ${
              isDarkMode ? 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7]' : 'bg-[#E5E5EA] hover:bg-[#D1D1D6] text-[#1C1C1E]'
            }`}
            title="گۆڕینی دۆخ (ڕووناک / تاریک)"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-600" />}
          </button>
          <button
            onClick={fetchCustomerData}
            disabled={isRefreshing}
            className={`p-2.5 rounded-xl transition-colors ${
              isDarkMode ? 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7]' : 'bg-[#E5E5EA] hover:bg-[#D1D1D6] text-[#1C1C1E]'
            }`}
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] rounded-3xl p-6 border border-[#3A3A3C] shadow-2xl relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">باڵانسی گشتی قەرز</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-black text-[#F5F5F7] tracking-tight">
              {formatMoney(balance, activeCurrency)}
            </div>
            <p className="text-xs text-[#8E8E93] font-medium">
              {balance > 0 ? 'بڕی قەرزی لەسەرە' : balance < 0 ? 'بڕی پارەی پێشەکی / قازانج هەیە' : 'هەژمار پاکە (هیچ قەرزێک نییە)'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[#3A3A3C]/60 grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[11px] text-[#8E8E93] font-medium">قەرزی دینار (IQD)</span>
              <span className="text-sm font-extrabold text-[#F5F5F7]">{formatMoney(customer.balance_iqd, 'IQD')}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#8E8E93] font-medium">قەرزی دۆلار ($)</span>
              <span className="text-sm font-extrabold text-[#F5F5F7]">{formatMoney(customer.balance_usd, 'USD')}</span>
            </div>
          </div>
        </div>

        {/* Credit Limit & Status Banner */}
        {(() => {
          const limitIqd = Number(creditSettings?.limit_iqd || 0);
          const limitUsd = Number(creditSettings?.limit_usd || 0);
          const currentIqd = Number(customer?.balance_iqd || 0);
          const currentUsd = Number(customer?.balance_usd || 0);
          const lockStatus = creditSettings?.lock_status || 'ACTIVE';
          const isLocked = lockStatus === 'LOCKED';

          const iqdPercent = limitIqd > 0 ? Math.min(100, Math.round((currentIqd / limitIqd) * 100)) : 0;
          const usdPercent = limitUsd > 0 ? Math.min(100, Math.round((currentUsd / limitUsd) * 100)) : 0;

          const exceedsIqd = limitIqd > 0 && currentIqd > limitIqd;
          const exceedsUsd = limitUsd > 0 && currentUsd > limitUsd;

          return (
            <div className={`p-4 rounded-3xl border transition-all ${
              isLocked 
                ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                : exceedsIqd || exceedsUsd
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-[#1C1C1E] border-[#2C2C2E] text-[#F5F5F7]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {isLocked ? (
                    <div className="w-8 h-8 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                  ) : exceedsIqd || exceedsUsd ? (
                    <div className="w-8 h-8 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-2xl bg-[#34C759]/20 text-[#34C759] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-black flex items-center gap-1.5">
                      <span>سنووری قەرزی دیاریکراو و چاودێری</span>
                      {isLocked && <span className="px-2 py-0.5 rounded-full bg-red-500 text-black text-[10px] font-extrabold">قفڵکراو</span>}
                    </div>
                    <div className="text-[11px] text-[#8E8E93]">
                      {limitIqd > 0 || limitUsd > 0 ? 'سنووری فەرمی لەلایەن مەملەکەت / مارکێت دیاریکراوە' : 'بێ سنووری فەرمی (No Limit)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Limit Details Grid */}
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#2C2C2E]/60 text-xs">
                {/* IQD Limit */}
                <div className="bg-black/30 p-3 rounded-2xl">
                  <div className="flex justify-between items-center text-[11px] text-[#8E8E93] mb-1 font-bold">
                    <span>IQD سنووری دینار</span>
                    <span>{limitIqd > 0 ? `${iqdPercent}%` : 'بێ سنوور'}</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[#F5F5F7]">
                    {limitIqd > 0 ? `${formatMoney(limitIqd, 'IQD')} د.ع` : 'بێ سنوور'}
                  </div>
                  {limitIqd > 0 && (
                    <div className="w-full bg-[#2C2C2E] h-2 rounded-full mt-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${exceedsIqd ? 'bg-red-500' : iqdPercent > 80 ? 'bg-amber-500' : 'bg-[#34C759]'}`}
                        style={{ width: `${Math.min(100, iqdPercent)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* USD Limit */}
                <div className="bg-black/30 p-3 rounded-2xl">
                  <div className="flex justify-between items-center text-[11px] text-[#8E8E93] mb-1 font-bold">
                    <span>USD سنووری دۆلار</span>
                    <span>{limitUsd > 0 ? `${usdPercent}%` : 'بێ سنوور'}</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-[#F5F5F7]">
                    {limitUsd > 0 ? `$${limitUsd.toLocaleString()}` : 'بێ سنوور'}
                  </div>
                  {limitUsd > 0 && (
                    <div className="w-full bg-[#2C2C2E] h-2 rounded-full mt-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${exceedsUsd ? 'bg-red-500' : usdPercent > 80 ? 'bg-amber-500' : 'bg-[#34C759]'}`}
                        style={{ width: `${Math.min(100, usdPercent)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Message */}
              {(exceedsIqd || exceedsUsd || isLocked) && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-2xl text-xs text-red-300 font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <span>
                    {isLocked 
                      ? 'ئاگاداری: هەژماری قەرزی ئەم کڕیارە قفڵکراوە.' 
                      : 'ئاگاداری: قەرزەکە تێپەڕی بەسەر سنووری دیاریکراودا!'}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Reminders & Notifications */}
        {reminders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-2 px-1">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>ئاگادارکردنەوەکان و یادخستنەوەکان ({reminders.length})</span>
            </h2>
            <div className="space-y-2">
              {reminders.map((rem) => (
                <div key={rem.id} className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#F5F5F7]">{rem.reason}</p>
                    <span className="text-[11px] text-[#8E8E93] mt-1 block">بەروار: {formatTimestamp(rem.follow_up_date)}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${rem.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {rem.status === 'COMPLETED' ? 'تەواوکراو' : 'چاوەڕوانکراو'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Promises */}
        {promises.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-2 px-1">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>بەڵێنەکانی ددانەوە ({promises.length})</span>
            </h2>
            <div className="space-y-2">
              {promises.map((p) => (
                <div key={p.id} className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-[#F5F5F7]">{formatMoney(p.amount, p.currency)}</span>
                    <p className="text-xs text-[#8E8E93] mt-0.5">{p.note || 'بەڵێنی پێدان'}</p>
                    <span className="text-[10px] text-[#8E8E93] mt-1 block">بەروار: {formatTimestamp(p.promised_date)}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    p.status === 'FULFILLED' ? 'bg-emerald-500/10 text-emerald-400' :
                    p.status === 'BROKEN' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {p.status === 'FULFILLED' ? 'جێبەجێکراو' : p.status === 'BROKEN' ? 'شکێنراو' : 'چاوەڕوانکراو'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-App Direct Chat & Dispute Resolution */}
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-2 px-1">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>چاتی ڕاستەوخۆ و ناکۆکی و تێبینی پسوولەکان ({disputes.length})</span>
          </h2>

          {/* New Dispute / Message Form */}
          <form onSubmit={handleSendDispute} className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-4 space-y-3 text-xs">
            <div className="font-bold text-[#F5F5F7] flex items-center gap-1.5">
              <span>ناردنی تێبینی یان پرسیار لەبارەی پسوولە یان قەرز</span>
            </div>
            <input
              type="text"
              placeholder="سەردێڕی تێبینی یان ناکۆکی (بۆ نموونە: هەڵە لە پسوولەی ژمارە...)"
              value={disputeTitle}
              onChange={(e) => setDisputeTitle(e.target.value)}
              className="w-full bg-black/40 border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] placeholder-[#8E8E93]"
              required
            />
            <textarea
              placeholder="ڕوونکردنەوەی تەواو بنووسە بۆ مارکێت..."
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              rows={2}
              className="w-full bg-black/40 border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] placeholder-[#8E8E93]"
            />
            <button
              type="submit"
              disabled={submittingDispute}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{submittingDispute ? 'دەنێردرێت...' : 'ناردنی تێبینی بۆ مارکێت'}</span>
            </button>
          </form>

          {/* Existing Disputes List */}
          {disputes.length === 0 ? (
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 text-center text-[#8E8E93] text-xs font-medium">
              هیچ تێبینی یان ناکۆکییەک تۆمار نەکراوە
            </div>
          ) : (
            <div className="space-y-2">
              {disputes.map((d) => (
                <div key={d.id} className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#F5F5F7] text-sm">{d.title}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      d.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400' :
                      d.status === 'UNDER_REVIEW' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {d.status === 'RESOLVED' ? 'چارەسەرکراو' : d.status === 'UNDER_REVIEW' ? 'لە ژێر لێکۆڵینەوە' : 'کراوە'}
                    </span>
                  </div>
                  {d.description && (
                    <p className="text-[#8E8E93] text-xs font-medium leading-relaxed">{d.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2E]/60 text-[10px] text-[#8E8E93]">
                    <span>ناردراو لەلایەن: {d.created_by || 'کڕیار'}</span>
                    <span>{formatTimestamp(d.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>مێژووی مامەڵەکان و قەرزەکان</span>
            </h2>
            <span className="text-[10px] text-[#8E8E93]">({transactions.length} مامەڵە)</span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 bg-[#1C1C1E]/40 rounded-2xl border border-[#2C2C2E] text-[#8E8E93] text-xs font-medium">
              هیچ مامەڵەیەک تۆمار نەکراوە
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transactions.map((tx) => {
                const isDebt = tx.type === 'DEBT_ADD';
                return (
                  <div key={tx.id} className="w-full flex">
                    <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] text-[#F5F5F7] transition-all">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-extrabold tracking-tight">
                          {isDebt ? '+ ' : '- '}
                          {formatMoney(tx.amount, tx.currency)}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${isDebt ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {isDebt ? 'زیادکردنی قەرز' : 'پێدانی پارە'}
                        </span>
                      </div>

                      <div className="w-full h-[1px] my-2 bg-[#3A3A3C]/50" />

                      {tx.note && (
                        <div className="text-xs font-medium leading-relaxed mb-1 opacity-90">
                          {tx.note}
                        </div>
                      )}

                      {tx.reversed && (
                        <div className="text-[10px] text-rose-400 font-bold mb-1">
                          (ئەم مامەڵەیە هەڵوەشاوەتەوە)
                        </div>
                      )}

                      <div className="text-[10px] mt-2 pt-2 border-t border-[#3A3A3C]/40 flex items-center justify-between text-[#8E8E93]">
                        <span className="font-bold">بەکارهێنەر: {tx.created_by || 'خاوەن کار'}</span>
                        <span className="dir-ltr tracking-wide">{formatTimestamp(tx.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
