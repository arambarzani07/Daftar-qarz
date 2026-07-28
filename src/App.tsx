/**
 * ZHIROX DEBT SYSTEM - CORE UI BASELINE (FROZEN & LOCKED)
 * Official Core UI Design Freeze: Do not redesign or alter visual/layout structure.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Customer,
  Transaction,
  MarketSummary,
  SortOption,
  ActiveScreen,
  SearchFilters,
  AppSettings,
  CurrencyType,
  AuthState
} from './types';
import { TopActionBar } from './components/TopActionBar';
import { FinancialSummaryCard } from './components/FinancialSummaryCard';
import { CustomerList } from './components/CustomerList';
import { CustomerProfileHeader } from './components/CustomerProfileHeader';
import { TransactionTimeline } from './components/TransactionTimeline';
import { TransactionComposer } from './components/TransactionComposer';
import { AddCustomerSheet } from './components/AddCustomerSheet';
import { SearchHeader } from './components/SearchHeader';
import { SearchFiltersSheet } from './components/SearchFiltersSheet';
import { SettingsScreen } from './components/SettingsScreen';
import { CustomerStatementModal } from './components/CustomerStatementModal';
import { CustomerAdvancedProfileModal } from './components/CustomerAdvancedProfileModal';
import { CustomerDebtCard } from './components/CustomerDebtCard';
import { ShareLinkSheet } from './components/ShareLinkSheet';
import { PublicCustomerBalanceView } from './components/PublicCustomerBalanceView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { EditTransactionModal } from './components/EditTransactionModal';
import { PrintStatementPage } from './components/PrintStatementPage';

import { PlatformOwnerDashboard } from './components/platform/PlatformOwnerDashboard';

import { LoginPage } from './components/auth/LoginPage';
import { SelectContextPage } from './components/auth/SelectContextPage';
import { AccessDeniedPage } from './components/auth/AccessDeniedPage';
import { AuthLoadingScreen } from './components/auth/AuthLoadingScreen';
import { RecoveryPage } from './components/auth/RecoveryPage';
import { UpdatePasswordPage } from './components/auth/UpdatePasswordPage';
import { ActivationPage } from './components/auth/ActivationPage';
import { supabase } from './lib/supabaseClient';

function safeReplaceState(url: string) {
  try {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const target = url && typeof url === 'string' ? encodeURI(url) : '/';
      window.history.replaceState({}, '', target);
    }
  } catch (e) {
    console.warn('Failed to update browser history:', e);
  }
}

export default function App() {
  const [authStatus, setAuthStatus] = useState<'LOADING' | 'UNAUTHENTICATED' | 'AUTHENTICATED' | 'SELECT_CONTEXT' | 'ACCESS_DENIED'>('LOADING');
  const [authState, setAuthState] = useState<AuthState>({
    status: 'SIGNED_OUT',
  });

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  const publicMatch = path.match(/^\/(?:b|balance|customer-balance)\/([a-zA-Z0-9_-]+)/);
  const publicToken = publicMatch ? publicMatch[1] : null;

  // Handle /login redirect to /auth/login
  useEffect(() => {
    if (path === '/login') {
      safeReplaceState('/auth/login');
    }
  }, [path]);

  // Session Restoration & Auth Context Resolution on Mount
  useEffect(() => {
    async function restoreSession() {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isPublic = currentPath.match(/^\/(?:b|balance|customer-balance)\/([a-zA-Z0-9_-]+)/);
      const isActivate = currentPath.startsWith('/activate');
      const isUpdatePassword = currentPath.startsWith('/auth/update-password');
      const isRecovery = currentPath.startsWith('/auth/recovery');

      if (isPublic || isActivate || isUpdatePassword || isRecovery) {
        setAuthStatus('AUTHENTICATED');
        return;
      }

      const rawToken = localStorage.getItem('zhirox_session_token');
      if (!rawToken || typeof rawToken !== 'string') {
        setAuthStatus('UNAUTHENTICATED');
        if (currentPath !== '/auth/login' && currentPath !== '/auth/select-context' && currentPath !== '/auth/access-denied') {
          safeReplaceState('/auth/login');
        }
        return;
      }

      // Ensure header token contains only ASCII printable characters to prevent fetch DOMException
      const token = rawToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim();
      if (!token) {
        localStorage.removeItem('zhirox_session_token');
        setAuthStatus('UNAUTHENTICATED');
        if (currentPath !== '/auth/login' && currentPath !== '/auth/select-context' && currentPath !== '/auth/access-denied') {
          safeReplaceState('/auth/login');
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/context', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Cache-Control': 'no-store'
          }
        });
        const json = await res.json();

        if (res.ok && json.status === 'success' && json.data) {
          const contexts = Array.isArray(json.data.contexts) ? json.data.contexts : [];
          const defaultContext = json.data.defaultContext || contexts[0] || { role: 'MARKET_MANAGER', tenant_id: 'default' };

          if (contexts.length > 1 && (currentPath === '/auth/select-context' || !localStorage.getItem('zhirox_active_context'))) {
            setAuthStatus('SELECT_CONTEXT');
            setAuthState({
              status: 'CONTEXT_SELECTION_REQUIRED',
              contexts,
              activeContext: defaultContext
            });
            if (currentPath !== '/auth/select-context') {
              safeReplaceState('/auth/select-context');
            }
            return;
          }

          const activeCtxStr = localStorage.getItem('zhirox_active_context');
          let chosenContext = defaultContext;
          if (activeCtxStr && defaultContext?.role !== 'PLATFORM_OWNER') {
            try {
              const parsed = JSON.parse(activeCtxStr);
              const found = contexts.find((c: any) => c.tenant_id === parsed.tenant_id || c.context_id === parsed.context_id);
              if (found) chosenContext = found;
            } catch {}
          }

          setAuthStatus('AUTHENTICATED');
          setAuthState({
            status: 'AUTHENTICATED',
            identity: json.data.identity?.authUserId || 'user',
            activeContext: chosenContext,
            contexts,
            sessionToken: token
          });

          if (currentPath === '/auth/login' || currentPath === '/login' || currentPath === '/') {
            if (chosenContext?.role === 'PLATFORM_OWNER') {
              safeReplaceState('/admin/control-plane');
            } else if (chosenContext?.role === 'CUSTOMER') {
              const tenantId = encodeURIComponent(chosenContext.tenant_id || 'default');
              const customerId = encodeURIComponent(chosenContext.customer_id || 'me');
              safeReplaceState(`/portal/${tenantId}/${customerId}`);
            } else {
              const tenantId = encodeURIComponent(chosenContext?.tenant_id || 'default');
              safeReplaceState(`/app/${tenantId}/dashboard`);
            }
          }
        } else {
          localStorage.removeItem('zhirox_session_token');
          localStorage.removeItem('zhirox_active_context');
          const isForbidden = res.status === 403;
          setAuthStatus(isForbidden ? 'ACCESS_DENIED' : 'UNAUTHENTICATED');
          if (isForbidden) {
            safeReplaceState('/auth/access-denied');
          } else if (currentPath !== '/auth/login') {
            safeReplaceState('/auth/login');
          }
        }
      } catch (err: any) {
        console.error('Session restoration error:', err?.message || err, err?.stack);
        console.error('Failed token was:', token ? `${token.substring(0, 10)}... (length: ${token.length})` : 'none');
        setAuthStatus('UNAUTHENTICATED');
        if (currentPath !== '/auth/login') {
          safeReplaceState('/auth/login');
        }
      }
    }

    restoreSession();
  }, []);

  const handleLoginSuccess = (sessionToken: string, activeContext: any, contexts: any[]) => {
    const cleanToken = sessionToken ? sessionToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim() : '';
    localStorage.setItem('zhirox_session_token', cleanToken);
    localStorage.setItem('zhirox_active_context', JSON.stringify(activeContext || {}));

    if (contexts && contexts.length > 1 && (!activeContext || contexts.length > 1)) {
      setAuthStatus('SELECT_CONTEXT');
      setAuthState({
        status: 'CONTEXT_SELECTION_REQUIRED',
        contexts,
        activeContext,
        sessionToken: cleanToken
      });
      safeReplaceState('/auth/select-context');
      return;
    }

    setAuthStatus('AUTHENTICATED');
    setAuthState({
      status: 'AUTHENTICATED',
      identity: activeContext?.tenant_id || 'user',
      activeContext,
      contexts,
      sessionToken: cleanToken
    });

    if (activeContext?.role === 'PLATFORM_OWNER') {
      safeReplaceState('/admin/control-plane');
    } else if (activeContext?.role === 'CUSTOMER') {
      const tenantId = encodeURIComponent(activeContext.tenant_id || 'default');
      const customerId = encodeURIComponent(activeContext.customer_id || 'me');
      safeReplaceState(`/portal/${tenantId}/${customerId}`);
    } else {
      const tenantId = encodeURIComponent(activeContext?.tenant_id || 'default');
      safeReplaceState(`/app/${tenantId}/dashboard`);
    }
  };

  const handleSelectContext = (context: any) => {
    localStorage.setItem('zhirox_active_context', JSON.stringify(context || {}));
    setAuthState(prev => ({
      ...prev,
      status: 'AUTHENTICATED',
      activeContext: context
    }));
    setAuthStatus('AUTHENTICATED');

    if (context?.role === 'PLATFORM_OWNER') {
      safeReplaceState('/admin/control-plane');
    } else if (context?.role === 'CUSTOMER') {
      const tenantId = encodeURIComponent(context.tenant_id || 'default');
      const customerId = encodeURIComponent(context.customer_id || 'me');
      safeReplaceState(`/portal/${tenantId}/${customerId}`);
    } else {
      const tenantId = encodeURIComponent(context?.tenant_id || 'default');
      safeReplaceState(`/app/${tenantId}/dashboard`);
    }
  };

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('zhirox_session_token');
    localStorage.removeItem('zhirox_active_context');
    setAuthStatus('UNAUTHENTICATED');
    setAuthState({ status: 'SIGNED_OUT' });
    safeReplaceState('/auth/login');
    window.location.reload();
  }, []);

  // Navigation State
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Data State
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // UI & Loading State
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sheets & Modals State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isAdvancedProfileOpen, setIsAdvancedProfileOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSort, setCurrentSort] = useState<SortOption>('oldest');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});

  // API Fetch helper with X-Market-ID header injection
  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const activeCtxStr = localStorage.getItem('zhirox_active_context');
    let marketId = '';
    if (activeCtxStr) {
      try {
        const parsed = JSON.parse(activeCtxStr);
        marketId = parsed.tenant_id || '';
      } catch (e) {}
    } else if (authState.activeContext?.tenant_id) {
      marketId = authState.activeContext.tenant_id;
    }

    if (!marketId && authState.activeContext?.role !== 'PLATFORM_OWNER') {
      marketId = '';
    }

    const rawToken = typeof window !== 'undefined' ? localStorage.getItem('zhirox_session_token') : null;
    const token = rawToken ? rawToken.replace(/[^a-zA-Z0-9_\-.]/g, '').trim() : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {})
    };
    if (marketId && marketId !== 'SYSTEM_GLOBAL') {
      headers['X-Market-ID'] = marketId;
    }
    return fetch(url, { ...options, headers });
  }, [authState.activeContext]);

  // Fetch Market Summary
  const loadSummary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/market/summary');
      if (!res.ok) return;
      const text = await res.text();
      if (!text) return;
      const json = JSON.parse(text);
      if (json && json.status === 'success') {
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, [apiFetch]);

  // Theme synchronization effect
  useEffect(() => {
    const theme = summary?.settings?.theme || 'dark';
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [summary?.settings?.theme]);

  // Fetch Customers List
  const loadCustomers = useCallback(async (sortOpt = currentSort, query = searchQuery) => {
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams();
      if (sortOpt) params.set('sort', sortOpt);
      if (query) params.set('q', query);

      const res = await apiFetch(`/api/customers?${params.toString()}`);
      if (!res.ok) return;
      const text = await res.text();
      if (!text) return;
      const json = JSON.parse(text);
      if (json && json.status === 'success') {
        setCustomers(json.data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [currentSort, searchQuery, apiFetch]);

  // Fetch Single Customer Profile & Transactions
  const loadCustomerTransactions = useCallback(async (customerId: string) => {
    setIsLoadingTxs(true);
    try {
      // Refresh customer data
      const custRes = await apiFetch(`/api/customers/${customerId}`);
      if (custRes.ok) {
        const custText = await custRes.text();
        if (custText) {
          const custJson = JSON.parse(custText);
          if (custJson && custJson.status === 'success') {
            setSelectedCustomer(custJson.data);
          }
        }
      }

      // Refresh transactions
      const txRes = await apiFetch(`/api/customers/${customerId}/transactions`);
      if (txRes.ok) {
        const txText = await txRes.text();
        if (txText) {
          const txJson = JSON.parse(txText);
          if (txJson && txJson.status === 'success') {
            setTransactions(txJson.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoadingTxs(false);
    }
  }, [apiFetch]);

  // Initial Load
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') {
      return;
    }
    if (authState.activeContext?.role === 'PLATFORM_OWNER' || authState.activeContext?.role === 'CUSTOMER') {
      return;
    }
    loadSummary();
    loadCustomers();
  }, [authStatus, authState.activeContext?.role, loadSummary, loadCustomers]);

  // Handle Refresh Action
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadSummary(), loadCustomers()]);
    if (selectedCustomer) {
      await loadCustomerTransactions(selectedCustomer.id);
    }
    setIsRefreshing(false);
  };

  // Select Customer & Open Profile
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setActiveScreen('customer_profile');
    loadCustomerTransactions(customer.id);
  };

  // Add New Customer
  const handleAddCustomerSubmit = async (data: {
    name: string;
    latin_name?: string;
    phone?: string;
    password?: string;
    currency: CurrencyType;
    notes?: string;
  }) => {
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ ...data, password: data.password || '123456' })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await Promise.all([loadSummary(), loadCustomers()]);
        // Open newly created customer immediately
        handleSelectCustomer(json.data);
      } else {
        throw new Error(json.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Transaction (Debt or Payment)
  const handleAddTransaction = async (
    type: 'DEBT_ADD' | 'PAYMENT_RECEIVE',
    amount: number,
    currency: CurrencyType,
    note: string
  ) => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/customers/${selectedCustomer.id}/transactions`, {
        method: 'POST',
        body: JSON.stringify({ type, amount, currency, note })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await Promise.all([
          loadCustomerTransactions(selectedCustomer.id),
          loadSummary(),
          loadCustomers()
        ]);
      } else {
        throw new Error(json.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reverse Transaction
  const handleReverseTx = async (tx: Transaction) => {
    if (!selectedCustomer) return;
    const confirmRev = window.confirm('ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم مامەڵەیە؟');
    if (!confirmRev) return;

    try {
      const res = await apiFetch(`/api/customers/${selectedCustomer.id}/transactions/${tx.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'هەڵوەشاندنەوە لەلایەن خاوەن کار' })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await Promise.all([
          loadCustomerTransactions(selectedCustomer.id),
          loadSummary(),
          loadCustomers()
        ]);
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error('Failed to reverse transaction:', err);
    }
  };

  // Edit Transaction Submit
  const handleEditTxSubmit = async (
    txId: string,
    updatedData: { amount: number; currency: 'IQD' | 'USD'; type: 'DEBT_ADD' | 'PAYMENT_RECEIVE'; note: string }
  ) => {
    if (!selectedCustomer) return;
    try {
      const res = await apiFetch(`/api/customers/${selectedCustomer.id}/transactions/${txId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updatedData,
          updated_by: summary?.settings?.owner_name || authState.activeContext?.tenant_name || 'خاوەن کار'
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        await Promise.all([
          loadCustomerTransactions(selectedCustomer.id),
          loadSummary(),
          loadCustomers()
        ]);
      } else {
        alert(json.message || 'دەستکاریی مامەڵە سەرکەوتوو نەبوو');
      }
    } catch (err) {
      console.error('Failed to edit transaction:', err);
    }
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      const json = await res.json();
      if (json.status === 'success') {
        await loadSummary();
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // Filtered customers for search view
  const searchFilteredCustomers = customers.filter((c) => {
    if (searchFilters.currency && searchFilters.currency !== 'ALL') {
      if (c.currency !== searchFilters.currency) return false;
    }
    if (searchFilters.txType && searchFilters.txType !== 'ALL') {
      // filters based on activity
    }
    return true;
  });

  // 1. If public share link URL detected, render Public Live Balance view
  if (publicToken) {
    return <PublicCustomerBalanceView token={publicToken} />;
  }

  // 1b. Manager/Staff/Customer Activation Page Route
  if (path === '/activate' || path.startsWith('/activate')) {
    return <ActivationPage onActivationSuccess={handleLoginSuccess} />;
  }

  // 2. Auth Loading State
  if (authStatus === 'LOADING') {
    return <AuthLoadingScreen />;
  }

  // 3. Forgot Password Recovery Request Route
  if (path === '/auth/recovery' || path.startsWith('/auth/recovery')) {
    return <RecoveryPage />;
  }

  // 3b. Update Password Recovery Route
  if (path === '/auth/update-password' || path.startsWith('/auth/update-password')) {
    return <UpdatePasswordPage onSuccess={() => {}} />;
  }

  // 3b. Unauthenticated / Login View
  if (authStatus === 'UNAUTHENTICATED' || path === '/auth/login' || path === '/login') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3c. Print Statement Route (A4 High-Fidelity Printable View)
  if (path.startsWith('/market/print-statement') || path.startsWith('/customer/print-statement')) {
    return <PrintStatementPage />;
  }

  // 4. Context Selection View (Multi-market manager)
  if (authStatus === 'SELECT_CONTEXT' || path === '/auth/select-context') {
    return (
      <SelectContextPage
        contexts={authState.contexts || []}
        onSelectContext={handleSelectContext}
        onLogout={signOut}
      />
    );
  }

  // 5. Access Denied View
  if (authStatus === 'ACCESS_DENIED' || path === '/auth/access-denied') {
    return <AccessDeniedPage onLogout={signOut} />;
  }

  // Render Customer Portal View if persona is CUSTOMER
  if (authState.activeContext?.role === 'CUSTOMER') {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col">
        <CustomerPortalView
          customerId={authState.activeContext.customer_id || ''}
          onLogout={signOut}
        />
      </div>
    );
  }

  // Render Platform Owner View if persona is PLATFORM_OWNER
  if (authState.activeContext?.role === 'PLATFORM_OWNER') {
    return (
      <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col">
        <PlatformOwnerDashboard
          onLogout={signOut}
          currentIdentity={authState.identity || ''}
        />
      </div>
    );
  }

  const isManager = authState.activeContext?.role === 'MARKET_MANAGER' || !authState.activeContext?.role;
  const canAddCustomer = isManager || !!(authState.activeContext?.permissions?.includes('ADD_CUSTOMER'));
  const canAddDebt = isManager || !!(authState.activeContext?.permissions?.includes('ADD_DEBT'));
  const canReceivePayment = isManager || !!(authState.activeContext?.permissions?.includes('RECEIVE_PAYMENT'));

  return (
    <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] font-sans antialiased flex flex-col">

      
      {/* 1. HOME SCREEN */}
      {activeScreen === 'home' && (
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <TopActionBar
            marketName={authState.activeContext?.tenant_name || summary?.market_name || summary?.settings?.market_name}
            onRefresh={handleRefresh}
            onAddCustomer={() => {
              if (!canAddCustomer) {
                alert('تۆ دەسەڵاتی زیادکردنی کڕیاری نوێت نییە');
                return;
              }
              setIsAddCustomerOpen(true);
            }}
            onOpenSearch={() => setActiveScreen('search')}
            onOpenSettings={() => setActiveScreen('settings')}
            isRefreshing={isRefreshing}
            canAddCustomer={canAddCustomer}
          />

          {/* Financial Summary Card */}
          <FinancialSummaryCard
            totalIqd={summary?.total_debt_iqd || 0}
            totalUsd={summary?.total_debt_usd || 0}
            customerCount={summary?.customer_count || customers.length}
          />

          {/* Customer Debt List */}
          <CustomerList
            customers={customers}
            onSelectCustomer={handleSelectCustomer}
            onAddCustomer={() => {
              if (!canAddCustomer) {
                alert('تۆ دەسەڵاتی زیادکردنی کڕیاری نوێت نییە');
                return;
              }
              setIsAddCustomerOpen(true);
            }}
            currentSort={currentSort}
            onSortChange={(s) => {
              setCurrentSort(s);
              loadCustomers(s, searchQuery);
            }}
            isLoading={isLoadingCustomers}
            canAddCustomer={canAddCustomer}
          />
        </div>
      )}

      {/* 2. CUSTOMER PROFILE SCREEN ("FINANCIAL CHAT") */}
      {activeScreen === 'customer_profile' && selectedCustomer && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-black">
          {/* Header */}
          <CustomerProfileHeader
            customer={selectedCustomer}
            onBack={() => setActiveScreen('home')}
            onOpenStatement={() => setIsStatementModalOpen(true)}
            onShareLink={() => setIsShareSheetOpen(true)}
          />

          {/* Scrollable Chat Timeline */}
          <TransactionTimeline
            transactions={transactions}
            onReverseTx={
              authState.activeContext?.role === 'MARKET_MANAGER' ||
              (authState.activeContext?.permissions && authState.activeContext.permissions.includes('REVERSE_TRANSACTION'))
                ? handleReverseTx
                : undefined
            }
            onEditTx={
              authState.activeContext?.role === 'MARKET_MANAGER' ||
              (authState.activeContext?.permissions && authState.activeContext.permissions.includes('EDIT_TRANSACTION'))
                ? (tx) => {
                    setEditingTransaction(tx);
                    setIsEditTransactionOpen(true);
                  }
                : undefined
            }
            isLoading={isLoadingTxs}
          />

          {/* Expandable Bottom Composer */}
          <TransactionComposer
            key={selectedCustomer.id}
            balanceIqd={selectedCustomer.balance_iqd}
            balanceUsd={selectedCustomer.balance_usd}
            customerCurrency={selectedCustomer.currency}
            onAddTransaction={handleAddTransaction}
            isSubmitting={isSubmitting}
            canAddDebt={canAddDebt}
            canReceivePayment={canReceivePayment}
          />

          {/* Customer Statement Modal (Phase 2 Statement & Export Engine) */}
          <CustomerStatementModal
            isOpen={isStatementModalOpen}
            onClose={() => setIsStatementModalOpen(false)}
            customer={selectedCustomer}
            marketName={authState.activeContext?.tenant_name || summary?.market_name || 'ژیرۆکس'}
            settings={summary?.settings || undefined}
            onOpenAdvancedProfile={() => {
              setIsStatementModalOpen(false);
              setIsAdvancedProfileOpen(true);
            }}
          />

          {/* Customer Advanced Profile Modal (Phase 1 Deep Management) */}
          <CustomerAdvancedProfileModal
            isOpen={isAdvancedProfileOpen}
            onClose={() => setIsAdvancedProfileOpen(false)}
            customer={selectedCustomer}
            transactions={transactions}
            marketName={authState.activeContext?.tenant_name || summary?.market_name || 'ژیرۆکس'}
            onCustomerUpdated={() => {
              loadCustomers();
              loadSummary();
              if (selectedCustomer) loadCustomerTransactions(selectedCustomer.id);
            }}
            userRole={authState.activeContext?.role}
            userPermissions={authState.activeContext?.permissions}
          />

          {/* Share Live Link Sheet */}
          <ShareLinkSheet
            isOpen={isShareSheetOpen}
            onClose={() => setIsShareSheetOpen(false)}
            customer={selectedCustomer}
          />

          {/* Edit Transaction Modal */}
          <EditTransactionModal
            isOpen={isEditTransactionOpen}
            onClose={() => {
              setIsEditTransactionOpen(false);
              setEditingTransaction(null);
            }}
            transaction={editingTransaction}
            onSave={handleEditTxSubmit}
            onReverse={
              authState.activeContext?.role === 'MARKET_MANAGER' ||
              (authState.activeContext?.permissions && authState.activeContext.permissions.includes('REVERSE_TRANSACTION'))
                ? handleReverseTx
                : undefined
            }
          />
        </div>
      )}

      {/* 3. SEARCH SCREEN */}
      {activeScreen === 'search' && (
        <div className="flex-1 flex flex-col min-h-screen bg-black">
          <SearchHeader
            query={searchQuery}
            onQueryChange={(q) => {
              setSearchQuery(q);
              loadCustomers(currentSort, q);
            }}
            onBack={() => setActiveScreen('home')}
            onOpenFilters={() => setIsSearchFiltersOpen(true)}
            hasActiveFilters={Boolean(searchFilters.currency && searchFilters.currency !== 'ALL')}
          />

          {/* Search Results List */}
          <div className="flex-1 px-4 py-3 max-w-md mx-auto w-full">
            <div className="text-xs font-semibold text-[#8E8E93] mb-3">
              ئەنجامی گەڕان ({searchFilteredCustomers.length})
            </div>

            {searchFilteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-[#8E8E93] text-sm">
                هیچ ئەنجامێک بۆ گەڕانەکەت نەدۆزرایەوە
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {searchFilteredCustomers.map((c) => (
                  <CustomerDebtCard
                    key={c.id}
                    customer={c}
                    onClick={handleSelectCustomer}
                  />
                ))}
              </div>
            )}
          </div>

          <SearchFiltersSheet
            isOpen={isSearchFiltersOpen}
            onClose={() => setIsSearchFiltersOpen(false)}
            filters={searchFilters}
            onApplyFilters={(f) => setSearchFilters(f)}
          />
        </div>
      )}

      {/* 4. SETTINGS SCREEN */}
      {activeScreen === 'settings' && (
        <SettingsScreen
          settings={summary?.settings || {
            market_name: 'ژیرۆکس',
            owner_name: 'خاوەن شوێن',
            market_id: 'market-1',
            pin_enabled: false,
            pin_code: '1234',
            language: 'ku',
            default_currency: 'IQD'
          }}
          onUpdateSettings={handleUpdateSettings}
          onBack={() => setActiveScreen('home')}
          defaultSort={currentSort}
          onUpdateDefaultSort={(s) => setCurrentSort(s)}
          onLogout={signOut}
          userRole={authState.activeContext?.role}
          userPermissions={authState.activeContext?.permissions}
        />
      )}

      {/* ADD CUSTOMER BOTTOM SHEET */}
      <AddCustomerSheet
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSubmit={handleAddCustomerSubmit}
        isSubmitting={isSubmitting}
      />

    </div>
  );
}
