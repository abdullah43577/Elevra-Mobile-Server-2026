import IORedis from "ioredis";
import { getEnv } from "./get-env";
const { REDIS_HOST, REDIS_PASS, REDIS_USERNAME, REDIS_PORT, NODE_ENV } = getEnv(["REDIS_HOST", "REDIS_PASS", "REDIS_USERNAME", "REDIS_PORT", "NODE_ENV"]);

const config =
  NODE_ENV === "development"
    ? {
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null,
        connectTimeout: 10000, // 10 seconds timeout
        lazyConnect: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      }
    : {
        host: REDIS_HOST,
        username: REDIS_USERNAME,
        password: REDIS_PASS,
        port: REDIS_PORT as unknown as number,
        maxRetriesPerRequest: null,
        connectTimeout: 10000, // 10 seconds timeout
        lazyConnect: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };

export const redis = new IORedis(config);

// Add error handlers with rate limiting to reduce log spam
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 300000000000000; // Only log errors every 30 seconds

redis.on("error", err => {
  const now = Date.now();
  if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
    console.error("❌ Redis connection error:", err.message);
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
