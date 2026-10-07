import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// 5 attempts per minute for auth / join sensitive endpoints
export const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "ratelimit:auth",
    })
  : null;

// 10 attempts per minute for join link attempts
export const joinRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
      prefix: "ratelimit:join",
    })
  : null;

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ success: boolean; reset?: number }> {
  if (!limiter) return { success: true };
  try {
    const res = await limiter.limit(identifier);
    return { success: res.success, reset: res.reset };
  } catch (err) {
    console.error("Rate limiter error, failing open:", err);
    return { success: true };
  }
}
