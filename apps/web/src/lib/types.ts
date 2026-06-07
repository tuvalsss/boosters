// Shared API response shapes (mirror the API's `publicUser` and enums).

export type UserRole = 'USER' | 'OPS' | 'ADMIN';
export type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AccountHold = 'NONE' | 'NEW_ACCOUNT' | 'MANUAL_REVIEW' | 'SUSPENDED';

export interface PublicUser {
  id: string;
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  role: UserRole;
  kycStatus: KycStatus;
  hold: AccountHold;
  reputationScore: number;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  createdAt: string;
}

export const isStaff = (role: UserRole | undefined): boolean => role === 'ADMIN' || role === 'OPS';

export type VaultState =
  | 'INTAKE'
  | 'AUTHENTICATING'
  | 'GRADED'
  | 'VAULTED'
  | 'RESERVED'
  | 'RELEASED';

export interface VaultItemRow {
  id: string;
  state: VaultState;
  physicalCard: {
    cardName: string;
    category: string;
    grader: string;
    grade: string | null;
    setName: string | null;
    certNumber: string | null;
  };
  owner: { id: string; email: string | null; walletAddress: string | null };
  token: { cnftAssetId: string; mintSignature: string } | null;
}
