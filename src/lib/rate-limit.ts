import type { NextFunction, Response } from "express";
import type { IUserRequest } from "../interface";
import { redis } from "./redis-connection";

interface RateLimitOptions {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Requests allowed per window. */
  max: number;
  /** Namespaces the counter so limits do not collide across routes. */
  keyPrefix: string;
  /**
   * Extra identity beyond the IP — usually the submitted email. Without it an
   * attacker on one IP is limited, but an attacker rotating IPs against one
   * account is not.
   */
  identify?: (req: IUserRequest) => string | undefined;
  message?: string;
}

/*
  Redis-backed so the limit holds across instances; an in-memory counter would
  reset on every deploy and be trivially bypassed once the API scales past one
  process.

  Fails OPEN. If Redis is unreachable the request is allowed through — a cache
  outage locking every user out of signing in is a worse failure than briefly
  losing rate limiting, and the Redis health check already shouts about it.
*/
export const rateLimit = function (options: RateLimitOptions) {
  const { windowSeconds, max, keyPrefix, identify, message } = options;

  return async function (req: IUserRequest, res: Response, next: NextFunction) {
    try {
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      const extra = identify?.(req);
      const key = `ratelimit:${keyPrefix}:${extra ? `${extra}:` : ""}${ip}`;

      const count = await redis.incr(key);

      // Only set the TTL on first hit, or the window would slide forward on
      // every request and never expire under sustained load.
      if (count === 1) await redis.expire(key, windowSeconds);

      if (count > max) {
        const ttl = await redis.ttl(key);

        res.setHeader("Retry-After", Math.max(ttl, 1));
        return res.status(429).json({
          message: message ?? "Too many attempts. Please try again shortly.",
          retryAfterSeconds: Math.max(ttl, 1),
        });
      }

      return next();
    } catch (error) {
      console.error("Rate limiter unavailable, allowing request:", error);
      return next();
    }
  };
};

const ATTEMPT_LIMIT = 5;

/*
  Counts wrong OTP guesses for one user and reports when the allowance is spent.

  Separate from rateLimit: that caps request volume, this caps guesses against a
  specific code. A six-digit OTP is only 1,000,000 possibilities, so without
  this the reset flow is a viable path to account takeover — the request limiter
  alone just slows it down.
*/
export const otpAttempts = {
  key: (scope: string, userId: string) => `otp-attempts:${scope}:${userId}`,

  async record(scope: string, userId: string, ttlSeconds: number) {
    const key = this.key(scope, userId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSeconds);
    return count;
  },

  async isExhausted(scope: string, userId: string) {
    const value = await redis.get(this.key(scope, userId));
    return Number(value ?? 0) >= ATTEMPT_LIMIT;
  },

  async clear(scope: string, userId: string) {
    await redis.del(this.key(scope, userId));
  },

  limit: ATTEMPT_LIMIT,
};
