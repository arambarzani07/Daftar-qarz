import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, CheckCircle2, XCircle, Clock, ShieldAlert, AlertCircle, RefreshCw, User, FileText, Filter } from 'lucide-react';
import { ApprovalRequest, ApprovalStatus } from '../types';

interface ApprovalsScreenProps {
  marketId: string;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefreshNeeded?: () => void;
}

export const ApprovalsScreen: React.FC<ApprovalsScreenProps> = ({
  marketId,
  apiFetch,
  onRefreshNeeded
}) => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    if (!marketId) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/markets/${marketId}/approvals`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
          setApprovals(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [marketId, apiFetch]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleApprove = async (approvalId: string) => {
    setActionLoadingId(approvalId);
    try {
      const res = await apiFetch(`/api/markets/${marketId}/approvals/${approvalId}/approve`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('داواکارییەکە بەسەرکەوتوویی پەسەندکرا');
        await loadApprovals();
        if (onRefreshNeeded) onRefreshNeeded();
      } else {
        alert(json.message || 'هەڵەیەک ڕوویدا لە پەسەندکردندا');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('پەیوەندی سەرنەکەوت');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    const reason = window.prompt('هۆکاری ڕەتکردنەوە بنووسە:') || 'ڕەتکرایەوە لەلایەن خاوەن کار';
    setActionLoadingId(approvalId);
    try {
      const res = await apiFetch(`/api/markets/${marketId}/approvals/${approvalId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('داواکارییەکە ڕەتکرایەوە');
        await loadApprovals();
        if (onRefreshNeeded) onRefreshNeeded();
      } else {
        alert(json.message || 'هەڵەیەک ڕوویدا');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('پەیوەندی سەرنەکەوت');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredApprovals = approvals.filter((app) => {
    if (filterStatus === 'ALL') return true;
    return app.status === filterStatus;
  });

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT_LIMIT_CHANGE':
      case 'CREDIT_LIMIT_OVERRIDE':
        return 'گۆڕینی ڕادەی قەرز (سەقف)';
      case 'DEBT_REVERSAL':
      case 'PAYMENT_REVERSAL':
        return 'هەڵوەشاندنەوەی مامەڵە';
      case 'TEMPORARY_UNLOCK':
      case 'MANUAL_UNLOCK':
        return 'کردنەوەی کاتی قەرزدار';
      case 'HIGH_RISK_DEBT':
      case 'HIGH_RISK_DEBT_APPROVAL':
        return 'پەسەندکردنی قەرزی بەرزی پڕمەترسی';
      case 'FORGIVENESS':
        return 'خۆشبوون لە قەرز';
      default:
        return type;
    }
  };

  return (
    <div dir="rtl" className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1C1C1E]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#F5F5F7]">سەنتەری پەسەندکردنەکان</h1>
            <p className="text-xs text-[#8E8E93]">داواکارییەکانی ڕێگەپێدان و چاودێری خاوەن کار</p>
          </div>
        </div>

        <button
          onClick={loadApprovals}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#1C1C1E] text-[#8E8E93] hover:text-white transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilterStatus('PENDING')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            filterStatus === 'PENDING'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          چاوەڕوانکراو ({pendingCount})
        </button>

        <button
          onClick={() => setFilterStatus('APPROVED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            filterStatus === 'APPROVED'
              ? 'bg-emerald-500 text-black'
              : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          پەسەندکراو
        </button>

        <button
          onClick={() => setFilterStatus('REJECTED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            filterStatus === 'REJECTED'
              ? 'bg-rose-500 text-white'
              : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          ڕەتکراوە
        </button>

        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            filterStatus === 'ALL'
              ? 'bg-[#2C2C2E] text-white'
              : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
          }`}
        >
          هەمووان ({approvals.length})
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#8E8E93]">
          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-emerald-400" />
          <p className="text-xs">بارکردنی داواکارییەکان...</p>
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-[#1C1C1E]/50 rounded-2xl border border-[#2C2C2E] p-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mb-3" />
          <h3 className="text-sm font-bold text-[#F5F5F7]">هیچ داواکارییەک لەم دۆخەدا نییە</h3>
          <p className="text-xs text-[#8E8E93] mt-1">
            سەرجەم داواکارییەکانی ڕێگەپێدان و چاودێری ئەرکەکان لێرە دەردەکەون.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredApprovals.map((req) => (
            <div
              key={req.id}
              className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-[#3C3C3E]"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20 mb-1.5">
                    {getActionTypeLabel(req.action_type)}
                  </span>
                  <p className="text-sm font-bold text-white">{req.reason}</p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    req.status === 'PENDING'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : req.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {req.status === 'PENDING'
                    ? 'چاوەڕوانکراو'
                    : req.status === 'APPROVED'
                    ? 'پەسەندکراو'
                    : 'ڕەتکراوە'}
                </span>
              </div>

              {/* Amount & Currency if any */}
              {typeof req.requested_amount === 'number' && req.requested_amount > 0 && (
                <div className="bg-[#000000]/40 rounded-xl p-2.5 flex items-center justify-between border border-[#2C2C2E]">
                  <span className="text-xs text-[#8E8E93]">بڕی داواکراو:</span>
                  <span className="text-sm font-extrabold text-emerald-400 dir-ltr">
                    {req.requested_amount.toLocaleString()} {req.currency || 'IQD'}
                  </span>
                </div>
              )}

              {/* Details Footer */}
              <div className="flex items-center justify-between text-[11px] text-[#8E8E93] pt-2 border-t border-[#2C2C2E]/60">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#8E8E93]" />
                  کارمەند: {req.requester_user_id || 'سیستەم'}
                </span>
                <span>{new Date(req.created_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Action Buttons if PENDING */}
              {req.status === 'PENDING' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionLoadingId === req.id}
                    className="py-2 px-3 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 active:scale-95 transition-all flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20"
                  >
                    {actionLoadingId === req.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        پەسەندکردن
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionLoadingId === req.id}
                    className="py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    ڕەتکردنەوە
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
