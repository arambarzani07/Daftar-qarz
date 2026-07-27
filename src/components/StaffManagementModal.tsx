import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../utils/apiClient';
import {
  X,
  UserPlus,
  ShieldCheck,
  User,
  Phone,
  Key,
  Trash2,
  Edit2,
  Check,
  Lock,
  CheckSquare,
  Square,
  AlertCircle,
  Copy,
  Clock,
  ShieldAlert,
  Search,
  RefreshCw,
  Activity,
  Zap,
  Info,
  CheckCircle2,
  XCircle,
  UserX,
  UserCheck
} from 'lucide-react';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APPROVED_PERMISSIONS = [
  'ADD_DEBT',
  'RECEIVE_PAYMENT',
  'ADD_CUSTOMER',
  'REVERSE_TRANSACTION',
  'VIEW_ANALYTICS',
  'EXPORT_STATEMENTS',
  'MANAGE_CREDIT_LIMIT'
];

export const PERMISSION_GROUPS = [
  {
    groupTitle: 'کڕیاران و پرۆفایل',
    items: [
      {
        id: 'ADD_CUSTOMER',
        title: 'زیادکردنی کڕیاری نوێ',
        desc: 'ڕێگەپێدان بۆ دروستکردنی کەسایەتی یان پرۆفایلی کڕیاری نوێ لە مارکێت'
      }
    ]
  },
  {
    groupTitle: 'کردارەکانی قەرز و پارەدان',
    items: [
      {
        id: 'ADD_DEBT',
        title: 'پێدانی قەرز (تۆمارکردن)',
        desc: 'ڕێگەپێدان بە کارمەند بۆ تۆمارکردنی قەرزی نوێ بۆ کڕیاران'
      },
      {
        id: 'RECEIVE_PAYMENT',
        title: 'وەرگرتنەوەی پارە',
        desc: 'ڕێگەپێدان بۆ تۆمارکردنی وەرگرتنەوەی پارە و دانی قەرز لە کڕیار'
      },
      {
        id: 'REVERSE_TRANSACTION',
        title: 'پاشگەزبوونەوە لە مامەڵە',
        desc: 'ڕێگەپێدان بۆ هەڵوەشاندنەوە یان سڕینەوەی مامەڵەی هەڵە',
        isHighRisk: true
      }
    ]
  },
  {
    groupTitle: 'کەشفحیساب و ڕاپۆرت',
    items: [
      {
        id: 'EXPORT_STATEMENTS',
        title: 'دەرکردنی کەشف حساب',
        desc: 'دەسەڵاتی داگرتن یان هەناردەکردنی کەشف حسابی کڕیاران',
        isHighRisk: true
      }
    ]
  },
  {
    groupTitle: 'پاراستنی ئاستی قەرز',
    items: [
      {
        id: 'MANAGE_CREDIT_LIMIT',
        title: 'دەستکاریی سنوری قەرز',
        desc: 'ڕێگەپێدان بۆ دیاریکردن یان قوفڵکردنی سنوری قەرزی کڕیار',
        isHighRisk: true
      }
    ]
  },
  {
    groupTitle: 'بینینی شیکارییەکان',
    items: [
      {
        id: 'VIEW_ANALYTICS',
        title: 'بینینی ڕاپۆرت و شیکاری',
        desc: 'دەسەڵاتی بینینی نەخشەی دارایی و ئامارەکانی مارکێت',
        isHighRisk: true
      }
    ]
  }
];

export const PRESETS = [
  {
    id: 'SIMPLE',
    title: 'کارمەندی سادە',
    desc: 'کڕیاری نوێ، پێدانی قەرز، وەرگرتنەوەی پارە',
    perms: ['ADD_CUSTOMER', 'ADD_DEBT', 'RECEIVE_PAYMENT']
  },
  {
    id: 'DEBT_MGR',
    title: 'کارمەندی قەرز',
    desc: 'مامەڵەکان + پاشگەزبوونەوە + سنووری قەرز',
    perms: ['ADD_CUSTOMER', 'ADD_DEBT', 'RECEIVE_PAYMENT', 'REVERSE_TRANSACTION', 'MANAGE_CREDIT_LIMIT']
  },
  {
    id: 'FULL',
    title: 'کارمەندی بەڕێوەبردن',
    desc: 'تەواوی دەسەڵاتەکان بۆ سەرپەرشتیار',
    perms: ['ADD_CUSTOMER', 'ADD_DEBT', 'RECEIVE_PAYMENT', 'REVERSE_TRANSACTION', 'VIEW_ANALYTICS', 'EXPORT_STATEMENTS', 'MANAGE_CREDIT_LIMIT']
  },
  {
    id: 'CUSTOM',
    title: 'دەسەڵاتی تایبەت',
    desc: 'دیاریکردنی دەستی و دروستکردنی ئاستی تایبەت',
    perms: []
  }
];

export interface EmployeeItem {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email?: string;
  role: string;
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  created_at: string;
  activation_url?: string;
  activation_token_id?: string;
}

export interface AuditLogItem {
  id: string;
  action_type: string;
  description: string;
  performed_by: string;
  timestamp: string;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose }) => {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Market Context
  const [activeMarketId, setActiveMarketId] = useState<string>('');
  const [isManagerAuthorized, setIsManagerAuthorized] = useState<boolean>(true);

  // Selected Employee Detail state
  const [selectedEmp, setSelectedEmp] = useState<EmployeeItem | null>(null);
  const [activeTab, setActiveTab] = useState<'INFO' | 'PERMISSIONS' | 'AUDIT' | 'SECURITY'>('PERMISSIONS');
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('CUSTOM');

  // Change Summary Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [addedPerms, setAddedPerms] = useState<string[]>([]);
  const [removedPerms, setRemovedPerms] = useState<string[]>([]);

  // Action Modals (Suspend / Revoke)
  const [actionModalType, setActionModalType] = useState<'SUSPEND' | 'REACTIVATE' | 'REVOKE' | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Add Employee Form Modal
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPresetId, setNewPresetId] = useState('SIMPLE');
  const [newInitialPerms, setNewInitialPerms] = useState<string[]>(['ADD_CUSTOMER', 'ADD_DEBT', 'RECEIVE_PAYMENT']);
  const [createdActivationUrl, setCreatedActivationUrl] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // Detect Authorization and Market Context
  useEffect(() => {
    if (!isOpen) return;

    let targetMarketId = activeMarketId;

    // Check user context from localStorage or window
    try {
      const rawCtx = localStorage.getItem('zhirox_active_context');
      if (rawCtx) {
        const parsed = JSON.parse(rawCtx);
        const resolvedMktId = parsed.tenant_id || parsed.marketId || parsed.market_id;
        if (resolvedMktId) {
          targetMarketId = resolvedMktId;
          setActiveMarketId(resolvedMktId);
        }

        const role = (parsed.role || '').toUpperCase();
        const persona = (parsed.persona || '').toUpperCase();

        if (role === 'EMPLOYEE' || role === 'CUSTOMER' || persona === 'EMPLOYEE' || persona === 'CUSTOMER') {
          setIsManagerAuthorized(false);
        } else {
          setIsManagerAuthorized(true);
        }
      } else {
        setIsManagerAuthorized(true);
      }
    } catch {
      setIsManagerAuthorized(true);
    }

    fetchEmployees(targetMarketId);
  }, [isOpen]);

  const fetchEmployees = async (overrideMarketId?: string) => {
    let mktId = overrideMarketId || activeMarketId;
    if (!mktId || mktId === 'SYSTEM_GLOBAL') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await authenticatedFetch(`/api/markets/${mktId}/employees`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setEmployees(data.data || []);
        setIsManagerAuthorized(true);
      } else {
        if (data.code === 'EMPLOYEE_ACCESS_DENIED' || data.code === 'CUSTOMER_ACCESS_DENIED') {
          setIsManagerAuthorized(false);
        }
        setErrorMessage(data.message || 'هەڵە لە وەرگرتنی لیستی کارمەندان');
      }
    } catch (err) {
      setErrorMessage('پەیوەندی بە سێرڤەرەوە پچڕا');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async (empId: string) => {
    setIsAuditLoading(true);
    try {
      const res = await authenticatedFetch(`/api/markets/${activeMarketId}/employees/${empId}/audit`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAuditLogs(data.data || []);
      }
    } catch {
      // silent catch
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleSelectEmployee = (emp: EmployeeItem) => {
    setSelectedEmp(emp);
    setDraftPermissions(emp.permissions || []);
    setActiveTab('PERMISSIONS');
    setErrorMessage(null);
    setSuccessMessage(null);

    // Match initial preset
    const currentPermsSet = new Set(emp.permissions || []);
    const matched = PRESETS.find(p => p.id !== 'CUSTOM' && p.perms.length === currentPermsSet.size && p.perms.every(x => currentPermsSet.has(x)));
    setSelectedPresetId(matched ? matched.id : 'CUSTOM');

    if (activeTab === 'AUDIT') {
      fetchAuditLogs(emp.id);
    }
  };

  const handleTogglePermission = (permKey: string) => {
    setDraftPermissions(prev => {
      const exists = prev.includes(permKey);
      const next = exists ? prev.filter(k => k !== permKey) : [...prev, permKey];
      
      // Update preset
      const currentPermsSet = new Set(next);
      const matched = PRESETS.find(p => p.id !== 'CUSTOM' && p.perms.length === currentPermsSet.size && p.perms.every(x => currentPermsSet.has(x)));
      setSelectedPresetId(matched ? matched.id : 'CUSTOM');

      return next;
    });
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = PRESETS.find(p => p.id === presetId);
    if (found && presetId !== 'CUSTOM') {
      setDraftPermissions(found.perms);
    }
  };

  const handleOpenSaveConfirmation = () => {
    if (!selectedEmp) return;
    const oldSet = new Set(selectedEmp.permissions || []);
    const newSet = new Set(draftPermissions);

    const added = draftPermissions.filter(p => !oldSet.has(p));
    const removed = (selectedEmp.permissions || []).filter(p => !newSet.has(p));

    if (added.length === 0 && removed.length === 0) {
      setErrorMessage('هیچ گۆڕانکارییەک ئەنجام نەدراوە');
      return;
    }

    setAddedPerms(added);
    setRemovedPerms(removed);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSavePermissions = async () => {
    if (!selectedEmp) return;
    setIsLoading(true);
    setIsConfirmModalOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch(`/api/markets/${activeMarketId}/employees/${selectedEmp.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: draftPermissions })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage('دەسەڵاتەکان بە ڕاستەوخۆ نوێکرانەوە و جێبەجێکران');
        // Update local state
        setSelectedEmp(prev => prev ? { ...prev, permissions: draftPermissions } : null);
        fetchEmployees();
      } else {
        setErrorMessage(data.message || 'خەتای نوێکردنەوەی دەسەڵاتەکان');
      }
    } catch {
      setErrorMessage('پەیوەندی بە سێرڤەرەوە پچڕا');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteStatusAction = async () => {
    if (!selectedEmp || !actionModalType) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const endpoint = `/api/markets/${activeMarketId}/employees/${selectedEmp.id}/${actionModalType.toLowerCase()}`;
    try {
      const res = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionReason })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage(data.message || 'کردارەکە بە سەرکەوتوویی ئەنجامدرا');
        setActionModalType(null);
        setActionReason('');
        fetchEmployees();
        setSelectedEmp(null);
      } else {
        setErrorMessage(data.message || 'خەتای ئەنجامدانی کردارەکە');
      }
    } catch {
      setErrorMessage('پەیوەندی بە سێرڤەرەوە پچڕا');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newPhone.trim()) {
      setErrorMessage('تکایە ناوی سیانی و ژمارەی مۆبایل بنووسە');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCreatedActivationUrl(null);

    try {
      const res = await authenticatedFetch(`/api/markets/${activeMarketId}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          phone: newPhone.trim(),
          initial_permissions: newInitialPerms
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setSuccessMessage('کارمەندی نوێ زیادکرا! تکایە بەستەری چالاککردنی بۆ بنێرە.');
        setCreatedActivationUrl(data.data.activation_url || `${window.location.origin}/activate/manager?token=${data.data.activation_token}`);
        fetchEmployees();
      } else {
        setErrorMessage(data.message || 'خەتای دروستکردنی کارمەند');
      }
    } catch {
      setErrorMessage('پەیوەندی بە سێرڤەرەوە پچڕا');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(
    e => e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || e.phone?.includes(searchQuery)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md font-sans dir-rtl" dir="rtl">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl shadow-2xl overflow-hidden text-[#F5F5F7]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C2C2E] bg-[#1C1C1E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                بەڕێوەبردنی کارمەندان
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  RBAC LIVE
                </span>
              </h2>
              <p className="text-xs text-[#8E8E93]">ڕێکخستنی دەسەڵاتەکان و دۆخی هەژماری کارمەندانی مارکێت</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ACCESS CONTROL DENIAL BANNER */}
        {!isManagerAuthorized ? (
          <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">دەستگەیشتن ڕەتکرایەوە</h3>
            <p className="text-sm text-[#8E8E93] max-w-md leading-relaxed">
              تەنها بەڕێوەبەری سەرەکی مارکێت (MARKET_MANAGER) مافی دەستکاریی دەسەڵاتی کارمەندانی هەیە.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[500px]">
            
            {/* LEFT SIDEBAR: EMPLOYEE LIST */}
            <div className={`w-full md:w-80 border-l border-[#2C2C2E] bg-[#141416] flex flex-col ${selectedEmp ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Search & Add Button */}
              <div className="p-4 border-b border-[#2C2C2E] space-y-3">
                <button
                  onClick={() => {
                    setIsAddFormOpen(true);
                    setNewFullName('');
                    setNewPhone('');
                    setCreatedActivationUrl(null);
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-500/10"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>زیادکردنی کارمەندی نوێ</span>
                </button>

                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E8E93] absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="گەڕان بەدوای کارمەند..."
                    className="w-full pr-9 pl-3 py-2 bg-[#2C2C2E] border border-transparent focus:border-emerald-500/40 rounded-xl text-xs text-white placeholder-[#8E8E93] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {isLoading && employees.length === 0 ? (
                  <div className="p-8 text-center text-[#8E8E93] text-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>لە بارکردنی کارمەندان...</span>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-[#8E8E93] text-xs">
                    هیچ کارمەندێک نەدۆزرایەوە
                  </div>
                ) : (
                  filteredEmployees.map(emp => {
                    const isSelected = selectedEmp?.id === emp.id;
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className={`p-3 rounded-2xl cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-[#2C2C2E] border-emerald-500/50 shadow-md'
                            : 'bg-[#1C1C1E]/50 border-transparent hover:bg-[#2C2C2E]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-white">{emp.full_name}</span>
                          <StatusBadge status={emp.status} />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#8E8E93] mb-2 font-mono">
                          <Phone className="w-3 h-3" />
                          <span>{emp.phone || 'دیاری نەکراوە'}</span>
                        </div>

                        {/* Permission Count Chip */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#2C2C2E] text-[#8E8E93] border border-white/5 font-mono">
                            {emp.permissions?.length || 0} دەسەڵات
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT MAIN AREA: EMPLOYEE DETAIL & PERMISSION EDITOR */}
            <div className={`flex-1 flex flex-col bg-[#1C1C1E] overflow-y-auto ${!selectedEmp ? 'hidden md:flex' : 'flex'}`}>
              
              {!selectedEmp ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93] mb-4">
                    <User className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">تکایە کارمەندێک هەڵبژێرە</h3>
                  <p className="text-xs text-[#8E8E93]">لە لیستی لای ڕاستەوە کلیک لەسەر کارمەندێک بکە بۆ بینین و ڕێکخستنی دەسەڵاتەکانی</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  
                  {/* Top Employee Profile Bar */}
                  <div className="p-5 border-b border-[#2C2C2E] bg-[#18181A] flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedEmp(null)}
                        className="md:hidden p-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93]"
                      >
                        ←
                      </button>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
                        {selectedEmp.full_name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{selectedEmp.full_name}</h3>
                          <StatusBadge status={selectedEmp.status} />
                        </div>
                        <p className="text-xs text-[#8E8E93] font-mono mt-0.5">ID: {selectedEmp.id}</p>
                      </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center p-1 bg-[#2C2C2E] rounded-xl text-xs">
                      <button
                        onClick={() => { setActiveTab('PERMISSIONS'); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === 'PERMISSIONS' ? 'bg-emerald-500 text-black shadow' : 'text-[#8E8E93] hover:text-white'}`}
                      >
                        دەسەڵاتەکان
                      </button>
                      <button
                        onClick={() => { setActiveTab('INFO'); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === 'INFO' ? 'bg-emerald-500 text-black shadow' : 'text-[#8E8E93] hover:text-white'}`}
                      >
                        زانیاری
                      </button>
                      <button
                        onClick={() => { setActiveTab('AUDIT'); fetchAuditLogs(selectedEmp.id); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === 'AUDIT' ? 'bg-emerald-500 text-black shadow' : 'text-[#8E8E93] hover:text-white'}`}
                      >
                        تۆماری کردار
                      </button>
                      <button
                        onClick={() => { setActiveTab('SECURITY'); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === 'SECURITY' ? 'bg-emerald-500 text-black shadow' : 'text-[#8E8E93] hover:text-white'}`}
                      >
                        پاراستن
                      </button>
                    </div>
                  </div>

                  {/* FEEDBACK MESSAGES */}
                  {errorMessage && (
                    <div className="mx-5 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="mx-5 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {/* TAB 1: PERMISSIONS EDITOR */}
                  {activeTab === 'PERMISSIONS' && (
                    <div className="p-5 flex-1 space-y-6 overflow-y-auto">
                      
                      {/* PRESETS BAR */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#8E8E93] block">ئاستە ئامادەکراوەکان (Presets)</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {PRESETS.map(preset => {
                            const isSelected = selectedPresetId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                onClick={() => handleApplyPreset(preset.id)}
                                className={`p-3 rounded-2xl text-right border transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-sm'
                                    : 'bg-[#2C2C2E]/40 border-transparent text-[#8E8E93] hover:bg-[#2C2C2E]'
                                }`}
                              >
                                <span className="font-bold text-xs block text-white">{preset.title}</span>
                                <span className="text-[10px] text-[#8E8E93] line-clamp-1 mt-0.5">{preset.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* PERMISSION GROUPS */}
                      <div className="space-y-5">
                        {PERMISSION_GROUPS.map((group, idx) => (
                          <div key={idx} className="p-4 rounded-2xl bg-[#141416] border border-[#2C2C2E] space-y-3">
                            <h4 className="text-xs font-bold text-emerald-400 border-b border-[#2C2C2E] pb-2 flex items-center justify-between">
                              <span>{group.groupTitle}</span>
                              <span className="text-[10px] text-[#8E8E93] font-normal">{group.items.length} دەسەڵات</span>
                            </h4>

                            <div className="space-y-2">
                              {group.items.map(item => {
                                const isChecked = draftPermissions.includes(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => handleTogglePermission(item.id)}
                                    className={`p-3 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                                      isChecked
                                        ? 'bg-[#2C2C2E] border-emerald-500/40 text-white'
                                        : 'bg-[#1C1C1E] border-transparent text-[#8E8E93] hover:bg-[#2C2C2E]/50'
                                    }`}
                                  >
                                    <div className="mt-0.5">
                                      {isChecked ? (
                                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                                      ) : (
                                        <Square className="w-5 h-5 text-[#8E8E93]" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">{item.title}</span>
                                        {item.isHighRisk && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                                            مەترسی بەرز
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">{item.desc}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SAVE BUTTON */}
                      <div className="pt-2 sticky bottom-0 bg-[#1C1C1E] py-3 border-t border-[#2C2C2E]">
                        <button
                          onClick={handleOpenSaveConfirmation}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-98 transition-all"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>پاشەکەوتکردنی دەسەڵاتەکان</span>
                        </button>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: INFO */}
                  {activeTab === 'INFO' && (
                    <div className="p-5 flex-1 space-y-4">
                      <div className="p-4 rounded-2xl bg-[#141416] border border-[#2C2C2E] space-y-3 text-xs">
                        <div className="flex justify-between py-2 border-b border-[#2C2C2E]">
                          <span className="text-[#8E8E93]">ناوی تەواو:</span>
                          <span className="font-bold text-white">{selectedEmp.full_name}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#2C2C2E]">
                          <span className="text-[#8E8E93]">ژمارەی مۆبایل / ناسنامە:</span>
                          <span className="font-bold text-white font-mono">{selectedEmp.phone}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#2C2C2E]">
                          <span className="text-[#8E8E93]">ڕۆڵی بەکارهێنەر:</span>
                          <span className="font-bold text-emerald-400">EMPLOYEE (کارمەند)</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-[#2C2C2E]">
                          <span className="text-[#8E8E93]">ڕێکەوتی دروستکردن:</span>
                          <span className="font-bold text-white font-mono">{new Date(selectedEmp.created_at).toLocaleDateString('ku')}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#8E8E93]">دۆخی هەژمار:</span>
                          <StatusBadge status={selectedEmp.status} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: AUDIT TRAIL */}
                  {activeTab === 'AUDIT' && (
                    <div className="p-5 flex-1 space-y-3 overflow-y-auto">
                      <h4 className="text-xs font-bold text-[#8E8E93] mb-2">مێژووی کرداری کارمەند (Audit Trail)</h4>
                      {isAuditLoading ? (
                        <div className="p-8 text-center text-[#8E8E93] text-xs">لە بارکردنی ڕاپۆرت...</div>
                      ) : auditLogs.length === 0 ? (
                        <div className="p-8 text-center text-[#8E8E93] text-xs bg-[#141416] rounded-2xl border border-[#2C2C2E]">
                          هیچ تۆمارێکی کردار بۆ ئەم کارمەندە تۆمار نەکراوە
                        </div>
                      ) : (
                        auditLogs.map(log => (
                          <div key={log.id} className="p-3 rounded-xl bg-[#141416] border border-[#2C2C2E] space-y-1 text-xs">
                            <div className="flex justify-between text-[11px] text-[#8E8E93]">
                              <span className="font-mono text-emerald-400">{log.action_type}</span>
                              <span className="font-mono">{new Date(log.timestamp).toLocaleString('ku')}</span>
                            </div>
                            <p className="text-white font-bold">{log.description}</p>
                            <div className="text-[10px] text-[#8E8E93]">ئەنجامدەر: {log.performed_by}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: SECURITY ACTIONS */}
                  {activeTab === 'SECURITY' && (
                    <div className="p-5 flex-1 space-y-4">
                      <div className="p-4 rounded-2xl bg-[#141416] border border-[#2C2C2E] space-y-4">
                        <h4 className="text-xs font-bold text-white mb-2">کردارەکانی پاراستن و هەژمار</h4>

                        {/* SUSPEND BUTTON */}
                        {selectedEmp.status === 'ACTIVE' && (
                          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-xs text-orange-400 block">ڕاگرتنی کاتیی هەژمار</span>
                              <span className="text-[11px] text-[#8E8E93]">ڕاگرتنی دەستگەیشتنی کارمەند بۆ ماوەیەکی دیاریکراو</span>
                            </div>
                            <button
                              onClick={() => { setActionModalType('SUSPEND'); setActionReason(''); }}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-bold text-xs rounded-xl"
                            >
                              ڕاگرتن (Suspend)
                            </button>
                          </div>
                        )}

                        {/* REACTIVATE BUTTON */}
                        {selectedEmp.status === 'SUSPENDED' && (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-xs text-emerald-400 block">چالاککردنەوەی هەژمار</span>
                              <span className="text-[11px] text-[#8E8E93]">گەڕاندنەوەی دەستگەیشتنی کارمەندەکە</span>
                            </div>
                            <button
                              onClick={() => { setActionModalType('REACTIVATE'); setActionReason(''); }}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl"
                            >
                              چالاککردنەوە
                            </button>
                          </div>
                        )}

                        {/* REVOKE BUTTON */}
                        {selectedEmp.status !== 'REVOKED' && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-xs text-red-400 block">لێسەندنەوەی یەکجارەکی دەسەڵات (Revoke)</span>
                              <span className="text-[11px] text-[#8E8E93]">سڕینەوەی یەکجارەکی دەسەڵات و ناچالاککردن لە سێرڤەر</span>
                            </div>
                            <button
                              onClick={() => { setActionModalType('REVOKE'); setActionReason(''); }}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl"
                            >
                              لێسەندنەوە (Revoke)
                            </button>
                          </div>
                        )}

                        {selectedEmp.status === 'REVOKED' && (
                          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center text-red-400 text-xs">
                            ئەم هەژمارە بە یەکجارەکی لێسەندراوە (REVOKED) و ناتوانرێت بە ڕێگەی ئاسایی چالاک بکرێتەوە.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* CHANGE SUMMARY CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 space-y-4 text-[#F5F5F7]">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>پێداچوونەوەی گۆڕانکارییەکانی دەسەڵات</span>
            </h3>

            <div className="space-y-3 text-xs">
              {addedPerms.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <span className="font-bold text-emerald-400 block">زیاد دەکرێت:</span>
                  <ul className="list-disc pr-4 text-[#8E8E93] space-y-0.5 font-mono">
                    {addedPerms.map(p => (
                      <li key={p}>+{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {removedPerms.length > 0 && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
                  <span className="font-bold text-red-400 block">لابردن:</span>
                  <ul className="list-disc pr-4 text-[#8E8E93] space-y-0.5 font-mono">
                    {removedPerms.map(p => (
                      <li key={p}>-{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmSavePermissions}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl shadow-lg"
              >
                پشتڕاستکردنەوە و بڵاوکردنەوەی ڕاستەوخۆ
              </button>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 bg-[#2C2C2E] text-[#8E8E93] font-bold text-xs rounded-xl"
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND / REVOKE / REACTIVATE REASON MODAL */}
      {actionModalType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 space-y-4 text-[#F5F5F7]">
            <h3 className="text-base font-bold text-white">
              {actionModalType === 'SUSPEND' && 'ڕاگرتنی کاتیی هەژمار'}
              {actionModalType === 'REACTIVATE' && 'چالاککردنەوەی هەژمار'}
              {actionModalType === 'REVOKED' && 'لێسەندنەوەی یەکجارەکی دەسەڵات'}
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-[#8E8E93] block">هۆکاری ئەنجامدانی کردارەکە:</label>
              <input
                type="text"
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                placeholder="هۆکار بنووسە..."
                className="w-full p-3 bg-[#2C2C2E] border border-transparent focus:border-emerald-500/40 rounded-xl text-xs text-white placeholder-[#8E8E93] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExecuteStatusAction}
                className={`flex-1 py-2.5 font-bold text-xs rounded-xl shadow-lg ${
                  actionModalType === 'REVOKE' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'
                }`}
              >
                پشتڕاستکردنەوە
              </button>
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2.5 bg-[#2C2C2E] text-[#8E8E93] font-bold text-xs rounded-xl"
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD EMPLOYEE FORM MODAL */}
      {isAddFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 space-y-5 text-[#F5F5F7] max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-[#2C2C2E] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>زیادکردنی کارمەندی نوێ</span>
              </h3>
              <button onClick={() => setIsAddFormOpen(false)} className="text-[#8E8E93] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdActivationUrl ? (
              <div className="space-y-4 text-center py-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">کارمەند بە سەرکەوتوویی تۆمارکرا</h4>
                <p className="text-xs text-[#8E8E93]">
                  تکایە ئەم بەستەرە کۆپی بکە و بۆ کارمەندەکەی بنێرە بۆ چالاککردنی هەژمارەکەی:
                </p>

                <div className="p-3 rounded-xl bg-[#141416] border border-[#2C2C2E] text-xs font-mono text-emerald-400 break-all select-all">
                  {createdActivationUrl}
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdActivationUrl);
                    alert('بەستەری چالاککردن کۆپی کرا');
                  }}
                  className="w-full py-2.5 bg-emerald-500 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>کۆپیکردنی بەستەر</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] block">ناوی سیانی کارمەند *</label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={e => setNewFullName(e.target.value)}
                    placeholder="نموونە: ئارام ئەحمەد عەلی"
                    className="w-full p-3 bg-[#2C2C2E] border border-transparent focus:border-emerald-500/40 rounded-xl text-xs text-white placeholder-[#8E8E93] outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] block">ژمارەی مۆبایل / ناسنامەی چوونەژوورەوە *</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="07701234567"
                    className="w-full p-3 bg-[#2C2C2E] border border-transparent focus:border-emerald-500/40 rounded-xl text-xs text-white placeholder-[#8E8E93] outline-none font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] block">دەسەڵاتی سەرەتایی</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setNewPresetId(p.id);
                          if (p.id !== 'CUSTOM') setNewInitialPerms(p.perms);
                        }}
                        className={`p-2.5 rounded-xl border text-right text-xs transition-all ${
                          newPresetId === p.id
                            ? 'bg-emerald-500/10 border-emerald-500 text-white font-bold'
                            : 'bg-[#2C2C2E]/50 border-transparent text-[#8E8E93]'
                        }`}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>دروستکردنی کارمەند</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddFormOpen(false)}
                    className="px-4 py-3 bg-[#2C2C2E] text-[#8E8E93] font-bold text-xs rounded-xl"
                  >
                    پاشگەزبوونەوە
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

// Helper Component for Status Badges
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
          چالاک
        </span>
      );
    case 'PENDING_ACTIVATION':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
          چاودێڕی چالاککردن
        </span>
      );
    case 'SUSPENDED':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
          ڕاگیراو
        </span>
      );
    case 'REVOKED':
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
          لێسەندراو (Revoked)
        </span>
      );
    default:
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-bold">
          {status}
        </span>
      );
  }
};
