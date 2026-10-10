import { AiQuotaExceededError, AiUnavailableError } from "./errors";
import { redis } from "./redis-connection";

const DAILY_LIMIT = 50;
const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;
// The connection sets maxRetriesPerRequest: null, so a command against a dead
// Redis waits forever. Failing closed needs a deadline of its own.
const REDIS_DEADLINE_MS = 2000;

const quotaKey = function (userId: string) {
  return `ai-quota:${userId}:${new Date().toISOString().slice(0, 10)}`;
};

const withDeadline = function <T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis deadline exceeded")), REDIS_DEADLINE_MS)),
  ]);
};

/*
  Fails CLOSED, unlike rateLimit. Unmetered AI calls during a Redis outage risk
  exhausting or getting the provider keys banned for every user; a few minutes
  without AI is the cheaper failure.
*/
const failClosed = function (error: unknown): never {
  if (error instanceof AiQuotaExceededError) throw error;
  console.error("[ai-quota] Redis unavailable, refusing AI call:", error);
  throw new AiUnavailableError();
};

// Read-only, for refusing before a stream opens so the status code is honest.
export const assertAiQuota = async function (userId: string) {
  try {
    const used = Number(await withDeadline(redis.get(quotaKey(userId)))) || 0;
    if (used >= DAILY_LIMIT) throw new AiQuotaExceededError();
  } catch (error) {
    failClosed(error);
  }
};

// Counts one AI call. Lives beside assertPro in the service layer, so no route
// can reach a model without passing through it.
export const consumeAiQuota = async function (userId: string) {
  try {
    const key = quotaKey(userId);
    const used = await withDeadline(redis.incr(key));
    if (used === 1) await withDeadline(redis.expire(key, KEY_TTL_SECONDS));
    if (used > DAILY_LIMIT) throw new AiQuotaExceededError();
  } catch (error) {
    failClosed(error);
  }
};
