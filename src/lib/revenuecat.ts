import { getEnv } from "./get-env";

const API_BASE = "https://api.revenuecat.com/v2";

export interface ActiveEntitlement {
  /*
    **This is RevenueCat's internal object id (`entl...`), not the `pro` lookup
    key you type into the dashboard.** Verified against the live API: a customer
    holding the `pro` entitlement comes back as
    `{ entitlement_id: "entl55f1cfa7eb", ... }`.

    Comparing it to "pro" is what silently kept a paying customer on FREE — the
    purchase registered correctly and the match simply never hit.
  */
  entitlement_id: string;
  expires_at: number | null;
}

/*
  Raised when RevenueCat could not be reached or answered with an error. It is
  deliberately distinct from "the customer has no entitlements": the caller must
  be able to tell a definite "not subscribed" from "we do not know right now",
  because downgrading someone on a failed request would revoke access they paid
  for every time the network hiccups.
*/
export class RevenueCatUnavailableError extends Error {
  constructor(message = "Could not reach RevenueCat") {
    super(message);
    this.name = "RevenueCatUnavailableError";
  }
}

const config = function () {
  const { REVENUE_CAT_SECRET, REVENUE_CAT_PROJECT_ID } = getEnv([
    "REVENUE_CAT_SECRET",
    "REVENUE_CAT_PROJECT_ID",
  ]);

  if (!REVENUE_CAT_SECRET || !REVENUE_CAT_PROJECT_ID) {
    throw new RevenueCatUnavailableError("RevenueCat is not configured");
  }

  return { secret: REVENUE_CAT_SECRET, projectId: REVENUE_CAT_PROJECT_ID };
};

export const isRevenueCatConfigured = function () {
  const { REVENUE_CAT_SECRET, REVENUE_CAT_PROJECT_ID } = getEnv([
    "REVENUE_CAT_SECRET",
    "REVENUE_CAT_PROJECT_ID",
  ]);

  return !!REVENUE_CAT_SECRET && !!REVENUE_CAT_PROJECT_ID;
};

/*
  The customer's currently active entitlements.

  A 404 means RevenueCat has never seen this customer — which is the normal state
  for anyone who has not opened a paywall — so it resolves to an empty list
  rather than throwing. Every other failure throws, so the caller keeps whatever
  tier it already had.
*/
export const getActiveEntitlements = async function (
  customerId: string,
): Promise<ActiveEntitlement[]> {
  const { secret, projectId } = config();

  const url = `${API_BASE}/projects/${projectId}/customers/${encodeURIComponent(customerId)}/active_entitlements`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      // Without a ceiling a hung request would hold the caller open; a sync is
      // not worth blocking a request on for longer than this.
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new RevenueCatUnavailableError();
  }

  if (response.status === 404) return [];

  if (!response.ok) {
    throw new RevenueCatUnavailableError(
      `RevenueCat responded ${response.status}`,
    );
  }

  const payload = (await response.json()) as { items?: ActiveEntitlement[] };

  return payload.items ?? [];
};
