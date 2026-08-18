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
  /** False when the state is our stored copy rather than a fresh pull. */
  isFresh: boolean;
}

/*
  How long a synced entitlement is trusted before the read path pulls again.
  A lapsed subscription is caught at the next sync, so this is the worst-case
  lag on a downgrade — traded against calling RevenueCat on every read.
*/
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export class SubscriptionService {
  private subscriptionRepo = new SubscriptionRepository();
  private userRepo = new UserRepository();

  /*
    Pulls the truth from RevenueCat and writes it to our own copy.

    Entitlement is derived here and nowhere else. The client never tells us what
    it is entitled to — it can only ask us to go and look — because a client
    saying "I am pro" is untrusted input.
  */
  private async pullFromRevenueCat(userId: string): Promise<SubscriptionState> {
    const entitlements = await getActiveEntitlements(userId);

    /*
      **Any active entitlement grants Pro**, rather than one matched by name.

      The v2 API returns the entitlement's internal object id (`entl55f1cfa7eb`)
      and not its lookup key, so there is nothing here to compare "pro" against —
      matching on the name is exactly the bug this replaces, and it kept a
      customer who had genuinely paid on FREE with no error anywhere.

      This is correct because the project defines exactly one entitlement, which
      is also the product decision in §12: one paid tier, Free and Pro. **If a
      second entitlement is ever added, this becomes wrong silently** — at that
      point put its `entl...` id in an env var and match on it, or expand
      `items.entitlement` and match on `lookup_key`.
    */
    const pro = entitlements[0];
    const isActive = entitlements.length > 0;

    /*
      `expires_at` is null on a non-expiring grant, which is a real state and not
      a missing value — a lifetime purchase or a promotional entitlement with no
      end date both look like this.
    */
    const expiresAt = pro?.expires_at ? new Date(pro.expires_at) : null;
    const lastSyncedAt = new Date();

    await this.subscriptionRepo.upsertForUser(userId, {
      // Store what RevenueCat actually called it, so the id is on hand if this
      // ever needs to become a strict match.
      entitlementId: pro?.entitlement_id ?? null,
      isActive,
      expiresAt,
      lastSyncedAt,
    });

    // The tier is what every gate reads, so it is the thing that has to end up
    // correct; the subscription row is the evidence behind it.
    await this.userRepo.upsertUserSettings(userId, {
      subscriptionTier: isActive ? "PRO" : "FREE",
    });

    return { tier: isActive ? "PRO" : "FREE", isActive, expiresAt, lastSyncedAt, isFresh: true };
  }

  /*
    The public sync. Falls back to the stored copy when RevenueCat cannot be
    reached, rather than failing the request.

    The client calls this on every launch, so throwing here would mean a 500 and
    an error toast on every cold start the moment the network blinks or the
    project id is missing. `isFresh: false` is how the caller can tell the
    difference without being interrupted by it.
  */
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

    return {
      tier: stored?.isActive ? "PRO" : "FREE",
      isActive: stored?.isActive ?? false,
      expiresAt: stored?.expiresAt ?? null,
      lastSyncedAt: stored?.lastSyncedAt ?? null,
      isFresh: false,
    };
  }

  /*
    The read path. Serves the stored copy, and pulls again only when that copy is
    stale or has expired.

    **A failed pull never downgrades anyone.** If RevenueCat is unreachable the
    stored state is returned untouched — revoking paid access on a network
    hiccup is far worse than serving a few hours of access that has technically
    lapsed, and the sync will correct it as soon as the call succeeds.
  */
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
