import {
  getActiveEntitlements,
  isRevenueCatConfigured,
  RevenueCatUnavailableError,
} from "../lib/revenuecat";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { UserRepository } from "../repositories/user.repository";

export interface SubscriptionState {
  tier: "FREE" | "PRO";
  isActive: boolean;
  expiresAt: Date | null;
  lastSyncedAt: Date | null;
  isFresh: boolean;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export class SubscriptionService {
  private subscriptionRepo = new SubscriptionRepository();
  private userRepo = new UserRepository();

  private async pullFromRevenueCat(userId: string): Promise<SubscriptionState> {
    const entitlements = await getActiveEntitlements(userId);

    // Any active entitlement grants Pro: the v2 API returns internal ids, not lookup keys. If a
    // second entitlement is ever added this becomes silently wrong; match on its `entl...` id then.
    const pro = entitlements[0];
    const isActive = entitlements.length > 0;
    const hasGrant = !!(await this.userRepo.findProGrant(userId));

    // null is a real state (a lifetime or open-ended promotional grant), not a missing value.
    const expiresAt = pro?.expires_at ? new Date(pro.expires_at) : null;
    const lastSyncedAt = new Date();

    await this.subscriptionRepo.upsertForUser(userId, {
      entitlementId: pro?.entitlement_id ?? null,
      isActive,
      expiresAt,
      lastSyncedAt,
    });

    await this.userRepo.upsertUserSettings(userId, {
      subscriptionTier: isActive || hasGrant ? "PRO" : "FREE",
    });

    return { tier: isActive || hasGrant ? "PRO" : "FREE", isActive, expiresAt, lastSyncedAt, isFresh: true };
  }

  // Falls back to the stored copy rather than failing: the client calls this on every launch.
  async syncSubscription(userId: string): Promise<SubscriptionState> {
    try {
      return await this.pullFromRevenueCat(userId);
    } catch (error) {
      if (!(error instanceof RevenueCatUnavailableError)) throw error;

      return this.readStored(userId);
    }
  }

  private async readStored(userId: string): Promise<SubscriptionState> {
    const stored = await this.subscriptionRepo.findByUser(userId);
    const hasGrant = !!(await this.userRepo.findProGrant(userId));

    return {
      tier: stored?.isActive || hasGrant ? "PRO" : "FREE",
      isActive: stored?.isActive ?? false,
      expiresAt: stored?.expiresAt ?? null,
      lastSyncedAt: stored?.lastSyncedAt ?? null,
      isFresh: false,
    };
  }

  // A failed pull never downgrades anyone: revoking paid access on a network hiccup is worse
  // than serving a few hours of lapsed access.
  async getSubscription(userId: string): Promise<SubscriptionState> {
    const stored = await this.subscriptionRepo.findByUser(userId);

    const now = Date.now();

    const isStale =
      !stored?.lastSyncedAt ||
      now - stored.lastSyncedAt.getTime() > STALE_AFTER_MS ||
      (!!stored.expiresAt && stored.expiresAt.getTime() <= now);

    if (isStale && isRevenueCatConfigured()) {
      try {
        return await this.pullFromRevenueCat(userId);
      } catch (error) {
        if (!(error instanceof RevenueCatUnavailableError)) throw error;
      }
    }

    return this.readStored(userId);
  }
}
