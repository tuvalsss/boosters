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

export interface CardSummary {
  cardName: string;
  category: string;
  grader: string;
  grade: string | null;
  setName: string | null;
  photos: { url: string; kind: string }[];
}

export interface ListingRow {
  id: string;
  priceUsdc: string;
  type: 'FIRST_PARTY' | 'P2P';
  status: 'ACTIVE' | 'HELD' | 'SOLD' | 'CANCELLED';
  vaultItem: { id: string; physicalCard: CardSummary; token?: { cnftAssetId: string } | null };
  seller: { id: string; displayName: string | null };
}

export interface TokenHolding {
  id: string;
  cnftAssetId: string;
  vaultItem: { id: string; state: VaultState; physicalCard: CardSummary };
}

export interface OrderRow {
  id: string;
  type: string;
  status: string;
  amountUsdc: string;
  feeUsdc: string;
  createdAt: string;
}

export interface WalletData {
  balanceUsdc: string;
  holdings: TokenHolding[];
  orders: OrderRow[];
}

export interface PackListItem {
  id: string;
  name: string;
  priceUsdc: string;
  status: string;
  _count?: { poolItems: number };
}

export interface PackPoolEntry {
  poolItemId: string;
  tier: string | null;
  consumed: boolean;
  weight: number;
  oddsPct: number;
  card: { cardName: string; grader: string; grade: string | null; category: string };
}

export interface PackDetail {
  id: string;
  name: string;
  priceUsdc: string;
  status: string;
  remaining: number;
  pool: PackPoolEntry[];
}

export interface PackOpening {
  id: string;
  status: string;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  resultVaultItemId: string | null;
}

export interface VerifyOpening extends PackOpening {
  pack: { id: string; name: string } | null;
  proof: {
    algorithm?: string;
    candidates?: { poolItemId: string; vaultItemId: string; weight: number }[];
    floatHex?: string;
    float?: number;
    index?: number;
  };
  result: { id: string; physicalCard: CardSummary } | null;
  revealedAt: string | null;
}

export type SubmissionStatus =
  | 'DRAFT'
  | 'LABEL_GENERATED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'AUTHENTICATING'
  | 'GRADING'
  | 'PHOTOGRAPHED'
  | 'MINTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface SubmissionEvent {
  id: string;
  status: SubmissionStatus;
  note: string | null;
  createdAt: string;
}

export interface Submission {
  id: string;
  status: SubmissionStatus;
  declaredCard: {
    cardName?: string;
    category?: string;
    grader?: string;
    setName?: string;
    certNumber?: string;
    declaredGrade?: string;
    notes?: string;
  };
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
  vaultItemId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  events: SubmissionEvent[];
  user?: { id: string; email: string | null; walletAddress: string | null };
  vaultItem?: { id: string; state: VaultState; token?: { cnftAssetId: string } | null } | null;
}
