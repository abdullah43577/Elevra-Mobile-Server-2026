import { getEnv } from "./get-env";

const API_BASE = "https://api.revenuecat.com/v2";

export interface ActiveEntitlement {
  // RevenueCat's internal id (`entl...`), not the `pro` lookup key: comparing it to "pro"
  // never matches and leaves paying customers on FREE.
  entitlement_id: string;
  expires_at: number | null;
}

// Distinct from "no entitlements" so a failed request never downgrades a paying customer.
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

// A 404 means RevenueCat has never seen this customer, the normal state, so it is an empty list.
export const getActiveEntitlements = async function (
  customerId: string,
): Promise<ActiveEntitlement[]> {
  const { secret, projectId } = config();

  const url = `${API_BASE}/projects/${projectId}/customers/${encodeURIComponent(customerId)}/active_entitlements`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
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
