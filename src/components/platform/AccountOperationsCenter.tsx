import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Copy, 
  UserCheck, 
  UserX, 
  UserPlus, 
  Key, 
  Phone, 
  Store, 
  ChevronRight, 
  Eye, 
  ExternalLink,
  Ban,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AccountOpsRecord, AccountOpsSummary, MembershipLifecycleStatus } from '../../types/accountOps';

export const AccountOperationsCenter: React.FC = () => {
  const [records, setRecords] = useState<AccountOpsRecord[]>([]);
  const [summary, setSummary] = useState<AccountOpsSummary>({
    total_accounts: 0,
    active_count: 0,
    pending_activation_count: 0,
    suspended_count: 0,
    revoked_count: 0,
    needs_review_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<AccountOpsRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Suspend Modal
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reactivate Modal
  const [showReactivateModal, setShowReactivateModal] = useState(false);

  // Revoke Modal
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  // Replace Manager Modal
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerPhone, setNewManagerPhone] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  // Generated Link Output Modal
  const [generatedLinkModal, setGeneratedLinkModal] = useState<{
    show: boolean;
    title: string;
    url: string;
  }>({ show: false, title: '', url: '' });

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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

  const fetchOperationsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/account-operations', {
        headers: getAuthHeaders()
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('وەڵامی سێرڤەر نادروستە');
      }

      if (!res.ok) {
        throw new Error(data.message || 'هەڵە لە وەرگرتنی زانیارییەکان');
      }

      if (
        !data ||
        typeof data !== 'object' ||
        data.status !== 'success' ||
        !data.data ||
        typeof data.data !== 'object' ||
        !Array.isArray(data.data.items) ||
        typeof data.data.total !== 'number'
      ) {
        console.error('Invalid response contract:', data);
        throw new Error('وەڵامی سێرڤەر نادروستە');
      }

      setRecords(data.data.items);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || 'وەڵامی سێرڤەر نادروستە');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationsData();
  }, []);

  // Filtered records
  const filteredRecords = records.filter(rec => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      rec.official_market_name.toLowerCase().includes(searchLower) ||
      rec.official_registered_phone.includes(searchLower) ||
      rec.manager_name.toLowerCase().includes(searchLower) ||
      rec.manager_login_phone.includes(searchLower) ||
      rec.market_id.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return rec.membership_status === 'ACTIVE';
    if (filterStatus === 'PENDING_ACTIVATION') return rec.membership_status === 'PENDING_ACTIVATION';
    if (filterStatus === 'SUSPENDED') return rec.membership_status === 'SUSPENDED';
    if (filterStatus === 'REVOKED') return rec.membership_status === 'REVOKED';
    if (filterStatus === 'NEEDS_REVIEW') return rec.health_flags.length > 0 && rec.membership_status !== 'ACTIVE';

    return true;
  });

  // Action Handlers
  const handleSuspend = async () => {
    if (!selectedRecord || !suspendReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${selectedRecord.market_id}/managers/${selectedRecord.manager_user_id}/suspend`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: suspendReason })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('هەژماری بەڕێوەبەر بە سەرکەوتوویی ڕاگەیەندرا (SUSPENDED)');
        setShowSuspendModal(false);
        setSuspendReason('');
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە پەیوەندی بە ڕاژەکار');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedRecord) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${selectedRecord.market_id}/managers/${selectedRecord.manager_user_id}/reactivate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'چالاککردنەوە لە لایەن خاوەنی سیستەم' })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('هەژماری بەڕێوەبەر بە سەرکەوتوویی چالاککرایەوە (ACTIVE)');
        setShowReactivateModal(false);
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە پەیوەندی بە ڕاژەکار');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedRecord || !revokeReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${selectedRecord.market_id}/managers/${selectedRecord.manager_user_id}/revoke`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: revokeReason })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('دەسەڵاتی بەڕێوەبەر بە یەکجارەکی لێسندرایەوە (REVOKED)');
        setShowRevokeModal(false);
        setRevokeReason('');
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە پەیوەندی بە ڕاژەکار');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartReplacement = async () => {
    if (!selectedRecord || !newManagerName.trim() || !newManagerPhone.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${selectedRecord.market_id}/replace-manager`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          new_manager_name: newManagerName,
          new_manager_login_phone: newManagerPhone,
          new_manager_email: newManagerEmail,
          reason: replaceReason
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setShowReplaceModal(false);
        setNewManagerName('');
        setNewManagerPhone('');
        setNewManagerEmail('');
        setReplaceReason('');
        
        setGeneratedLinkModal({
          show: true,
          title: `بەستەری چالاککردنی بەڕێوەبەری نوێ (${newManagerName})`,
          url: data.activation_url
        });
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە پەیوەندی بە ڕاژەکار');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateLink = async (rec: AccountOpsRecord) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${rec.market_id}/regenerate-activation`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: rec.manager_user_id })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setGeneratedLinkModal({
          show: true,
          title: `بەستەری نوێی چالاککردن - ${rec.official_market_name}`,
          url: data.activation_url
        });
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە دروستکردنی بەستەری نوێ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelActivation = async (rec: AccountOpsRecord) => {
    if (!confirm('ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم بەستەرەی چالاککردن؟')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/platform/markets/${rec.market_id}/cancel-activation`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: rec.manager_user_id })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('بەستەری چالاککردنەکە هەڵوەشێنرایەوە');
        fetchOperationsData();
      } else {
        alert(data.message || 'کێشە ڕوویدا');
      }
    } catch (err) {
      alert('کێشە لە پەیوەندی بە ڕاژەکار');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('لینکەکە کۆپی کرا بۆ کلیپبۆرد!');
  };

  const getStatusBadge = (status: MembershipLifecycleStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> چالاک</span>;
      case 'PENDING_ACTIVATION':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> چاوەڕوانی چالاککردن</span>;
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><Ban className="w-3.5 h-3.5" /> ڕاگیراو</span>;
      case 'REVOKED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><XCircle className="w-3.5 h-3.5" /> دەسەڵات لێسەندراوەتەوە</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 dir-rtl text-right text-gray-100 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400/30 text-sm font-medium"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>ZHIROX CONTROL PLANE — ACCOUNT OPERATIONS CENTER</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">بەڕێوەبردنی هەژمارەکان (Account Operations)</h1>
            <p className="text-zinc-400 text-sm max-w-2xl">
              سەرپەرشتیکردنی سووڕی ژیانی هەژماری بەڕێوەبەرانی مارکێتەکان، چالاککردنی نوێ، ڕاگرتن، لێسەندنەوەی دەسەڵات و گۆڕینی بەڕێوەبەر بە شێوەیەکی ئاسایشدار
            </p>
          </div>
          <button
            onClick={fetchOperationsData}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>نوێکردنەوە</span>
          </button>
        </div>

        {/* Operational KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-zinc-800">
          <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
            <span className="text-xs text-zinc-400 font-medium">گشتی هەژمارەکان</span>
            <div className="text-2xl font-bold text-white mt-1">{summary.total_accounts}</div>
          </div>
          <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/20">
            <span className="text-xs text-emerald-400 font-medium">چالاک (ACTIVE)</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.active_count}</div>
          </div>
          <div className="bg-amber-950/20 p-3.5 rounded-xl border border-amber-500/20">
            <span className="text-xs text-amber-400 font-medium">چاوەڕوانی چالاککردن</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{summary.pending_activation_count}</div>
          </div>
          <div className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-500/20">
            <span className="text-xs text-rose-400 font-medium">ڕاگیراو (SUSPENDED)</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{summary.suspended_count}</div>
          </div>
          <div className="bg-purple-950/20 p-3.5 rounded-xl border border-purple-500/20">
            <span className="text-xs text-purple-400 font-medium">دەسەڵات لێسەندراوەتەوە</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">{summary.revoked_count}</div>
          </div>
          <div className="bg-blue-950/20 p-3.5 rounded-xl border border-blue-500/20">
            <span className="text-xs text-blue-400 font-medium">پێویستی بە پشکنین</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">{summary.needs_review_count}</div>
          </div>
        </div>
      </div>

      {/* Controls & Search Filter Bar */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute right-3 top-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="گەڕان بەدوای ناوی مارکێت، ناوی بەڕێوەبەر یان مۆبایل..."
            className="w-full pr-10 pl-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'هەموو' },
            { id: 'ACTIVE', label: 'چالاک' },
            { id: 'PENDING_ACTIVATION', label: 'چاوەڕوانی چالاککردن' },
            { id: 'SUSPENDED', label: 'ڕاگیراو' },
            { id: 'REVOKED', label: 'دەسەڵات لێسەندراوەتەوە' },
            { id: 'NEEDS_REVIEW', label: 'پێویستی بە پشکنین' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === tab.id
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">تکایە چاوەڕێ بکە... خەریکی وەرگرتنی هەژمارەکانە لە بنکەی زانیاری authoritative PostgreSQL</p>
        </div>
      ) : error ? (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-6 text-center text-rose-400 text-sm">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
          <span>{error}</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
          هیچ هەژمارێک لەگەڵ پێوەرەکانی گەڕانەکە ناگونجێت.
        </div>
      ) : (
        /* Account Records Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecords.map((rec) => (
            <div
              key={rec.market_id}
              className={`bg-zinc-900 border rounded-2xl p-5 shadow-lg transition-all hover:border-zinc-700 relative flex flex-col justify-between ${
                rec.membership_status === 'SUSPENDED' ? 'border-rose-500/30 bg-rose-950/10' :
                rec.membership_status === 'REVOKED' ? 'border-purple-500/30 bg-purple-950/10' :
                rec.membership_status === 'PENDING_ACTIVATION' ? 'border-amber-500/30 bg-amber-950/10' :
                'border-zinc-800'
              }`}
            >
              <div>
                {/* Header Row: Official Market Name & Badges */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-white text-lg">{rec.official_market_name}</h3>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3">
                      <span>شناسە: <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-300 font-mono">{rec.market_id}</code></span>
                      <span>تۆمارکراو: {rec.official_registered_phone}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(rec.membership_status)}</div>
                </div>

                {/* Current Manager Identity Section */}
                <div className="bg-zinc-950/60 rounded-xl p-3.5 border border-zinc-800/80 mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      بەڕێوەبەری ئێستا:
                    </span>
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[11px] font-medium">
                      {rec.manager_role === 'OWNER' || rec.manager_role === 'MARKET_OWNER' ? 'خاوەن شوێن' : 'بەڕێوەبەر'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100 text-sm">{rec.manager_name}</span>
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-zinc-500" />
                      {rec.manager_login_phone}
                    </span>
                  </div>

                  {rec.manager_email && (
                    <div className="text-xs text-zinc-500 truncate">ئیمەیڵ: {rec.manager_email}</div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1.5 border-t border-zinc-800/60">
                    <span>دۆخی پەیوەندی Auth: <strong className="text-zinc-300">{rec.auth_linkage_status === 'LINKED' ? 'بەستراوەتەوە' : rec.auth_linkage_status === 'PENDING_ACTIVATION' ? 'چاوەڕوانی چالاککردن' : 'پەیوەندیی Auth ناتەواوە'}</strong></span>
                    {rec.activated_at && <span>چالاککراوە لە: {new Date(rec.activated_at).toLocaleDateString('ku-IQ')}</span>}
                  </div>
                </div>

                {/* Pending Manager Replacement Banner if applicable */}
                {rec.pending_replacement && (
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 mb-3 text-xs text-amber-300">
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      داواکاری گۆڕینی بەڕێوەبەر لە چاوەڕوانیدایە:
                    </div>
                    <div>کاندید: <strong>{rec.pending_replacement.candidate_name}</strong> ({rec.pending_replacement.candidate_login_phone})</div>
                    <div className="text-[11px] text-amber-400/80 mt-1">
                      بەڕێوەبەری ئێستا چالاک دەمێنێتەوە تا کاندیدی نوێ لینکەکە چالاک دەکات.
                    </div>
                  </div>
                )}

                {/* Health Flags Chips */}
                {rec.health_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {rec.health_flags.map(flag => (
                      <span key={flag} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {flag === 'MISSING_AUTH_LINK' ? '⚠️ بەستنەوەی Auth ناتەواوە' :
                         flag === 'EXPIRED_ACTIVATION' ? '⌛ بەستەر بەسەرچووە' :
                         flag === 'AMBIGUOUS_MANAGER_RELATIONSHIP' ? '❓ فرە بەڕێوەبەری سەرگەردان' : flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar Matrix */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap gap-2 justify-end">
                {/* Status: PENDING_ACTIVATION Actions */}
                {rec.membership_status === 'PENDING_ACTIVATION' && (
                  <>
                    <button
                      onClick={() => handleRegenerateLink(rec)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>بەستەری نوێ</span>
                    </button>
                    <button
                      onClick={() => handleCancelActivation(rec)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>هەڵوەشاندنەوە</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowReplaceModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>گۆڕینی بەڕێوەبەر</span>
                    </button>
                  </>
                )}

                {/* Status: ACTIVE Actions */}
                {rec.membership_status === 'ACTIVE' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowSuspendModal(true);
                      }}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>ڕاگرتنی هەژمار</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowReplaceModal(true);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>گۆڕینی بەڕێوەبەر</span>
                    </button>
                  </>
                )}

                {/* Status: SUSPENDED Actions */}
                {rec.membership_status === 'SUSPENDED' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowReactivateModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>چالاککردنەوە</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowRevokeModal(true);
                      }}
                      className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>لێسەندنەوەی دەسەڵات</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setShowReplaceModal(true);
                      }}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>گۆڕینی بەڕێوەبەر</span>
                    </button>
                  </>
                )}

                {/* Status: REVOKED Actions */}
                {rec.membership_status === 'REVOKED' && (
                  <button
                    onClick={() => {
                      setSelectedRecord(rec);
                      setShowReplaceModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>گۆڕینی بەڕێوەبەر (دامەزراندنی نوێ)</span>
                  </button>
                )}

                {/* Inspect Details Drawer */}
                <button
                  onClick={() => {
                    setSelectedRecord(rec);
                    setShowDetailModal(true);
                  }}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Eye className="w-3.5 h-3.5 text-zinc-400" />
                  <span>زانیارییەکان</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: SUSPEND MANAGER */}
      <AnimatePresence>
        {showSuspendModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-rose-400">
                <Ban className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">ڕاگرتنی هەژماری بەڕێوەبەر (Suspend Manager)</h3>
              </div>

              <p className="text-zinc-300 text-sm">
                ئایا دڵنیایت لە ڕاگرتنی هەژماری بەڕێوەبەر بۆ <strong>{selectedRecord.official_market_name}</strong>؟
              </p>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div>بەڕێوەبەری ئێستا: <strong className="text-white">{selectedRecord.manager_name}</strong></div>
                <div>ژمارەی چوونەژوورەوە: <strong className="text-emerald-400 font-mono">{selectedRecord.manager_login_phone}</strong></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">هۆکاری ڕاگرتن (داواکراوە):</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="هۆکاری ڕاگرتنی هەژمارەکە بنووسە..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSuspendReason('');
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading || !suspendReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-rose-600/20"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  <span>پشتڕاستکردنەوەی ڕاگرتن</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: REACTIVATE MANAGER */}
      <AnimatePresence>
        {showReactivateModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">چالاککردنەوەی بەڕێوەبەر (Reactivate Manager)</h3>
              </div>

              <p className="text-zinc-300 text-sm">
                ئایا دڵنیایت لە چالاککردنەوەی هەژماری بەڕێوەبەر بۆ <strong>{selectedRecord.official_market_name}</strong>؟
              </p>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div>بەڕێوەبەری ئێستا: <strong className="text-white">{selectedRecord.manager_name}</strong></div>
                <div>ژمارەی مۆبایل: <strong className="text-emerald-400 font-mono">{selectedRecord.manager_login_phone}</strong></div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowReactivateModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>پشتڕاستکردنەوەی چالاککردنەوە</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 3: REVOKE MANAGER */}
      <AnimatePresence>
        {showRevokeModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-purple-400">
                <UserX className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">لێسەندنەوەی دەسەڵاتی بەڕێوەبەر (Revoke Authority)</h3>
              </div>

              <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-3.5 text-xs text-purple-300 leading-relaxed font-medium">
                ⚠️ دوای لێسەندنەوەی دەسەڵات، ئەم پەیوەندییەی بەڕێوەبەرایەتییە بە دوگمەی ئاسایی ناگەڕێندرێتەوە و دەستگەیشتنی بەڕێوەبەری ئێستا ڕادەگیرێت.
              </div>

              <p className="text-zinc-300 text-sm">
                مارکێت: <strong>{selectedRecord.official_market_name}</strong>
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">هۆکاری لێسەندنەوەی دەسەڵات (داواکراوە):</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="هۆکاری لێسەندنەوەی دەسەڵاتی بەڕێوەبەر بنووسە..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setShowRevokeModal(false);
                    setRevokeReason('');
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={actionLoading || !revokeReason.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-purple-600/20"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  <span>لێسەندنەوەی یەکجارەکیی دەسەڵات</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 4: SECURE MANAGER REPLACEMENT WIZARD */}
      <AnimatePresence>
        {showReplaceModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-emerald-400">
                <UserPlus className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">گۆڕینی بەڕێوەبەری مارکێت (Secure Manager Replacement)</h3>
              </div>

              <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                ℹ️ <strong>شێوازی ئاسایشدار:</strong> بەڕێوەبەری ئێستا (<strong className="text-white">{selectedRecord.manager_name}</strong>) بە چالاکی دەمێنێتەوە تا بەڕێوەبەری نوێ لینکەکە چالاک دەکات و وشەی نهێنی خۆی دیاری دەکات. دوای چالاککردنی نوێ، دەسەڵاتی کۆن بە شێوەیەکی خۆکارانە لێدەسندرێتەوە.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 mb-1 block">ناوی تەواوی بەڕێوەبەری نوێ *</label>
                  <input
                    type="text"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                    placeholder="نموونە: هۆگر سەباح"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 mb-1 block">ژمارەی مۆبایلی چوونەژوورەوەی بەڕێوەبەری نوێ *</label>
                  <input
                    type="text"
                    value={newManagerPhone}
                    onChange={(e) => setNewManagerPhone(e.target.value)}
                    placeholder="0750XXXXXXX"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 mb-1 block">ئیمەیڵی بەڕێوەبەری نوێ (ئارەزوومەندانه)</label>
                  <input
                    type="email"
                    value={newManagerEmail}
                    onChange={(e) => setNewManagerEmail(e.target.value)}
                    placeholder="manager@zhirox.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 mb-1 block">هۆکاری گۆڕین (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    value={replaceReason}
                    onChange={(e) => setReplaceReason(e.target.value)}
                    placeholder="هۆکاری گۆڕینی بەڕێوەبەر..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowReplaceModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  onClick={handleStartReplacement}
                  disabled={actionLoading || !newManagerName.trim() || !newManagerPhone.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>دروستکردنی داواکاری و بەستەری چالاککردن</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 5: GENERATED LINK OUTPUT */}
      <AnimatePresence>
        {generatedLinkModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-emerald-400">
                <Key className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">{generatedLinkModal.title}</h3>
              </div>

              <p className="text-xs text-zinc-300">
                ئەم بەستەرەی خوارەوە بە شێوەیەکی ئاسایشدار دروستکراوە. تکایە بۆ بەڕێوەبەرەکەی بنێرە بۆ دیاریکردنی وشەی نهێنی و چالاککردن:
              </p>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                <code className="text-xs text-emerald-400 font-mono break-all dir-ltr overflow-x-auto select-all">
                  {generatedLinkModal.url}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedLinkModal.url)}
                  className="px-3 py-1.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-bold rounded-lg text-xs flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کۆپی</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`سڵاو، تکایە بەستەری خوارەوە بەکاربهێنە بۆ چالاککردنی هەژمارەکەت:\n${generatedLinkModal.url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>ناردن لە ڕێگەی WhatsApp</span>
                </a>
              </div>

              <div className="pt-2 border-t border-zinc-800 text-left">
                <button
                  onClick={() => setGeneratedLinkModal({ show: false, title: '', url: '' })}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold"
                >
                  داخستن
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAIL VIEW DRAWER / MODAL */}
      <AnimatePresence>
        {showDetailModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Store className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">تفسیلی هەژماری مارکێت</h2>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* SECTION A: MARKET IDENTITY */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-400 tracking-wider">SECTION A: ناسنامەی مارکێت</h3>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">ناوی فەرمیی مارکێت</span>
                    <strong className="text-zinc-100 text-sm">{selectedRecord.official_market_name}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">ناسنامەی مارکێت (ID)</span>
                    <strong className="text-emerald-400 font-mono">{selectedRecord.market_id}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">مۆبایلی تۆمارکراو</span>
                    <strong className="text-zinc-100 font-mono">{selectedRecord.official_registered_phone}</strong>
                  </div>
                </div>
              </div>

              {/* SECTION B: CURRENT MANAGER */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-400 tracking-wider">SECTION B: بەڕێوەبەری ئێستا</h3>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">ناوی بەڕێوەبەر</span>
                    <strong className="text-zinc-100 text-sm">{selectedRecord.manager_name}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">ژمارەی چوونەژوورەوە</span>
                    <strong className="text-emerald-400 font-mono">{selectedRecord.manager_login_phone}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">دۆخی پەیوەندیی هەژمار</span>
                    {getStatusBadge(selectedRecord.membership_status)}
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">دۆخی بەستنەوەی Auth</span>
                    <strong className="text-zinc-200">{selectedRecord.auth_linkage_status}</strong>
                  </div>
                </div>
              </div>

              {/* SECTION C: ACCOUNT ACTIONS */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <h3 className="text-xs font-bold text-emerald-400 tracking-wider">SECTION C: کارەکانی هەژمار</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord.membership_status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          setShowSuspendModal(true);
                        }}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold"
                      >
                        ڕاگرتنی هەژمار
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          setShowReplaceModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold"
                      >
                        گۆڕینی بەڕێوەبەر
                      </button>
                    </>
                  )}

                  {selectedRecord.membership_status === 'SUSPENDED' && (
                    <>
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          setShowReactivateModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold"
                      >
                        چالاککردنەوە
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailModal(false);
                          setShowRevokeModal(true);
                        }}
                        className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold"
                      >
                        لێسەندنەوەی دەسەڵات
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 text-left">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold"
                >
                  داخستن
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
