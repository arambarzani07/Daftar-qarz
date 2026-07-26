import React, { useState, useEffect } from 'react';
import { Customer, Transaction, PaymentPromise, CustomerReminder, CurrencyType } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { LogOut, RefreshCw, User, Phone, DollarSign, Calendar, Bell, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

interface CustomerPortalViewProps {
  customerId: string;
  onLogout: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({ customerId, onLogout }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCustomerData = async () => {
    setIsRefreshing(true);
    try {
      const custId = encodeURIComponent(customerId);
      const res = await authenticatedFetch(`/api/customers/${custId}/advanced-profile`);
      const json = await res.json();
      if (json.status === 'success') {
        setCustomer(json.data.customer);
        setTransactions(json.data.transactions || []);
        setPromises(json.data.payment_promises || []);
        setReminders(json.data.reminders || []);
        setErrorMessage(null);
      } else {
        setErrorMessage(json.message || 'ناتوانرێت داتای هەژمار بهێنرێت');
      }
    } catch (err) {
      console.error('Failed to load customer profile:', err);
      setErrorMessage('خەتایەک ڕوویدا لە پەیوەندیکردن بە سێرڤەر');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <span className="text-sm font-semibold text-[#8E8E93]">تکایە چاوەڕێ بکە، زانیارییەکانت دەهێنرێن...</span>
      </div>
    );
  }

  if (errorMessage || !customer) {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#1C1C1E] rounded-3xl p-6 border border-[#2C2C2E] text-center space-y-4">
          <p className="text-sm text-rose-400 font-bold">{errorMessage || 'کڕیار نەدۆزرایەوە'}</p>
          <button
            onClick={onLogout}
            className="w-full py-3 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] rounded-2xl font-bold text-sm transition-all"
          >
            چوونەدەرەوە
          </button>
        </div>
      </div>
    );
  }

  const activeCurrency: CurrencyType = customer.currency || 'IQD';
  const balance = activeCurrency === 'USD' ? customer.balance_usd : customer.balance_iqd;

  return (
    <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col pb-safe">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#1C1C1E]/90 backdrop-blur-md border-b border-[#2C2C2E] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-base">
            {customer.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-1.5">
              <span>{customer.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">کڕیار</span>
            </h1>
            <span className="text-xs text-[#8E8E93] dir-ltr text-right">{customer.phone}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomerData}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] transition-colors"
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>چوونەدەرەوە</span>
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

        {/* Transaction History */}
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-[#F5F5F7] flex items-center gap-2 px-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>مێژووی مامەڵەکان و قەرزەکان ({transactions.length})</span>
          </h2>

          {transactions.length === 0 ? (
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-8 text-center text-[#8E8E93] text-xs font-medium">
              هیچ مامەڵەیەک تۆمار نەکراوە
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isPayment = tx.type === 'PAYMENT_RECEIVE';
                return (
                  <div key={tx.id} className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isPayment ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {isPayment ? '↓' : '↑'}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[#F5F5F7]">{tx.description || (isPayment ? 'پێدانی پارە' : 'زیادکردنی قەرز')}</h3>
                        <span className="text-[11px] text-[#8E8E93] mt-0.5 block">{formatTimestamp(tx.timestamp)}</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className={`text-sm font-extrabold ${isPayment ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPayment ? '-' : '+'}{formatMoney(tx.amount, tx.currency)}
                      </span>
                      {tx.reversed && (
                        <span className="block text-[10px] text-rose-400 font-bold">هەڵوەشاوەتەوە</span>
                      )}
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
