import IORedis from "ioredis";
import { getEnv } from "./get-env";
const { REDIS_URL, REDIS_HOST, REDIS_PASS, REDIS_USERNAME, REDIS_PORT, REDIS_DB, NODE_ENV } =
  getEnv(["REDIS_URL", "REDIS_HOST", "REDIS_PASS", "REDIS_USERNAME", "REDIS_PORT", "REDIS_DB", "NODE_ENV"]);

const commonOptions = {
  maxRetriesPerRequest: null,
  connectTimeout: 10000,
  lazyConnect: false,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
};

/*
  Never log a Redis url raw — a managed provider's url carries the password in
  the authority, and this one is printed on every boot into a hosting dashboard.
*/
const redact = function (url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? "***:***@" : ""}${parsed.hostname}:${parsed.port || "6379"}`;
  } catch {
    return "<unparseable REDIS_URL>";
  }
};

/*
  REDIS_URL wins over everything else, and that ordering is deliberate.

  Every managed provider (Render Key Value, Upstash, Redis Cloud) hands you one
  url carrying host, port, credentials and database — and a `rediss://` scheme
  turns TLS on by itself, which is the thing the discrete-field config below
  cannot express and the reason a TLS-only provider could not be used at all.

  It also defuses the branch underneath it: with a url set, a stray
  NODE_ENV=development in production can no longer redirect the whole app at
  localhost:6379 and fail every OTP on the box.
*/
const buildConnection = function () {
  if (REDIS_URL) {
    console.log(`🔧 Redis config: REDIS_URL -> ${redact(REDIS_URL)}`);
    return new IORedis(REDIS_URL, commonOptions);
  }

  // Local development, unchanged: docker-compose puts Redis on the default port.
  if (NODE_ENV === "development") {
    console.log("🔧 Redis config: development default -> redis://localhost:6379");
    return new IORedis({ host: "localhost", port: 6379, ...commonOptions });
  }

  /*
    ioredis resolves an undefined host to 127.0.0.1, so a missing REDIS_URL in
    production used to look identical to a Redis that was merely down: an
    endless ECONNREFUSED against a loopback address nobody configured. Say so
    out loud instead — this branch is only correct when the discrete fields are
    deliberately set.
  */
  if (!REDIS_HOST) {
    console.error("❌ Neither REDIS_URL nor REDIS_HOST is set. Redis will be dialled at 127.0.0.1:6379 and will fail.");
    console.error(`   NODE_ENV=${NODE_ENV ?? "<unset>"}. Set REDIS_URL on this service and redeploy.`);
  }

  console.log(`🔧 Redis config: discrete fields -> ${REDIS_HOST ?? "<unset>"}:${REDIS_PORT ?? 6379}`);

  return new IORedis({
    host: REDIS_HOST,
    port: Number(REDIS_PORT ?? 6379),
    ...(REDIS_USERNAME && { username: REDIS_USERNAME }),
    ...(REDIS_PASS && { password: REDIS_PASS }),
    // Previously read from the env and then never applied, so a non-zero
    // REDIS_DB silently did nothing. Most managed free tiers only offer db 0.
    ...(REDIS_DB && { db: Number(REDIS_DB) }),
    ...commonOptions,
  });
};

export const redis = buildConnection();

// Add error handlers with rate limiting to reduce log spam
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 30_000; // 30s. Was 3e14 (~9,500 years), so errors logged once and never again.

redis.on("error", err => {
  const now = Date.now();
  if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
    const code = (err as NodeJS.ErrnoException).code;
    console.error(`❌ Redis connection error [${code ?? "no code"}]:`, err.message);
    console.error(`   Target: ${redis.options.host}:${redis.options.port}`);
    console.warn("⚠️  Email queueing will not work until Redis is available.");
    lastErrorLogTime = now;
  }
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
  lastErrorLogTime = 0; // Reset error log timer on successful connection
});

redis.on("ready", () => {
  console.log("✅ Redis ready to accept commands");
});

/*
  Fails fast at boot rather than at the first OTP request.

  Redis holds hashed OTPs and the rate-limit counters, so a dead Redis means
  nobody can sign up, verify an email, or reset a password — but the API would
  otherwise start cleanly and only reveal that when a user hit the flow.
*/
export const checkRedisHealth = async function () {
  try {
    const reply = await redis.ping();

    if (reply !== "PONG") throw new Error(`Unexpected PING reply: ${reply}`);

    console.log("✅ Redis health check passed");
    return true;
  } catch (error) {
    console.error("❌ Redis health check FAILED:", error instanceof Error ? error.message : error);
    console.error("   OTP verification, password reset, and rate limiting will not work.");
    return false;
  }
};
