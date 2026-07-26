export type MembershipLifecycleStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export type AuthLinkageStatus = 'LINKED' | 'PENDING_ACTIVATION' | 'INCOMPLETE';

export type AccountHealthFlag =
  | 'MISSING_AUTH_LINK'
  | 'MISSING_MEMBERSHIP'
  | 'PENDING_ACTIVATION'
  | 'EXPIRED_ACTIVATION'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'AMBIGUOUS_MANAGER_RELATIONSHIP';

export interface AccountOpsRecord {
  market_id: string;
  official_market_name: string;
  official_registered_phone: string;
  currency: 'IQD' | 'USD';
  license_status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  license_expires_at: string;
  created_at: string;
  
  // Current Manager Info
  manager_user_id: string;
  manager_name: string;
  manager_login_phone: string;
  manager_email?: string;
  manager_role: 'OWNER' | 'MANAGER' | 'MARKET_OWNER';
  
  // Lifecycle & Status
  membership_id: string;
  membership_status: MembershipLifecycleStatus;
  activation_status: 'READY' | 'EXPIRED' | 'REVOKED' | 'ACTIVATED' | 'NONE';
  auth_linkage_status: AuthLinkageStatus;
  
  // Timestamps
  activated_at?: string | null;
  last_activity_at?: string | null;
  
  // Activation details (if PENDING_ACTIVATION or replacement)
  activation_token_id?: string;
  raw_activation_url?: string;
  activation_token_expires_at?: string;
  
  // Pending replacement details
  pending_replacement?: {
    candidate_user_id: string;
    candidate_name: string;
    candidate_login_phone: string;
    candidate_email?: string;
    activation_token_id?: string;
    raw_activation_url?: string;
    activation_expires_at?: string;
    created_at: string;
  } | null;

  // Health Flags
  health_flags: AccountHealthFlag[];
}

export interface AccountOpsSummary {
  total_accounts: number;
  active_count: number;
  pending_activation_count: number;
  suspended_count: number;
  revoked_count: number;
  needs_review_count: number;
}
