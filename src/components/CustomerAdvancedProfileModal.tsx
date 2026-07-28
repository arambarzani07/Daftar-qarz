import React, { useState, useEffect } from 'react';
import { Customer, Transaction, CustomerAdvancedProfileData, StatementData } from '../types';
import { formatMoney, formatTimestamp } from '../utils/formatters';
import { authenticatedFetch } from '../utils/apiClient';
import { 
  X, FileText, UserCheck, ShieldAlert, HeartPulse, 
  Handshake, Bell, Paperclip, AlertTriangle, History, 
  Share2, Send, Download, Plus, CheckCircle, Clock, Lock, Unlock, Edit3, Trash2, Printer,
  Calendar, Filter, RefreshCw, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

interface CustomerAdvancedProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  transactions: Transaction[];
  marketName: string;
  onCustomerUpdated?: () => void;
  userRole?: string;
  userPermissions?: string[];
}

export const CustomerAdvancedProfileModal: React.FC<CustomerAdvancedProfileModalProps> = ({
  isOpen,
  onClose,
  customer,
  transactions,
  marketName,
  onCustomerUpdated,
  userRole,
  userPermissions
}) => {
  const isManager = userRole === 'MARKET_MANAGER' || !userRole;
  const hasPermission = (perm: string) => isManager || !!(userPermissions?.includes(perm));

  const [activeTab, setActiveTab] = useState<'summary' | 'statement' | 'info' | 'credit' | 'risk' | 'promises' | 'reminders' | 'attachments' | 'disputes' | 'audit'>('summary');
  const [profileData, setProfileData] = useState<CustomerAdvancedProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit customer form state
  const [editName, setEditName] = useState(customer.name);
  const [editLatinName, setEditLatinName] = useState(customer.latin_name || '');
  const [editPhone, setEditPhone] = useState(customer.phone || '');
  const [editWhatsapp, setEditWhatsapp] = useState(customer.whatsapp || '');
  const [editAddress, setEditAddress] = useState(customer.address || '');
  const [editNotes, setEditNotes] = useState(customer.notes || '');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>(customer.status || 'ACTIVE');
  const [savingInfo, setSavingInfo] = useState(false);

  // Credit settings form state
  const [limitIqd, setLimitIqd] = useState('0');
  const [limitUsd, setLimitUsd] = useState('0');
  const [creditPolicy, setCreditPolicy] = useState<'NONE' | 'SOFT' | 'HARD'>('NONE');
  const [lockStatus, setLockStatus] = useState<'ACTIVE' | 'SOFT_WARNING' | 'LOCKED' | 'TEMPORARY_UNLOCK'>('ACTIVE');
  const [savingCredit, setSavingCredit] = useState(false);

  // New Promise form state
  const [promiseAmt, setPromiseAmt] = useState('');
  const [promiseCurr, setPromiseCurr] = useState<'IQD' | 'USD'>('IQD');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseNote, setPromiseNote] = useState('');
  const [addingPromise, setAddingPromise] = useState(false);

  // New Reminder form state
  const [reminderDate, setReminderDate] = useState('');
  const [reminderReason, setReminderReason] = useState('');
  const [addingReminder, setAddingReminder] = useState(false);

  // New Dispute form state
  const [disputeTitle, setDisputeTitle] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeTxId, setDisputeTxId] = useState('');
  const [addingDispute, setAddingDispute] = useState(false);

  // New Attachment state
  const [attFileName, setAttFileName] = useState('');
  const [attDesc, setAttDesc] = useState('');
  const [attDataUrl, setAttDataUrl] = useState('');
  const [addingAtt, setAddingAtt] = useState(false);

  // Statement Tab state
  const [stmtCurrency, setStmtCurrency] = useState<'IQD' | 'USD'>(customer.currency || 'IQD');
  const [stmtFromDate, setStmtFromDate] = useState('');
  const [stmtToDate, setStmtToDate] = useState('');
  const [stmtType, setStmtType] = useState<'ALL' | 'DEBT_ADD' | 'PAYMENT_RECEIVE'>('ALL');
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [stmtLoading, setStmtLoading] = useState(false);

  const fetchStatement = async () => {
    setStmtLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('currency', stmtCurrency);
      if (stmtFromDate) params.append('from_date', stmtFromDate);
      if (stmtToDate) params.append('to_date', stmtToDate);
      if (stmtType !== 'ALL') params.append('type', stmtType);

      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/statement?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setStatementData(json.data);
      }
    } catch {
      console.error('Failed to load statement data');
    } finally {
      setStmtLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'statement') {
      fetchStatement();
    }
  }, [isOpen, activeTab, stmtCurrency, stmtFromDate, stmtToDate, stmtType, customer.id]);

  const fetchAdvancedProfile = async () => {
    setLoading(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/advanced-profile`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setProfileData(json.data);
        const c = json.data.customer;
        setEditName(c.name || '');
        setEditLatinName(c.latin_name || '');
        setEditPhone(c.phone || '');
        setEditWhatsapp(c.whatsapp || '');
        setEditAddress(c.address || '');
        setEditNotes(c.notes || '');
        setEditStatus(c.status || 'ACTIVE');

        const cs = json.data.credit_settings;
        if (cs) {
          setLimitIqd(cs.limit_iqd?.toString() || '0');
          setLimitUsd(cs.limit_usd?.toString() || '0');
          setCreditPolicy(cs.policy || 'NONE');
          setLockStatus(cs.lock_status || 'ACTIVE');
        }
      } else {
        setError(json.message || 'خوێندنەوەی زانیاری سەرکەوتوو نەبوو');
      }
    } catch (err) {
      setError('پەیوەندی لەگەڵ سێرڤەر پچڕا');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdvancedProfile();
    }
  }, [isOpen, customer.id]);

  if (!isOpen) return null;

  const validTxs = transactions.filter((t) => !t.reversed);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          latin_name: editLatinName,
          phone: editPhone,
          whatsapp: editWhatsapp,
          address: editAddress,
          notes: editNotes,
          status: editStatus
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchAdvancedProfile();
        if (onCustomerUpdated) onCustomerUpdated();
      } else {
        alert(json.message);
      }
    } catch {
      alert('خەزنکردن سەرکەوتوو نەبوو');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCredit(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/credit-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit_iqd: Number(limitIqd) || 0,
          limit_usd: Number(limitUsd) || 0,
          policy: creditPolicy,
          lock_status: lockStatus
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchAdvancedProfile();
        if (onCustomerUpdated) onCustomerUpdated();
      } else {
        alert(json.message);
      }
    } catch {
      alert('نوێکردنەوەی سنووری قەرز سەرکەوتوو نەبوو');
    } finally {
      setSavingCredit(false);
    }
  };

  const handleAddPromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promiseAmt || !promiseDate) return;
    setAddingPromise(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/promises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(promiseAmt),
          currency: promiseCurr,
          promised_date: promiseDate,
          note: promiseNote
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setPromiseAmt('');
        setPromiseNote('');
        fetchAdvancedProfile();
      } else alert(json.message);
    } catch {
      alert('تۆمارکردن سەرکەوتوو نەبوو');
    } finally {
      setAddingPromise(false);
    }
  };

  const handleUpdatePromiseStatus = async (promiseId: string, status: string) => {
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/promises/${promiseId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (json.status === 'success') fetchAdvancedProfile();
    } catch {
      alert('نوێکردنەوە سەرکەوتوو نەبوو');
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDate) return;
    setAddingReminder(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          follow_up_date: reminderDate,
          reason: reminderReason
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setReminderReason('');
        fetchAdvancedProfile();
      } else alert(json.message);
    } catch {
      alert('تۆمارکردن سەرکەوتوو نەبوو');
    } finally {
      setAddingReminder(false);
    }
  };

  const handleUpdateReminderStatus = async (remId: string, status: string) => {
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/reminders/${remId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (json.status === 'success') fetchAdvancedProfile();
    } catch {
      alert('نوێکردنەوە سەرکەوتوو نەبوو');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attFileName) return;
    setAddingAtt(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: attFileName,
          file_type: 'image/png',
          file_data_url: attDataUrl,
          description: attDesc
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setAttFileName('');
        setAttDesc('');
        setAttDataUrl('');
        fetchAdvancedProfile();
      } else alert(json.message);
    } catch {
      alert('تۆمارکردن سەرکەوتوو نەبوو');
    } finally {
      setAddingAtt(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم هاوپێچە؟')) return;
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/attachments/${attId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.status === 'success') fetchAdvancedProfile();
    } catch {
      alert('سڕینەوە سەرکەوتوو نەبوو');
    }
  };

  const handleAddDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTitle) return;
    setAddingDispute(true);
    try {
      const custId = encodeURIComponent(customer.id);
      const res = await authenticatedFetch(`/api/customers/${custId}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: disputeTitle,
          description: disputeDesc,
          transaction_id: disputeTxId || undefined
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setDisputeTitle('');
        setDisputeDesc('');
        setDisputeTxId('');
        fetchAdvancedProfile();
      } else alert(json.message);
    } catch {
      alert('تۆمارکردن سەرکەوتوو نەبوو');
    } finally {
      setAddingDispute(false);
    }
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
    link.setAttribute('download', `statement_${customer.name}_${stmtCurrency}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedIqd = formatMoney(customer.balance_iqd, 'IQD');
  const formattedUsd = formatMoney(customer.balance_usd, 'USD');

  const navItems = [
    { id: 'summary', label: 'کورتەی هەژمار', icon: HeartPulse },
    { id: 'statement', label: 'کەشف حساب', icon: FileText },
    { id: 'info', label: 'زانیاری کڕیار', icon: UserCheck },
    { id: 'credit', label: 'سنووری قەرز', icon: Lock },
    { id: 'risk', label: 'مەترسی و متمانە', icon: ShieldAlert },
    { id: 'promises', label: 'بەڵێنی پارەدان', icon: Handshake },
    { id: 'reminders', label: 'یادخستنەوە', icon: Bell },
    { id: 'attachments', label: 'بەڵگە و هاوپێچ', icon: Paperclip },
    { id: 'disputes', label: 'کێشەکان', icon: AlertTriangle },
    { id: 'audit', label: 'مێژووی چاڵاکی', icon: History },
  ] as const;

  const visibleNavItems = navItems.filter((item) => {
    if (item.id === 'audit') {
      return isManager || hasPermission('VIEW_ANALYTICS');
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[#1C1C1E] rounded-3xl border border-[#2C2C2E] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up text-[#F5F5F7]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2C2C2E] bg-[#1C1C1E] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#34C759]" />
            <div>
              <h3 className="text-base font-extrabold text-[#F5F5F7]">
                پڕۆفایلی پێشکەوتووی کڕیار
              </h3>
              <p className="text-xs text-[#8E8E93]">{customer.name} (کۆد: {customer.seq_num})</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex overflow-x-auto gap-1 p-2 bg-[#000000] border-b border-[#2C2C2E] no-scrollbar">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active 
                    ? 'bg-[#2C2C2E] text-[#34C759] border border-[#34C759]/30 shadow-xs' 
                    : 'text-[#8E8E93] hover:text-[#F5F5F7] hover:bg-[#1C1C1E]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#34C759]' : 'text-[#8E8E93]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {loading && (
            <div className="py-12 text-center text-xs text-[#8E8E93] flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-[#34C759]" />
              <span>لەبارکردنی زانیارییەکانی پڕۆفایلی پێشکەوتوو...</span>
            </div>
          )}

          {!loading && profileData && (
            <>
              {/* TAB 1: SUMMARY */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E]">
                      <span className="text-xs text-[#8E8E93] block mb-1">کۆی قەرزی دینار (IQD)</span>
                      <span className="text-lg font-extrabold text-[#34C759]">{formattedIqd}</span>
                    </div>
                    <div className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E]">
                      <span className="text-xs text-[#8E8E93] block mb-1">کۆی قەرزی دۆلار (USD)</span>
                      <span className="text-lg font-extrabold text-[#34C759]">{formattedUsd}</span>
                    </div>
                  </div>

                  <div className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-2">
                    <h4 className="text-xs font-bold text-[#8E8E93] mb-2 border-b border-[#2C2C2E] pb-2">
                      کۆمەڵە ئاماری دارایی
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[#8E8E93] block">کۆی زیاکراوی قەرز (IQD):</span>
                        <span className="font-bold text-[#F5F5F7]">{formatMoney(profileData.financial_summary.total_debt_iqd, 'IQD')}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8E93] block">کۆی پارەی وەرگیراو (IQD):</span>
                        <span className="font-bold text-[#34C759]">{formatMoney(profileData.financial_summary.total_payments_iqd, 'IQD')}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8E93] block">گەورەترین قەرز (IQD):</span>
                        <span className="font-bold text-[#F5F5F7]">{formatMoney(profileData.financial_summary.largest_debt_iqd, 'IQD')}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8E93] block">گەورەترین واسیلی (IQD):</span>
                        <span className="font-bold text-[#34C759]">{formatMoney(profileData.financial_summary.largest_payment_iqd, 'IQD')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-2">
                    <h4 className="text-xs font-bold text-[#8E8E93] mb-2 border-b border-[#2C2C2E] pb-2">
                      تەندروستی دارایی و ڕەفتار
                    </h4>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">ڕۆژ لە دوایین پارەدان:</span>
                        <span className="font-bold text-[#F5F5F7]">
                          {profileData.money_health.days_since_last_payment !== null ? `${profileData.money_health.days_since_last_payment} ڕۆژ` : 'هیچ'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">ڕەوتی گەشەی قەرز:</span>
                        <span className="font-bold text-[#34C759]">{profileData.money_health.debt_growth_trend}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">دۆخی گشتی:</span>
                        <span className="font-bold text-[#F5F5F7]">{profileData.money_health.status_message}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STATEMENT */}
              {activeTab === 'statement' && (
                <div className="space-y-4">
                  {/* Currency & Filter Header */}
                  <div className="p-3 bg-[#000000] border border-[#2C2C2E] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 bg-[#1C1C1E] p-1 rounded-xl border border-[#2C2C2E]">
                        <button
                          onClick={() => setStmtCurrency('IQD')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            stmtCurrency === 'IQD'
                              ? 'bg-[#34C759] text-black shadow-xs'
                              : 'text-[#8E8E93] hover:text-[#F5F5F7]'
                          }`}
                        >
                          دیناری عێراقی (IQD)
                        </button>
                        <button
                          onClick={() => setStmtCurrency('USD')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            stmtCurrency === 'USD'
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
                        >
                          <Download className="w-3.5 h-3.5 text-[#34C759]" />
                          <span>CSV</span>
                        </button>
                        <button
                          onClick={handlePrint}
                          disabled={!statementData}
                          className="px-2.5 py-1.5 bg-[#34C759] hover:bg-[#2EB14E] text-black text-xs font-extrabold rounded-xl flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>پرینت</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-[#1C1C1E]">
                      <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
                        <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                        <span className="text-[#8E8E93] whitespace-nowrap text-[10px]">لە:</span>
                        <input
                          type="date"
                          value={stmtFromDate}
                          onChange={(e) => setStmtFromDate(e.target.value)}
                          className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
                        <Calendar className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                        <span className="text-[#8E8E93] whitespace-nowrap text-[10px]">بۆ:</span>
                        <input
                          type="date"
                          value={stmtToDate}
                          onChange={(e) => setStmtToDate(e.target.value)}
                          className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded-xl border border-[#2C2C2E]">
                        <Filter className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
                        <select
                          value={stmtType}
                          onChange={(e) => setStmtType(e.target.value as any)}
                          className="bg-transparent text-[#F5F5F7] w-full focus:outline-none text-xs"
                        >
                          <option value="ALL" className="bg-[#1C1C1E]">هەموو مامەڵەکان</option>
                          <option value="DEBT_ADD" className="bg-[#1C1C1E]">پێدانی قەرز (+)</option>
                          <option value="PAYMENT_RECEIVE" className="bg-[#1C1C1E]">وەرگرتنەوەی قەرز (-)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {stmtLoading && (
                    <div className="py-8 text-center text-xs text-[#8E8E93] flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#34C759]" />
                      <span>لەبارکردنی کەشف حساب...</span>
                    </div>
                  )}

                  {!stmtLoading && statementData && (
                    <>
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E]">
                          <span className="text-[10px] text-[#8E8E93] block mb-1">باڵانسی سەرەتا</span>
                          <span className="font-extrabold text-[#F5F5F7]">
                            {formatMoney(statementData.opening_balance, stmtCurrency)}
                          </span>
                        </div>
                        <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E]">
                          <span className="text-[10px] text-[#8E8E93] block mb-1">کۆی قەرزی زیادکراو</span>
                          <span className="font-extrabold text-[#F5F5F7]">
                            {formatMoney(statementData.period_total_debt, stmtCurrency)}
                          </span>
                        </div>
                        <div className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E]">
                          <span className="text-[10px] text-[#8E8E93] block mb-1">کۆی پارەی وەرگیراو</span>
                          <span className="font-extrabold text-[#34C759]">
                            {formatMoney(statementData.period_total_payments, stmtCurrency)}
                          </span>
                        </div>
                        <div className="bg-[#000000] p-3 rounded-2xl border border-[#34C759]/40">
                          <span className="text-[10px] text-[#34C759] font-bold block mb-1">باڵانسی کۆتایی</span>
                          <span className="font-black text-[#34C759]">
                            {formatMoney(statementData.closing_balance, stmtCurrency)}
                          </span>
                        </div>
                      </div>

                      {/* Running Balance List */}
                      <div className="space-y-2">
                        {statementData.transactions.length === 0 ? (
                          <div className="text-center py-8 text-xs text-[#8E8E93] bg-[#000000] rounded-2xl border border-[#2C2C2E]">
                            هیچ مامەڵەیەک لەم ماوەیەدا نەدۆزرایەوە
                          </div>
                        ) : (
                          statementData.transactions.map((tx, idx) => (
                            <div
                              key={tx.id}
                              className="bg-[#000000] p-3 rounded-2xl border border-[#2C2C2E] flex items-center justify-between text-xs"
                            >
                              <div className="flex items-start gap-2">
                                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                  tx.type === 'DEBT_ADD' ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'bg-[#34C759]/20 text-[#34C759]'
                                }`}>
                                  {tx.type === 'DEBT_ADD' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                  <div className="font-bold text-[#F5F5F7]">
                                    {tx.type === 'DEBT_ADD' ? 'پێدانی قەرز' : 'وەرگرتنەوەی قەرز'}
                                  </div>
                                  {tx.note && <div className="text-[#8E8E93] text-[11px] mt-0.5">{tx.note}</div>}
                                  <div className="text-[10px] text-[#8E8E93] mt-0.5 flex items-center gap-2">
                                    <span className="dir-ltr">{formatTimestamp(tx.timestamp)}</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-bold">بەکارهێنەر: {tx.created_by || 'خاوەن کار'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className={`font-extrabold ${tx.type === 'DEBT_ADD' ? 'text-[#F5F5F7]' : 'text-[#34C759]'}`}>
                                  {formatMoney(tx.amount, tx.currency)}
                                </div>
                                <div className="text-[10px] text-[#8E8E93] mt-0.5">
                                  باڵانس: <strong className="text-[#F5F5F7]">{formatMoney(tx.running_balance, tx.currency)}</strong>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: CUSTOMER INFO */}
              {activeTab === 'info' && (() => {
                const canEditInfo = hasPermission('ADD_CUSTOMER');
                return (
                  <form onSubmit={handleSaveInfo} className="space-y-3 bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] text-xs">
                    <div>
                      <label className="text-[#8E8E93] block mb-1 font-bold">ناوی تەواوی قەرزدار *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!canEditInfo}
                        className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">ناوی لاتینی</label>
                        <input
                          type="text"
                          value={editLatinName}
                          onChange={(e) => setEditLatinName(e.target.value)}
                          disabled={!canEditInfo}
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">ژمارەی تەلەفۆن</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          disabled={!canEditInfo}
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] dir-ltr ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">واتساپ</label>
                        <input
                          type="text"
                          value={editWhatsapp}
                          onChange={(e) => setEditWhatsapp(e.target.value)}
                          disabled={!canEditInfo}
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] dir-ltr ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">دۆخی هەژمار</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as any)}
                          disabled={!canEditInfo}
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <option value="ACTIVE">چالاک</option>
                          <option value="INACTIVE">ناچالاک</option>
                          <option value="ARCHIVED">ئەرشیڤکراو</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[#8E8E93] block mb-1 font-bold">ناونیشان</label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        disabled={!canEditInfo}
                        className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div>
                      <label className="text-[#8E8E93] block mb-1 font-bold">تێبینی سەرەکی</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        disabled={!canEditInfo}
                        rows={2}
                        className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditInfo ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    {!canEditInfo ? (
                      <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>تۆ دەسەڵاتی دەستکاریی زانیارییەکانی کڕیارت نییە.</span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={savingInfo}
                        className="w-full py-2.5 bg-[#34C759] text-black font-extrabold rounded-xl hover:bg-[#2EB14E] transition-all"
                      >
                        {savingInfo ? 'لە خەزنکردندایە...' : 'خەزنکردنی گۆڕانکارییەکان'}
                      </button>
                    )}
                  </form>
                );
              })()}

              {/* TAB 4: CREDIT LIMIT & LOCK */}
              {activeTab === 'credit' && (() => {
                const canEditCredit = hasPermission('MANAGE_CREDIT_LIMIT');
                return (
                  <form onSubmit={handleSaveCredit} className="space-y-4 bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] text-xs">
                    <h4 className="font-bold text-[#34C759] border-b border-[#2C2C2E] pb-2 flex items-center gap-1.5">
                      <Lock className="w-4 h-4" />
                      <span>کۆنتڕۆڵی سنووری قەرز و قفڵکردنی هەژمار</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">سنووری قەرز (IQD)</label>
                        <input
                          type="number"
                          value={limitIqd}
                          onChange={(e) => setLimitIqd(e.target.value)}
                          disabled={!canEditCredit}
                          placeholder="0 = بێ سنوور"
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditCredit ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-[#8E8E93] block mb-1 font-bold">سنووری قەرز ($ USD)</label>
                        <input
                          type="number"
                          value={limitUsd}
                          onChange={(e) => setLimitUsd(e.target.value)}
                          disabled={!canEditCredit}
                          placeholder="0 = بێ سنوور"
                          className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditCredit ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[#8E8E93] block mb-1 font-bold">سیاسەتی سنووردارکردن</label>
                      <select
                        value={creditPolicy}
                        onChange={(e) => setCreditPolicy(e.target.value as any)}
                        disabled={!canEditCredit}
                        className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditCredit ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="NONE">هیچ (ئاگاداری یان ڕاگرتن نییە)</option>
                        <option value="SOFT">ئاگاداری نەرم (ڕێگە بە زیادکردنی قەرز دەدات)</option>
                        <option value="HARD">ڕاگرتنی توند (ڕێگری لە قەرزی نوێ دەکات)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[#8E8E93] block mb-1 font-bold">دۆخی قفڵکردنی هەژمار</label>
                      <select
                        value={lockStatus}
                        onChange={(e) => setLockStatus(e.target.value as any)}
                        disabled={!canEditCredit}
                        className={`w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2.5 text-[#F5F5F7] focus:outline-none focus:border-[#34C759] ${!canEditCredit ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="ACTIVE">ئاسایی و چالاک</option>
                        <option value="SOFT_WARNING">ئاگاداری نەرم</option>
                        <option value="LOCKED">🔒 قفڵکراو - ڕێگری تەواو لە قەرزی نوێ</option>
                        <option value="TEMPORARY_UNLOCK">🔓 کراوەی کاتی</option>
                      </select>
                    </div>

                    {!canEditCredit ? (
                      <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>تۆ دەسەڵاتی دەستکاریی سنوری قەرزی کڕیارت نییە.</span>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={savingCredit}
                        className="w-full py-2.5 bg-[#34C759] text-black font-extrabold rounded-xl hover:bg-[#2EB14E]"
                      >
                        {savingCredit ? 'نوێکردنەوە...' : 'خەزنکردنی بەڕێوەبردنی قەرز'}
                      </button>
                    )}
                  </form>
                );
              })()}

              {/* TAB 5: RISK & TRUST */}
              {activeTab === 'risk' && (
                <div className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
                    <span className="font-bold text-[#F5F5F7]">نمرەی متمانە و مەترسی (0-100)</span>
                    <span className={`px-3 py-1 rounded-full font-extrabold text-xs ${
                      profileData.risk_assessment.risk_level === 'LOW' ? 'bg-[#34C759]/20 text-[#34C759]' :
                      profileData.risk_assessment.risk_level === 'MEDIUM' ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]' :
                      profileData.risk_assessment.risk_level === 'HIGH' ? 'bg-[#FF3B30]/20 text-[#FF3B30]' :
                      'bg-[#2C2C2E] text-[#8E8E93]'
                    }`}>
                      {profileData.risk_assessment.risk_level === 'LOW' ? 'مەترسی کەم (متمانەی بەرز)' :
                       profileData.risk_assessment.risk_level === 'MEDIUM' ? 'مەترسی مامناوەند' :
                       profileData.risk_assessment.risk_level === 'HIGH' ? 'مەترسی بەرز' :
                       profileData.risk_assessment.risk_level === 'CRITICAL' ? 'مەترسی زۆر خەتەرناک' :
                       'زانیاری نەگونجاو'}
                    </span>
                  </div>

                  {profileData.risk_assessment.score !== null ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[#8E8E93]">نمرەی ئۆتۆماتیکی متمانە:</span>
                        <span className="text-xl font-black text-[#34C759]">{profileData.risk_assessment.score} / 100</span>
                      </div>
                      <div className="p-3 bg-[#1C1C1E] rounded-xl border border-[#2C2C2E] text-[#F5F5F7]">
                        <span className="text-[#8E8E93] block mb-1">هۆکارە کاریگەرەکان:</span>
                        <p>{profileData.risk_assessment.explanation}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-[#8E8E93]">
                      {profileData.risk_assessment.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: PROMISES */}
              {activeTab === 'promises' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddPromise} className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
                    <h4 className="font-bold text-[#34C759]">تۆمارکردنی بەڵێنی پارەدان</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="بڕی پارە *"
                        value={promiseAmt}
                        onChange={(e) => setPromiseAmt(e.target.value)}
                        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7] focus:outline-none"
                        required
                      />
                      <select
                        value={promiseCurr}
                        onChange={(e) => setPromiseCurr(e.target.value as any)}
                        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                      >
                        <option value="IQD">IQD (دینار)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                      <input
                        type="date"
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7] focus:outline-none"
                        required
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="تێبینی تەنیشت بەڵێن"
                      value={promiseNote}
                      onChange={(e) => setPromiseNote(e.target.value)}
                      className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                    />
                    <button
                      type="submit"
                      disabled={addingPromise}
                      className="w-full py-2 bg-[#34C759] text-black font-extrabold rounded-xl"
                    >
                      {addingPromise ? 'لە تۆمارکردندایە...' : '+ تۆمارکردنی بەڵێنی نوێ'}
                    </button>
                  </form>

                  <div className="space-y-2">
                    {profileData.promises.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[#8E8E93]">هیچ بەڵێنێک تۆمار نەکراوە</div>
                    ) : (
                      profileData.promises.map((p) => (
                        <div key={p.id} className="bg-[#000000] p-3 rounded-xl border border-[#2C2C2E] flex items-center justify-between text-xs">
                          <div>
                            <div className="font-extrabold text-[#F5F5F7]">
                              {formatMoney(p.amount, p.currency)} — بەروار: {p.promised_date}
                            </div>
                            {p.note && <div className="text-[#8E8E93] text-[11px]">{p.note}</div>}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === 'FULFILLED' ? 'bg-[#34C759]/20 text-[#34C759]' :
                              p.status === 'BROKEN' ? 'bg-[#FF3B30]/20 text-[#FF3B30]' :
                              'bg-[#2C2C2E] text-[#8E8E93]'
                            }`}>
                              {p.status === 'FULFILLED' ? 'جێبەجێکراو' : p.status === 'BROKEN' ? 'پەیمانشکێنراو' : 'چاوەڕوانکراو'}
                            </span>
                            {p.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleUpdatePromiseStatus(p.id, 'FULFILLED')}
                                  className="p-1 bg-[#34C759]/20 text-[#34C759] rounded hover:bg-[#34C759]/30"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleUpdatePromiseStatus(p.id, 'BROKEN')}
                                  className="p-1 bg-[#FF3B30]/20 text-[#FF3B30] rounded hover:bg-[#FF3B30]/30"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: REMINDERS & WHATSAPP DRAFT */}
              {activeTab === 'reminders' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddReminder} className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
                    <h4 className="font-bold text-[#34C759]">دواندن و یادخستنەوەی نوێ</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                        required
                      />
                      <input
                        type="text"
                        placeholder="هۆکاری یادخستنەوە"
                        value={reminderReason}
                        onChange={(e) => setReminderReason(e.target.value)}
                        className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                      />
                    </div>
                    <button type="submit" disabled={addingReminder} className="w-full py-2 bg-[#34C759] text-black font-extrabold rounded-xl">
                      + زیاکردنی یادخستنەوە
                    </button>
                  </form>

                  <div className="space-y-2">
                    {profileData.reminders.map((r) => (
                      <div key={r.id} className="bg-[#000000] p-3 rounded-xl border border-[#2C2C2E] flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-[#F5F5F7]">{r.follow_up_date}</span>
                          {r.reason && <div className="text-[#8E8E93] text-[11px]">{r.reason}</div>}
                        </div>
                        <button
                          onClick={() => handleUpdateReminderStatus(r.id, r.status === 'PENDING' ? 'COMPLETED' : 'PENDING')}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${r.status === 'COMPLETED' ? 'bg-[#34C759]/20 text-[#34C759]' : 'bg-[#2C2C2E] text-[#8E8E93]'}`}
                        >
                          {r.status === 'COMPLETED' ? 'تەواوکراوە' : 'چاڵاک'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 8: ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddAttachment} className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
                    <h4 className="font-bold text-[#34C759]">بارکردنی بەڵگە یان فۆتۆی وەسڵ</h4>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="block w-full text-xs text-[#8E8E93] file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#2C2C2E] file:text-[#F5F5F7]"
                    />
                    <input
                      type="text"
                      placeholder="تێبینی یان وەسفی بەڵگەکە"
                      value={attDesc}
                      onChange={(e) => setAttDesc(e.target.value)}
                      className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                    />
                    <button type="submit" disabled={addingAtt || !attFileName} className="w-full py-2 bg-[#34C759] text-black font-extrabold rounded-xl">
                      + پاشەکەوتکردنی بەڵگە
                    </button>
                  </form>

                  <div className="grid grid-cols-2 gap-2">
                    {profileData.attachments.map((att) => (
                      <div key={att.id} className="bg-[#000000] p-3 rounded-xl border border-[#2C2C2E] text-xs relative group">
                        {att.file_data_url && (
                          <img src={att.file_data_url} alt={att.file_name} className="w-full h-24 object-cover rounded-lg mb-2" />
                        )}
                        <div className="font-bold text-[#F5F5F7] truncate">{att.file_name}</div>
                        {att.description && <div className="text-[10px] text-[#8E8E93]">{att.description}</div>}
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="mt-2 text-[10px] text-[#FF3B30] hover:underline flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>سڕینەوە</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 9: DISPUTES */}
              {activeTab === 'disputes' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddDispute} className="bg-[#000000] p-4 rounded-2xl border border-[#2C2C2E] space-y-3 text-xs">
                    <h4 className="font-bold text-[#FF3B30]">تۆمارکردنی کێشە یان ناڕەزایی</h4>
                    <input
                      type="text"
                      placeholder="سەردێڕی ناڕەزایی *"
                      value={disputeTitle}
                      onChange={(e) => setDisputeTitle(e.target.value)}
                      className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                      required
                    />
                    <textarea
                      placeholder="ڕوونکردنەوەی ناڕەزایی..."
                      value={disputeDesc}
                      onChange={(e) => setDisputeDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-2 text-[#F5F5F7]"
                    />
                    <button type="submit" disabled={addingDispute} className="w-full py-2 bg-[#FF3B30] text-white font-extrabold rounded-xl">
                      + تۆمارکردنی کێشە
                    </button>
                  </form>

                  <div className="space-y-2">
                    {profileData.disputes.map((d) => (
                      <div key={d.id} className="bg-[#000000] p-3 rounded-xl border border-[#2C2C2E] text-xs">
                        <div className="flex justify-between font-bold text-[#F5F5F7]">
                          <span>{d.title}</span>
                          <span className="text-[#FF9F0A]">{d.status === 'RESOLVED' ? 'چارەسەرکراو' : d.status === 'OPEN' ? 'کراوە' : d.status}</span>
                        </div>
                        {d.description && <p className="text-[#8E8E93] mt-1">{d.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 10: AUDIT LOG */}
              {activeTab === 'audit' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#8E8E93] mb-2">مێژووی چاڵاکییە هەستیارەکان ({profileData.audit_logs.length})</h4>
                  {profileData.audit_logs.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8E8E93]">هیچ چاڵاکییەکی هەستیار تۆمار نەکراوە</div>
                  ) : (
                    profileData.audit_logs.map((log) => (
                      <div key={log.id} className="bg-[#000000] p-3 rounded-xl border border-[#2C2C2E] text-xs flex justify-between items-start">
                        <div>
                          <span className="font-extrabold text-[#34C759]">{log.action_type}</span>
                          <p className="text-[#F5F5F7] mt-0.5">{log.description}</p>
                          <span className="text-[10px] text-[#8E8E93]">ئەنجامدراوە لەلایەن: {log.performed_by}</span>
                        </div>
                        <span className="text-[10px] text-[#8E8E93] dir-ltr">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
};
