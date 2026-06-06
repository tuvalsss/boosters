import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrivyClient, type AuthTokenClaims, type User as PrivyUser } from '@privy-io/server-auth';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';

/**
 * Thin wrapper around the real Privy server SDK. Constructs the client lazily so
 * the API still boots for non-auth work when secrets are absent; any auth call
 * then fails loudly with a clear message instead of silently faking a result.
 */
@Injectable()
export class PrivyService {
  private readonly logger = new Logger(PrivyService.name);
  private client: PrivyClient | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** True when Privy credentials are configured. */
  get isConfigured(): boolean {
    return Boolean(this.env.PRIVY_APP_ID && this.env.PRIVY_APP_SECRET);
  }

  private getClient(): PrivyClient {
    if (!this.isConfigured) {
      throw new UnauthorizedException(
        'Auth is not configured: set PRIVY_APP_ID and PRIVY_APP_SECRET in .env',
      );
    }
    if (!this.client) {
      this.client = new PrivyClient(this.env.PRIVY_APP_ID!, this.env.PRIVY_APP_SECRET!);
    }
    return this.client;
  }

  /** Verify a Privy access token and return its claims (throws if invalid). */
  async verifyAccessToken(token: string): Promise<AuthTokenClaims> {
    try {
      return await this.getClient().verifyAuthToken(token, this.env.PRIVY_VERIFICATION_KEY);
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  /** Fetch the full Privy user profile by DID. */
  getUser(userId: string): Promise<PrivyUser> {
    return this.getClient().getUser(userId);
  }
}

/** Extract the user's primary email + Solana wallet from a Privy profile. */
export function extractPrivyIdentity(user: PrivyUser): {
  email: string | null;
  solanaWallet: string | null;
} {
  const email = user.email?.address ?? null;

  // Prefer a linked Solana wallet; fall back to the primary wallet if it's Solana.
  let solanaWallet: string | null = null;
  for (const acct of user.linkedAccounts) {
    if (acct.type === 'wallet' && acct.chainType === 'solana') {
      solanaWallet = acct.address;
      break;
    }
  }
  if (!solanaWallet && user.wallet?.chainType === 'solana') {
    solanaWallet = user.wallet.address;
  }

  return { email, solanaWallet };
}
