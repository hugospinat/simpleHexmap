type RateLimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export class MemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitState>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = this.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.prune(now);
      this.entries.set(key, { count: 1, resetAt: now + windowMs });
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        retryAfterMs: 0,
      };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(current.resetAt - now, 0),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(limit - current.count, 0),
      retryAfterMs: 0,
    };
  }

  consumeMany(keys: string[], limit: number, windowMs: number): RateLimitResult {
    const now = this.now();
    this.prune(now);

    const uniqueKeys = Array.from(new Set(keys));
    let remaining = Number.POSITIVE_INFINITY;
    let retryAfterMs = 0;

    for (const key of uniqueKeys) {
      const current = this.entries.get(key);

      if (current && current.count >= limit) {
        retryAfterMs = Math.max(retryAfterMs, Math.max(current.resetAt - now, 0));
      }
    }

    if (retryAfterMs > 0) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      };
    }

    for (const key of uniqueKeys) {
      const current = this.entries.get(key);

      if (!current) {
        this.entries.set(key, {
          count: 1,
          resetAt: now + windowMs,
        });
        remaining = Math.min(remaining, Math.max(limit - 1, 0));
        continue;
      }

      current.count += 1;
      remaining = Math.min(remaining, Math.max(limit - current.count, 0));
    }

    return {
      allowed: true,
      remaining: Number.isFinite(remaining) ? remaining : Math.max(limit, 0),
      retryAfterMs: 0,
    };
  }

  private prune(now: number): void {
    for (const [key, value] of this.entries) {
      if (value.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
