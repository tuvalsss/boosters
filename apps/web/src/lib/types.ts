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
