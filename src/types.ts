export type CurrencyType = 'IQD' | 'USD';

export type TransactionType = 'DEBT_ADD' | 'PAYMENT_RECEIVE' | 'OPENING_BALANCE' | 'FORGIVENESS' | 'REVERSAL' | 'ADJUSTMENT_DEBIT' | 'ADJUSTMENT_CREDIT';

export interface Customer {
  id: string;
  market_id: string;
  seq_num: number;
  name: string;
  latin_name?: string;
  phone?: string;
  password?: string;
  whatsapp?: string;
  address?: string;
  currency: CurrencyType;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  balance_iqd: number;
  balance_usd: number;
  last_activity?: string;
  transaction_count?: number;
}

export interface CustomerCreditSettings {
  customer_id: string;
  market_id: string;
  limit_iqd: number;
  limit_usd: number;
  policy: 'NONE' | 'SOFT' | 'HARD';
  lock_status: 'ACTIVE' | 'SOFT_WARNING' | 'LOCKED' | 'TEMPORARY_UNLOCK';
  updated_at?: string;
}

export interface PaymentPromise {
  id: string;
  customer_id: string;
  market_id: string;
  amount: number;
  currency: CurrencyType;
  promised_date: string;
  note: string;
  status: 'PENDING' | 'FULFILLED' | 'BROKEN' | 'CANCELLED';
  created_at: string;
  created_by: string;
}

export interface CustomerReminder {
  id: string;
  customer_id: string;
  market_id: string;
  follow_up_date: string;
  reason: string;
  status: 'PENDING' | 'COMPLETED';
  created_at: string;
}

export interface CustomerAttachment {
  id: string;
  customer_id: string;
  market_id: string;
  file_name: string;
  file_type: string;
  file_data_url?: string;
  description?: string;
  created_at: string;
  uploaded_by: string;
}

export interface CustomerDispute {
  id: string;
  customer_id: string;
  market_id: string;
  transaction_id?: string;
  title: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  created_at: string;
  created_by: string;
}

export interface CustomerAuditLog {
  id: string;
  customer_id: string;
  market_id: string;
  action_type: string;
  description: string;
  performed_by: string;
  timestamp: string;
}

export interface StatementTransaction extends Transaction {
  running_balance: number;
}

export interface StatementData {
  customer: Customer;
  currency: CurrencyType;
  from_date: string | null;
  to_date: string | null;
  opening_balance: number;
  period_total_debt: number;
  period_total_payments: number;
  closing_balance: number;
  transactions: StatementTransaction[];
  total_count: number;
}

export interface CustomerFinancialSummary {
  total_debt_iqd: number;
  total_payments_iqd: number;
  total_debt_usd: number;
  total_payments_usd: number;
  debt_tx_count_iqd: number;
  payment_tx_count_iqd: number;
  debt_tx_count_usd: number;
  payment_tx_count_usd: number;
  largest_debt_iqd: number;
  largest_payment_iqd: number;
  largest_debt_usd: number;
  largest_payment_usd: number;
  first_tx_date: string | null;
  latest_tx_date: string | null;
  latest_payment_date: string | null;
}

export interface CustomerMoneyHealth {
  days_since_last_payment: number | null;
  avg_payment_interval_days: number | null;
  avg_payment_amount_iqd: number | null;
  avg_payment_amount_usd: number | null;
  debt_growth_trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  status_message: string;
}

export interface RiskAssessment {
  score: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  explanation: string;
}

export interface CustomerAdvancedProfileData {
  customer: Customer;
  balances: {
    iqd: number;
    usd: number;
  };
  financial_summary: CustomerFinancialSummary;
  money_health: CustomerMoneyHealth;
  credit_settings: CustomerCreditSettings;
  risk_assessment: RiskAssessment;
  promises: PaymentPromise[];
  reminders: CustomerReminder[];
  attachments: CustomerAttachment[];
  disputes: CustomerDispute[];
  audit_logs: CustomerAuditLog[];
}

export interface Transaction {
  id: string;
  customer_id: string;
  market_id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyType;
  note: string;
  timestamp: string;
  created_by: string;
  reversed?: boolean;
  reversed_reason?: string;
}

export interface ShareLink {
  id: string;
  market_id: string;
  customer_id: string;
  token: string;
  share_url?: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  access_count: number;
  last_accessed_at?: string | null;
  pin_code?: string | null;
}

export interface PublicCustomerBalance {
  market_name: string;
  customer_name: string;
  currency: CurrencyType;
  balance_iqd: number;
  balance_usd: number;
  transactions: {
    id: string;
    type: TransactionType;
    amount: number;
    currency: CurrencyType;
    note: string;
    timestamp: string;
  }[];
  updated_at: string;
}

export interface MarketSummary {
  market_name: string;
  owner_name: string;
  total_debt_iqd: number;
  total_debt_usd: number;
  customer_count: number;
  transaction_count: number;
  settings: AppSettings;
}

export interface AppSettings {
  market_name: string;
  owner_name: string;
  owner_phone?: string;
  market_id: string;
  pin_enabled: boolean;
  pin_code: string;
  language: 'ku' | 'ar' | 'en';
  default_currency: CurrencyType;
  theme?: 'dark' | 'light';
  is_locked_by_system?: boolean;
}

export type SortOption = 'newest' | 'oldest' | 'highest_debt' | 'lowest_debt' | 'recent' | 'alphabetical';

export type ActiveScreen = 'home' | 'customer_profile' | 'search' | 'settings';

export type AuthPersona = 'PLATFORM_OWNER' | 'MARKET_MANAGER' | 'EMPLOYEE' | 'CUSTOMER';

export interface AuthorizedContext {
  context_id: string;
  tenant_id: string;
  tenant_name: string;
  role: AuthPersona;
  role_label_ku: string;
  is_default?: boolean;
  permissions?: string[];
  customer_id?: string;
}

export type AuthStatus =
  | 'SIGNED_OUT'
  | 'AUTHENTICATING'
  | 'IDENTITY_RESOLVING'
  | 'CONTEXT_SELECTION_REQUIRED'
  | 'AUTHENTICATED'
  | 'STEP_UP_REQUIRED'
  | 'ACCOUNT_RESTRICTED'
  | 'ACCOUNT_SUSPENDED'
  | 'SESSION_EXPIRED'
  | 'RECOVERY_REQUIRED';

export interface AuthState {
  status: AuthStatus;
  identity?: string;
  method?: 'PASSWORD' | 'OTP' | 'PASSKEY';
  contexts?: AuthorizedContext[];
  activeContext?: AuthorizedContext;
  sessionToken?: string;
  error?: string;
  message?: string;
}

export interface ActivationState {
  status: 'IDLE' | 'VALIDATING' | 'VALID' | 'EXPIRED' | 'USED' | 'REVOKED' | 'COMPLETE';
  token?: string;
  tenant_name?: string;
  recipient_name?: string;
  role_label?: string;
  message?: string;
}

export interface SearchFilters {
  txType?: 'ALL' | 'DEBT_ADD' | 'PAYMENT_RECEIVE';
  currency?: 'ALL' | 'IQD' | 'USD';
  minAmount?: string;
  maxAmount?: string;
  startDate?: string;
  endDate?: string;
}

export interface PlatformMarket {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  registered_phone?: string;
  manager_login_phone?: string;
  created_at: string;
  license_expires_at: string;
  managers_count: number;
  customers_count: number;
  currency: 'IQD' | 'USD';
}

export interface PlatformManager {
  id: string;
  market_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'MARKET_MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  created_at: string;
}

export interface PlatformOverview {
  total_markets: number;
  active_markets: number;
  suspended_markets: number;
  expired_licenses: number;
  total_managers: number;
  total_customers: number;
}

export interface SystemUser {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: 'MARKET_MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  created_at: string;
}

export type ApprovalRequestType =
  | 'CREDIT_LIMIT_OVERRIDE'
  | 'LOCKED_CUSTOMER_DEBT'
  | 'HIGH_RISK_DEBT'
  | 'MANUAL_UNLOCK'
  | 'DEBT_REVERSAL'
  | 'PAYMENT_REVERSAL'
  | 'FORGIVENESS'
  | 'ADJUSTMENT_DEBIT'
  | 'ADJUSTMENT_CREDIT'
  | 'CREDIT_LIMIT_CHANGE'
  | 'DEBT_LOCK_OVERRIDE'
  | 'TEMPORARY_UNLOCK'
  | 'HIGH_RISK_DEBT_APPROVAL'
  | 'SENSITIVE_TRANSACTION_OVERRIDE';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONSUMED' | 'EXECUTED';

export interface ApprovalRequest {
  id: string;
  market_id: string;
  customer_id?: string;
  requester_user_id: string;
  action_type: ApprovalRequestType;
  requested_amount?: number;
  currency?: CurrencyType;
  target_transaction_id?: string;
  requested_changes?: any;
  reason: string;
  status: ApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  executed_at?: string | null;
  expires_at: string;
  created_at: string;
}

export interface TemporaryDebtUnlock {
  id: string;
  market_id: string;
  customer_id: string;
  actor_id: string;
  approved_by?: string;
  reason: string;
  currency?: CurrencyType;
  max_amount?: number;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  expires_at: string;
  created_at: string;
}

export interface MarketProtectionPolicy {
  market_id: string;
  credit_limit_mode?: 'NO_LIMIT' | 'SOFT_LIMIT' | 'HARD_LIMIT';
  high_value_iqd_threshold: number;
  high_value_usd_threshold: number;
  require_approval_for_reversals: boolean;
  require_approval_for_credit_limit_change: boolean;
  max_temp_unlock_hours: number;
  updated_at: string;
}

export type RecoveryCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type RecoveryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface RecoveryCase {
  id: string;
  market_id: string;
  customer_id: string;
  status: RecoveryCaseStatus;
  priority: RecoveryPriority;
  assigned_user_id?: string | null;
  reason?: string | null;
  opened_at: string;
  closed_at?: string | null;
  last_activity_at?: string | null;
}

export type RecoveryActivityType =
  | 'CALL_ATTEMPT'
  | 'CUSTOMER_CONTACT'
  | 'PROMISE_CREATED'
  | 'PROMISE_BROKEN'
  | 'NOTE'
  | 'ESCALATION'
  | 'PAYMENT_OBSERVED';

export interface RecoveryActivity {
  id: string;
  case_id: string;
  market_id: string;
  customer_id: string;
  activity_type: RecoveryActivityType;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type ProtectionSignal = 'NORMAL' | 'WATCH' | 'HIGH_RISK' | 'LOCKED';

export interface CustomerProtectionSummary {
  customer_id: string;
  market_id: string;
  protection_signal: ProtectionSignal;
  risk_score: number;
  risk_reasons: string[];
  lock_status: 'UNLOCKED' | 'LOCKED';
  lock_reason?: string;
  active_unlock?: TemporaryDebtUnlock | null;
  credit_settings: CustomerCreditSettings;
  active_promises: PaymentPromise[];
  recovery_case?: RecoveryCase | null;
  recent_activities?: RecoveryActivity[];
  pending_approvals?: ApprovalRequest[];
  recent_audits?: CustomerAuditLog[];
}


