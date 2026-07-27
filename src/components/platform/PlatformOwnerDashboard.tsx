import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  Plus, 
  KeyRound, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  UserPlus, 
  LogOut, 
  RefreshCw, 
  ExternalLink, 
  Phone, 
  Mail, 
  Lock,
  Copy,
  Check,
  Sparkles,
  Database,
  ChevronLeft,
  X,
  Trash2
} from 'lucide-react';
import { PlatformMarket, PlatformManager, PlatformOverview, AuthorizedContext } from '../../types';
import { AccountOperationsCenter } from './AccountOperationsCenter';

interface PlatformOwnerDashboardProps {
  onLogout: () => void;
  currentIdentity?: string;
}

export const PlatformOwnerDashboard: React.FC<PlatformOwnerDashboardProps> = ({
  onLogout,
  currentIdentity = ''
}) => {
  const [activeTab, setActiveTab] = useState<'ACCOUNT_OPERATIONS' | 'MARKETS' | 'MANAGERS'>('ACCOUNT_OPERATIONS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Overview data
  const [overview, setOverview] = useState<PlatformOverview>({
    total_markets: 0,
    active_markets: 0,
    suspended_markets: 0,
    expired_licenses: 0,
    total_managers: 0,
    total_customers: 0
  });

  // Markets & Managers lists
  const [markets, setMarkets] = useState<PlatformMarket[]>([]);
  const [managers, setManagers] = useState<PlatformManager[]>([]);

  // Modals state
  const [isAddMarketOpen, setIsAddMarketOpen] = useState(false);
  const [selectedMarketForLicense, setSelectedMarketForLicense] = useState<PlatformMarket | null>(null);
  const [selectedMarketForManager, setSelectedMarketForManager] = useState<PlatformMarket | null>(null);
  const [activationModal, setActivationModal] = useState<{
    marketName: string;
    managerName: string;
    managerPhone: string;
    activationUrl: string;
  } | null>(null);

  // New Market Form State
  const [useSamePhone, setUseSamePhone] = useState(true);
  const [newMarket, setNewMarket] = useState({
    name: '',
    registered_phone: '',
    manager_name: '',
    manager_login_phone: '',
    manager_email: '',
    currency: 'IQD' as 'IQD' | 'USD',
    license_days: 365
  });

  // New Manager Form State
  const [newManager, setNewManager] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'MARKET_MANAGER' as 'MARKET_MANAGER' | 'EMPLOYEE'
  });

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Load platform data
  const loadPlatformData = async () => {
    setRefreshing(true);
    try {
      const [resOverview, resMarkets, resManagers] = await Promise.all([
        fetch('/api/platform/overview', { headers: getAuthHeaders() }).then(async r => {
          const ct = r.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return { status: 'error', message: 'وەڵامی سێرڤەر بە شێوازی JSON نەنێردراوە' };
          const text = await r.text();
          try { return JSON.parse(text); } catch { return { status: 'error', message: 'وەڵامی سێرڤەر نادروستە' }; }
        }).catch(() => ({ status: 'error', message: 'پەیوەندی بە سێرڤەرەوە پچڕا' })),
        fetch('/api/platform/markets', { headers: getAuthHeaders() }).then(async r => {
          const ct = r.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return { status: 'error', message: 'وەڵامی سێرڤەر بە شێوازی JSON نەنێردراوە' };
          const text = await r.text();
          try { return JSON.parse(text); } catch { return { status: 'error', message: 'وەڵامی سێرڤەر نادروستە' }; }
        }).catch(() => ({ status: 'error', message: 'پەیوەندی بە سێرڤەرەوە پچڕا' })),
        fetch('/api/platform/managers', { headers: getAuthHeaders() }).then(async r => {
          const ct = r.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return { status: 'error', message: 'وەڵامی سێرڤەر بە شێوازی JSON نەنێردراوە' };
          const text = await r.text();
          try { return JSON.parse(text); } catch { return { status: 'error', message: 'وەڵامی سێرڤەر نادروستە' }; }
        }).catch(() => ({ status: 'error', message: 'پەیوەندی بە سێرڤەرەوە پچڕا' }))
      ]);

      if (resOverview?.status === 'success' && resOverview.data) {
        setOverview(resOverview.data);
      } else if (resOverview?.status === 'error') {
        setActionMessage({ text: resOverview.message || 'هەڵە لە وەرگرتنی ئاماری سەرەکی', type: 'error' });
      }

      if (resMarkets?.status === 'success') {
        const d = resMarkets.data;
        if (Array.isArray(d)) {
          setMarkets(d);
        } else if (d && Array.isArray(d.items)) {
          setMarkets(d.items);
        }
      }

      if (resManagers?.status === 'success') {
        const d = resManagers.data;
        if (Array.isArray(d)) {
          setManagers(d);
        } else if (d && Array.isArray(d.items)) {
          setManagers(d.items);
        }
      }
    } catch (err) {
      console.error('Error fetching platform data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  // Handle Create Market
  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarket.name || !newMarket.manager_name) {
      setActionMessage({ type: 'error', text: 'تکایە ناوی فەرمی مارکێت و ناوی بەڕێوەبەری سەرەتایی پڕبکەرەوە' });
      return;
    }

    const mName = newMarket.name.trim();
    const mgrName = newMarket.manager_name.trim();
    const mgrPhone = (useSamePhone ? newMarket.registered_phone : newMarket.manager_login_phone).trim();

    const payload = {
      name: mName,
      registered_phone: newMarket.registered_phone.trim(),
      manager_name: mgrName,
      manager_login_phone: mgrPhone,
      manager_email: newMarket.manager_email.trim(),
      currency: newMarket.currency,
      license_days: newMarket.license_days
    };

    try {
      const res = await fetch('/api/platform/markets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.status === 'success') {
        setActionMessage({ type: 'success', text: 'مارکێتی نوێ و هەژماری بەڕێوەبەری سەرەتایی بە سەرکەوتوویی دروستکرا!' });
        setIsAddMarketOpen(false);

        if (json.activation_url) {
          setActivationModal({
            marketName: mName,
            managerName: mgrName,
            managerPhone: mgrPhone,
            activationUrl: json.activation_url
          });
        }

        setNewMarket({
          name: '',
          registered_phone: '',
          manager_name: '',
          manager_login_phone: '',
          manager_email: '',
          currency: 'IQD',
          license_days: 365
        });
        setUseSamePhone(true);
        await loadPlatformData();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'دروستکردنی مارکێت سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە کاتی پەیوەندیکردن بە سێرڤەر' });
    }
  };

  // Handle Regenerate Activation Link
  const handleRegenerateActivation = async (m: PlatformMarket) => {
    try {
      const res = await fetch(`/api/platform/markets/${m.id}/regenerate-activation`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.status === 'success' && json.activation_url) {
        setActivationModal({
          marketName: m.name,
          managerName: m.owner_name,
          managerPhone: m.manager_login_phone || m.owner_phone || '',
          activationUrl: json.activation_url
        });
        setActionMessage({ type: 'success', text: 'بەستەری نوێی چالاککردن دروستکرا' });
      } else {
        setActionMessage({ type: 'error', text: json.message || 'دروستکردنەوەی بەستەر سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە سێرڤەر' });
    }
  };

  // Handle Cancel Activation
  const handleCancelActivation = async (marketId: string) => {
    try {
      const res = await fetch(`/api/platform/markets/${marketId}/cancel-activation`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (json.status === 'success') {
        setActionMessage({ type: 'success', text: 'چالاککردن لەگەڵ سەرکەوتوویی هەڵوەشێنرایەوە' });
        await loadPlatformData();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'هەڵوەشاندنەوە سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە سێرڤەر' });
    }
  };

  // Handle Update License
  const handleUpdateLicense = async (marketId: string, action: 'EXTEND_90' | 'EXTEND_365' | 'SUSPEND' | 'ACTIVATE') => {
    try {
      const res = await fetch(`/api/platform/markets/${marketId}/license`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setActionMessage({ type: 'success', text: json.message || 'مۆڵەتی مارکێت نوێکرایەوە' });
        setSelectedMarketForLicense(null);
        await loadPlatformData();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'گۆڕینی مۆڵەت سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە کاتی گۆڕینی مۆڵەت' });
    }
  };

  // State for Market Deletion Modal workflow
  const [marketToDelete, setMarketToDelete] = useState<PlatformMarket | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle Delete Market initiation
  const initiateDeleteMarket = (market: PlatformMarket) => {
    setMarketToDelete(market);
    setDeleteStep(1);
    setConfirmNameInput('');
  };

  // Execute confirmed market deletion / decommission
  const executeDeleteMarket = async () => {
    if (!marketToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/platform/markets/${marketToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ confirmation_name: confirmNameInput })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setActionMessage({ type: 'success', text: json.message || 'مارکێتەکە بە سەرکەوتوویی سڕایەوە' });
        setMarketToDelete(null);
        await loadPlatformData();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'سڕینەوەی مارکێت سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە کاتی سڕینەوەی مارکێت' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Add Manager
  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarketForManager || !newManager.full_name) {
      setActionMessage({ type: 'error', text: 'تکایە ناوی بەڕێوەبەر پڕبکەرەوە' });
      return;
    }

    try {
      const res = await fetch(`/api/platform/markets/${selectedMarketForManager.id}/managers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newManager)
      });
      const json = await res.json();
      if (json.status === 'success') {
        setActionMessage({ type: 'success', text: 'بەڕێوەبەری نوێ دیاریکرا بە سەرکەوتوویی!' });
        setSelectedMarketForManager(null);
        setNewManager({ full_name: '', email: '', phone: '', role: 'MARKET_MANAGER' });
        await loadPlatformData();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'زیادکردنی بەڕێوەبەر سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'هەڵەیەک ڕوویدا لە دانانی بەڕێوەبەر' });
    }
  };

  // Filtered Markets
  const filteredMarkets = markets.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div dir="rtl" className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#141416] text-[#F5F5F7] font-sans selection:bg-emerald-500/30">
      {/* Top Navigation Header */}
      <header className="bg-[#1C1C1E]/90 backdrop-blur-xl border-b border-[#2C2C2E] sticky top-0 z-30 px-3 sm:px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 flex items-center justify-center text-black font-extrabold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-400 rounded-full border-2 border-[#1C1C1E] animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-[#F5F5F7] tracking-tight truncate">پەیوەستگەی خاوەنی سیستەم</h1>
                <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide shrink-0">
                  Platform Owner
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#8E8E93] truncate">بەڕێوەبردنی گشتی مارکێتەکان، مۆڵەتەکان و بەڕێوەبەران</p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 border-[#2C2C2E] pt-2 sm:pt-0">
            <button
              onClick={loadPlatformData}
              disabled={refreshing}
              className="p-2 sm:p-2.5 rounded-xl bg-[#2C2C2E]/80 hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-[#F5F5F7] border border-[#3A3A3C]/50 transition-all active:scale-95 text-xs flex items-center gap-1.5"
              title="نوێکردنەوەی داتا"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="sm:hidden text-[11px]">نوێکردنەوە</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all text-xs font-bold active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>چوونەدەرەوە</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Toast / Notification Banner */}
        {actionMessage && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs md:text-sm font-semibold animate-in fade-in slide-in-from-top-2 shadow-lg ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/5'
          }`}>
            <div className="flex items-center gap-2.5">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button 
              onClick={() => setActionMessage(null)} 
              className="p-1 text-xs opacity-70 hover:opacity-100 hover:bg-[#2C2C2E] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Secure Platform Control Center Status Card */}
        <div className="bg-gradient-to-r from-[#1C1C1E] via-[#242428] to-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] transition-all rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm md:text-base font-extrabold text-[#F5F5F7]">ناوەندی کۆنتڕۆڵی پلاتفۆرم (Platform Control Plane)</h2>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-xs text-[#8E8E93]">بەڕێوەبردنی گشتی سیستەم بە پشتبەستن بە ناسنامەی سەلمێنراوی Supabase Auth و ڕەزامەندی پلاتفۆرم.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#2C2C2E]">
              <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>داتابەیسی PostgreSQL پەیوەستکراوە</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] p-3 sm:p-4 rounded-2xl space-y-2 sm:space-y-3 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#8E8E93]">
              <span className="text-[11px] sm:text-xs font-bold">کۆی مارکێتەکان</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black text-[#F5F5F7] tracking-tight">{overview.total_markets}</div>
            <p className="text-[10px] sm:text-[11px] text-[#8E8E93] font-medium truncate">تۆمارکراو لە سەرانسەری سیستەمدا</p>
          </div>

          <div className="bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] p-3 sm:p-4 rounded-2xl space-y-2 sm:space-y-3 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#8E8E93]">
              <span className="text-[11px] sm:text-xs font-bold">مۆڵەتە چالاکەکان</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black text-emerald-400 tracking-tight">{overview.active_markets}</div>
            <p className="text-[10px] sm:text-[11px] text-[#8E8E93] font-medium truncate">کاردەکەن بێ کێشە</p>
          </div>

          <div className="bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] p-3 sm:p-4 rounded-2xl space-y-2 sm:space-y-3 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#8E8E93]">
              <span className="text-[11px] sm:text-xs font-bold truncate">مۆڵەتی وەستاو</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black text-amber-400 tracking-tight">
              {overview.suspended_markets + overview.expired_licenses}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#8E8E93] font-medium truncate">پێویستی بە نوێکردنەوەیە</p>
          </div>

          <div className="bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] p-3 sm:p-4 rounded-2xl space-y-2 sm:space-y-3 transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#8E8E93]">
              <span className="text-[11px] sm:text-xs font-bold truncate">بەڕێوەبەران</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-black text-[#F5F5F7] tracking-tight">{overview.total_managers}</div>
            <p className="text-[10px] sm:text-[11px] text-[#8E8E93] font-medium truncate">سەرپەرشتیاری تۆمارکراو</p>
          </div>
        </div>

        {/* Tab Selection Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2C2C2E] pb-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('ACCOUNT_OPERATIONS')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'ACCOUNT_OPERATIONS'
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>بەڕێوەبردنی هەژمارەکان (Account Ops)</span>
            </button>
            <button
              onClick={() => setActiveTab('MARKETS')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'MARKETS'
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>مارکێتەکان ({markets.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('MANAGERS')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'MANAGERS'
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'text-[#8E8E93] hover:text-[#F5F5F7]'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>بەڕێوەبەران ({managers.length})</span>
            </button>
          </div>

          {activeTab === 'MARKETS' && (
            <button
              onClick={() => setIsAddMarketOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>دروستکردنی مارکێتی نوێ</span>
            </button>
          )}
        </div>

        {/* TAB 0: ACCOUNT OPERATIONS CENTER */}
        {activeTab === 'ACCOUNT_OPERATIONS' && (
          <AccountOperationsCenter />
        )}

        {/* Search Bar */}
        {activeTab !== 'ACCOUNT_OPERATIONS' && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="گەڕان بەدوای ناوی مارکێت، ناوی خاوەن، یان کد..."
              className="w-full bg-[#1C1C1E] border border-[#2C2C2E] focus:border-emerald-500 text-[#F5F5F7] text-xs md:text-sm rounded-2xl pr-11 pl-10 py-3 outline-none transition-all placeholder-[#8E8E93]"
            />
            <Search className="w-4 h-4 text-[#8E8E93] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[#8E8E93] hover:text-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* TAB 1: MARKETS LIST */}
        {activeTab === 'MARKETS' && (
          <div className="space-y-4">
            {filteredMarkets.length === 0 ? (
              <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-10 text-center space-y-3">
                <Building2 className="w-12 h-12 text-[#8E8E93] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[#F5F5F7]">هیچ مارکێتێک نەدۆزرایەوە</h3>
                <p className="text-xs text-[#8E8E93]">دەتوانیت مارکێتی نوێ دروست بکەیت بە داگرتنی دوگمەی سەرەوە.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMarkets.map((m) => (
                  <div key={m.id} className="bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#3A3A3C] transition-all rounded-3xl p-5 space-y-4 flex flex-col justify-between shadow-lg relative group">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-extrabold text-[#F5F5F7] group-hover:text-emerald-400 transition-colors">{m.name}</h3>
                          <span className="text-[11px] font-mono text-[#8E8E93]">{m.id}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                          m.status === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : m.status === 'SUSPENDED' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {m.status === 'ACTIVE' ? 'چالاک' : m.status === 'SUSPENDED' ? 'ڕاگیراوە' : 'بەسەرچووە'}
                        </span>
                      </div>

                      <div className="bg-[#242428] rounded-2xl p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between items-center text-[#8E8E93]">
                          <span>ناوی بەڕێوەبەر:</span>
                          <span className="font-bold text-[#F5F5F7]">{m.owner_name}</span>
                        </div>
                        {m.owner_phone && (
                          <div className="flex justify-between items-center text-[#8E8E93]">
                            <span>ژمارەی فەرمی مارکێت:</span>
                            <span className="font-mono text-[#F5F5F7] dir-ltr">{m.owner_phone}</span>
                          </div>
                        )}
                        {m.manager_login_phone && (
                          <div className="flex justify-between items-center text-[#8E8E93]">
                            <span>ژمارەی چوونەژوورەوە:</span>
                            <span className="font-mono text-blue-400 dir-ltr">{m.manager_login_phone}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[#8E8E93]">
                          <span>دراوی بنەڕەتی:</span>
                          <span className="font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">{m.currency || 'IQD'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#8E8E93]">
                          <span>کۆی کڕیاران:</span>
                          <span className="font-bold text-[#F5F5F7]">{m.customers_count || 0} کڕیار</span>
                        </div>
                        <div className="flex justify-between items-center text-[#8E8E93] border-t border-[#2C2C2E] pt-2">
                          <span>بەسەرچوونی مۆڵەت:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {new Date(m.license_expires_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#2C2C2E] space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setSelectedMarketForLicense(m)}
                          className="w-full py-2.5 px-2 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>مۆڵەت</span>
                        </button>

                        <button
                          onClick={() => handleRegenerateActivation(m)}
                          className="w-full py-2.5 px-2 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                          title="دروستکردنی بەستەری چالاککردن"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                          <span>بەستەر</span>
                        </button>

                        <button
                          onClick={() => initiateDeleteMarket(m)}
                          className="w-full py-2.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>سڕینەوە</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANAGERS LIST */}
        {activeTab === 'MANAGERS' && (
          <div className="space-y-4">
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-[#242428] text-[#8E8E93] text-xs border-b border-[#2C2C2E]">
                    <tr>
                      <th className="p-4 font-bold">ناوی بەڕێوەبەر</th>
                      <th className="p-4 font-bold">مارکێت</th>
                      <th className="p-4 font-bold">ئیمەیڵ / مۆبایل</th>
                      <th className="p-4 font-bold">ڕۆڵ</th>
                      <th className="p-4 font-bold">دۆخ</th>
                      <th className="p-4 font-bold">بەرواری دروستکردن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2E] text-[#F5F5F7]">
                    {managers.map((mgr) => (
                      <tr key={mgr.id} className="hover:bg-[#2C2C2E]/50 transition-colors">
                        <td className="p-4 font-extrabold text-[#F5F5F7]">{mgr.full_name}</td>
                        <td className="p-4 font-mono text-xs text-[#8E8E93]">{mgr.market_id}</td>
                        <td className="p-4 font-mono text-xs text-[#8E8E93] dir-ltr text-right">
                          {mgr.email || mgr.phone || 'دیارینەکراوە'}
                        </td>
                        <td className="p-4">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${
                            mgr.role === 'MARKET_MANAGER'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {mgr.role === 'MARKET_MANAGER' ? 'بەڕێوەبەری مارکێت' : 'کارمەند'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {mgr.status === 'ACTIVE' ? 'چالاک' : 'ناچالاک'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-xs text-[#8E8E93]">
                          {new Date(mgr.created_at).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: CREATE NEW MARKET */}
      {isAddMarketOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl w-full max-w-lg p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#F5F5F7]">دروستکردنی مارکێتی نوێ</h3>
                  <p className="text-xs text-[#8E8E93]">ناسنامەی فەرمی مارکێت و زانیاریی بەڕێوەبەری سەرەتایی دیاری بکه</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddMarketOpen(false)} 
                className="p-1.5 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMarket} className="space-y-4">
              {/* SECTION A: MARKET IDENTITY */}
              <div className="space-y-3 bg-[#242428]/60 p-3.5 rounded-2xl border border-[#2C2C2E]">
                <div className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>ناسنامەی فەرمی مارکێت</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ناوی فەرمی مارکێت *</label>
                  <input
                    type="text"
                    required
                    placeholder="مینی مارکێتی جیهان"
                    value={newMarket.name}
                    onChange={(e) => setNewMarket({ ...newMarket, name: e.target.value })}
                    className="w-full bg-[#1C1C1E] border border-[#3A3A3C] focus:border-emerald-500 text-sm rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ژمارەی فەرمی تۆمارکراوی مارکێت *</label>
                  <input
                    type="text"
                    required
                    placeholder="0750XXXXXXX"
                    value={newMarket.registered_phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewMarket(prev => ({
                        ...prev,
                        registered_phone: val,
                        manager_login_phone: useSamePhone ? val : prev.manager_login_phone
                      }));
                    }}
                    className="w-full bg-[#1C1C1E] border border-[#3A3A3C] focus:border-emerald-500 text-xs font-mono rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* SECTION B: INITIAL MANAGER */}
              <div className="space-y-3 bg-[#242428]/60 p-3.5 rounded-2xl border border-[#2C2C2E]">
                <div className="text-xs font-extrabold text-blue-400 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  <span>بەڕێوەبەری سەرەتایی (Initial Manager)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ناوی بەڕێوەبەری سەرەتایی *</label>
                  <input
                    type="text"
                    required
                    placeholder="کاک ئارام"
                    value={newMarket.manager_name}
                    onChange={(e) => setNewMarket({ ...newMarket, manager_name: e.target.value })}
                    className="w-full bg-[#1C1C1E] border border-[#3A3A3C] focus:border-blue-500 text-sm rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#8E8E93]">ژمارەی چوونەژوورەوەی بەڕێوەبەر *</label>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useSamePhone}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseSamePhone(checked);
                          if (checked) {
                            setNewMarket(prev => ({ ...prev, manager_login_phone: prev.registered_phone }));
                          }
                        }}
                        className="rounded accent-emerald-500"
                      />
                      <span>هەمان ژمارەی مارکێت</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    required
                    disabled={useSamePhone}
                    placeholder="0750XXXXXXX"
                    value={useSamePhone ? newMarket.registered_phone : newMarket.manager_login_phone}
                    onChange={(e) => setNewMarket({ ...newMarket, manager_login_phone: e.target.value })}
                    className={`w-full border text-xs font-mono rounded-xl px-4 py-2.5 outline-none transition-all placeholder-[#8E8E93] ${
                      useSamePhone
                        ? 'bg-[#2C2C2E]/60 border-[#3A3A3C] text-[#8E8E93] cursor-not-allowed'
                        : 'bg-[#1C1C1E] border-[#3A3A3C] focus:border-blue-500 text-[#F5F5F7]'
                    }`}
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ئیمەیڵی بەڕێوەبەر (ئارەزوومەندانە)</label>
                  <input
                    type="email"
                    placeholder="manager@example.com"
                    value={newMarket.manager_email}
                    onChange={(e) => setNewMarket({ ...newMarket, manager_email: e.target.value })}
                    className="w-full bg-[#1C1C1E] border border-[#3A3A3C] focus:border-blue-500 text-xs font-mono rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* SECTION C: SETTINGS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">دراوی بنەڕەتی</label>
                  <select
                    value={newMarket.currency}
                    onChange={(e) => setNewMarket({ ...newMarket, currency: e.target.value as 'IQD' | 'USD' })}
                    className="w-full bg-[#242428] border border-[#3A3A3C] text-xs rounded-xl px-3 py-2.5 text-[#F5F5F7] outline-none transition-all"
                  >
                    <option value="IQD">دیناری عێراقی (IQD)</option>
                    <option value="USD">دۆلاری ئەمریکی (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ماوەی مۆڵەتی سەرەتایی</label>
                  <select
                    value={newMarket.license_days}
                    onChange={(e) => setNewMarket({ ...newMarket, license_days: Number(e.target.value) })}
                    className="w-full bg-[#242428] border border-[#3A3A3C] text-xs rounded-xl px-3 py-2.5 text-[#F5F5F7] outline-none transition-all"
                  >
                    <option value={30}>١ مانگ (Trial)</option>
                    <option value={180}>٦ مانگ</option>
                    <option value={365}>١ ساڵ (ساڵانە)</option>
                    <option value={3650}>مۆڵەتی هەمیشەیی</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#2C2C2E]">
                <button
                  type="button"
                  onClick={() => setIsAddMarketOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  دروستکردنی مارکێت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE LICENSE & EXPIRY */}
      {selectedMarketForLicense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl w-full max-w-md p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#F5F5F7]">بەڕێوەبردنی مۆڵەت</h3>
                  <p className="text-xs text-[#8E8E93]">{selectedMarketForLicense.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMarketForLicense(null)} 
                className="p-1.5 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#242428] rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#8E8E93]">
                <span>بەرواری بەسەرچوون:</span>
                <strong className="text-amber-400 font-mono text-sm">{new Date(selectedMarketForLicense.license_expires_at).toLocaleDateString('en-GB')}</strong>
              </div>
              <div className="flex justify-between items-center text-[#8E8E93]">
                <span>دۆخی ئێستا:</span>
                <strong className="text-emerald-400 font-bold">{selectedMarketForLicense.status}</strong>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => handleUpdateLicense(selectedMarketForLicense.id, 'EXTEND_90')}
                className="w-full py-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all border border-[#3A3A3C] active:scale-95"
              >
                + درێژکردنەوە بۆ ٩٠ ڕۆژی تر (۳ مانگ)
              </button>
              <button
                onClick={() => handleUpdateLicense(selectedMarketForLicense.id, 'EXTEND_365')}
                className="w-full py-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold transition-all active:scale-95 shadow-lg shadow-emerald-500/5"
              >
                + درێژکردنەوە بۆ ۱ ساڵی تر (۳۶۵ ڕۆژ)
              </button>
              {selectedMarketForLicense.status === 'ACTIVE' ? (
                <button
                  onClick={() => handleUpdateLicense(selectedMarketForLicense.id, 'SUSPEND')}
                  className="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-extrabold transition-all active:scale-95"
                >
                  ⚠️ ڕاگرتنی مۆڵەت (Suspend Market)
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateLicense(selectedMarketForLicense.id, 'ACTIVATE')}
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all active:scale-95"
                >
                  ✅ چالاککردنەوەی مۆڵەت
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN MANAGER TO MARKET */}
      {selectedMarketForManager && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl w-full max-w-md p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#F5F5F7]">دانانی بەڕێوەبەر</h3>
                  <p className="text-xs text-[#8E8E93]">{selectedMarketForManager.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMarketForManager(null)} 
                className="p-1.5 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManager} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ناوی سیانی *</label>
                <input
                  type="text"
                  required
                  placeholder="ئاریان سەرکەوت"
                  value={newManager.full_name}
                  onChange={(e) => setNewManager({ ...newManager, full_name: e.target.value })}
                  className="w-full bg-[#242428] border border-[#3A3A3C] text-sm rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ئیمەیڵ یان ژمارەی مۆبایل</label>
                <input
                  type="text"
                  placeholder="0750XXXXXXX yanj manager@example.com"
                  value={newManager.email || newManager.phone}
                  onChange={(e) => setNewManager({ ...newManager, email: e.target.value, phone: e.target.value })}
                  className="w-full bg-[#242428] border border-[#3A3A3C] text-xs font-mono rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all placeholder-[#8E8E93]"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8E8E93] mb-1.5">ڕۆڵ و ئاستی دەسەڵات</label>
                <select
                  value={newManager.role}
                  onChange={(e) => setNewManager({ ...newManager, role: e.target.value as 'MARKET_MANAGER' | 'EMPLOYEE' })}
                  className="w-full bg-[#242428] border border-[#3A3A3C] text-sm rounded-xl px-4 py-2.5 text-[#F5F5F7] outline-none transition-all"
                >
                  <option value="MARKET_MANAGER">بەڕێوەبەری مارکێت (Market Manager)</option>
                  <option value="EMPLOYEE">کارمەند (Employee)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#2C2C2E]">
                <button
                  type="button"
                  onClick={() => setSelectedMarketForManager(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-extrabold text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  دیاریکردنی بەڕێوەبەر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SECURE MARKET DECOMMISSION & DELETE WORKFLOW */}
      {marketToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#F5F5F7]">سڕینەوەی هەژماری مارکێت</h3>
                  <p className="text-xs text-[#8E8E93]">{marketToDelete.name} ({marketToDelete.id})</p>
                </div>
              </div>
              <button 
                onClick={() => setMarketToDelete(null)} 
                className="p-1.5 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteStep === 1 && (
              <div className="space-y-4">
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2 text-xs text-rose-300">
                  <p className="font-bold">ئاگاداریی زۆر گرنگ:</p>
                  <p className="leading-relaxed">
                    ئەم کردارە هەژماری مارکێتەکە لە پلاتفۆرمی ژیرۆکس لادەبات. پێش بەردەوامبوون دڵنیابە لە بڕیارەکەت. ئەمە کرداری سەرەکییە و نەگەڕێنەرەوەیە.
                  </p>
                </div>

                <div className="bg-[#242428] rounded-2xl p-3.5 space-y-1.5 text-xs text-[#8E8E93]">
                  <div className="flex justify-between">
                    <span>ناوی مارکێت:</span>
                    <strong className="text-[#F5F5F7]">{marketToDelete.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>خاوەن:</span>
                    <strong className="text-[#F5F5F7]">{marketToDelete.owner_name}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMarketToDelete(null)}
                    className="w-1/2 py-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="w-1/2 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-black font-extrabold text-xs transition-all shadow-lg shadow-rose-500/20"
                  >
                    بەردەوامبوون
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#8E8E93]">
                    بۆ دڵنیابوونەوە، تکایە ناوی تەواوی مارکێتەکە بنووسە: <span className="text-rose-400 font-extrabold select-all">{marketToDelete.name}</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ناوی مارکێت لێرە بنووسە..."
                    value={confirmNameInput}
                    onChange={(e) => setConfirmNameInput(e.target.value)}
                    className="w-full bg-[#242428] border border-[#3A3A3C] focus:border-rose-500 text-xs rounded-xl px-4 py-3 text-[#F5F5F7] outline-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    className="w-1/2 py-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all"
                  >
                    گەڕانەوە
                  </button>
                  <button
                    type="button"
                    disabled={confirmNameInput.trim() !== marketToDelete.name.trim() || isDeleting}
                    onClick={executeDeleteMarket}
                    className="w-1/2 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-black font-extrabold text-xs transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <span>سڕینەوەی یەکجارەکی</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGER ACTIVATION LINK DISPLAY */}
      {activationModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-emerald-500/30 rounded-3xl w-full max-w-lg p-6 space-y-6 relative shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#F5F5F7]">بەستەری چالاککردنی بەڕێوەبەر</h3>
                  <p className="text-xs text-[#8E8E93]">{activationModal.marketName}</p>
                </div>
              </div>
              <button 
                onClick={() => setActivationModal(null)} 
                className="p-1.5 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-[#F5F5F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-[#242428] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[#8E8E93]">
                  <span>بەڕێوەبەر:</span>
                  <strong className="text-[#F5F5F7] font-bold">{activationModal.managerName}</strong>
                </div>
                <div className="flex justify-between items-center text-[#8E8E93]">
                  <span>ژمارەی چوونەژوورەوە:</span>
                  <strong className="text-blue-400 font-mono dir-ltr">{activationModal.managerPhone}</strong>
                </div>
                <div className="flex justify-between items-center text-[#8E8E93]">
                  <span>ماوەی دیاریکراو:</span>
                  <strong className="text-amber-400 font-bold">٢٤ کاتژمێر (یەکجار بەکارهێنان)</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#8E8E93]">بەستەری تایبەتی چالاککردن (Activation Link):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activationModal.activationUrl}
                    className="w-full bg-[#242428] border border-[#3A3A3C] text-xs font-mono rounded-xl px-3.5 py-3 text-emerald-400 outline-none select-all dir-ltr"
                  />
                  <button
                    onClick={() => copyToClipboard(activationModal.activationUrl, 'modal-link')}
                    className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    {copiedField === 'modal-link' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>کۆپی کرا!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>کۆپیکردن</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-300 leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  ڕێنمایی ئاسایش:
                </p>
                <p>ئەم بەستەرە ڕاستەوخۆ بۆ بەڕێوەبەری مارکێت بنێرە. دوای کردنی بەستەرەکە، بەڕێوەبەر وشەی نهێنی تایبەت بە خۆی دادەنێت.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    const shareText = `هەژماری بەڕێوەبەرایەتی ZHIROX بۆ مارکێتی "${activationModal.marketName}" ئامادە کراوە.\nبۆ دروستکردنی وشەی نهێنی و چالاککردنی هەژمارەکەت، ئەم بەستەرە بکەرەوە:\n\n${activationModal.activationUrl}\n\nتێبینی: ئەم بەستەرە تەنها یەکجار بەکاردێت و ماوەی 24 کاتژمێری هەیە.`;
                    copyToClipboard(shareText, 'share-msg');
                  }}
                  className="w-full py-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-bold text-[#F5F5F7] transition-all flex items-center justify-center gap-2 border border-[#3A3A3C]"
                >
                  {copiedField === 'share-msg' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>دەقی پەیام کۆپی کرا!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-blue-400" />
                      <span>کۆپیکردنی دەقی پەیام بۆ واتساپ/تێلیگرام</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActivationModal(null)}
                  className="w-1/3 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20"
                >
                  داخستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

