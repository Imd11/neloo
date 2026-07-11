import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

export interface RateLimitStore {
  increment(
    keys: string[],
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision>;
  reserve(
    key: string,
    units: number,
    limit: number,
    ttlSeconds: number
  ): Promise<boolean>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly values = new Map<
    string,
    { value: number; expiresAt: number }
  >();

  async increment(
    keys: string[],
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    const now = Date.now();
    let allowed = true;
    let retryAfter = 1;
    for (const key of keys) {
      const existing = this.values.get(key);
      const entry =
        !existing || existing.expiresAt <= now
          ? { value: 0, expiresAt: now + windowSeconds * 1000 }
          : existing;
      entry.value += 1;
      this.values.set(key, entry);
      allowed = allowed && entry.value <= limit;
      retryAfter = Math.max(
        retryAfter,
        Math.ceil((entry.expiresAt - now) / 1000)
      );
    }
    return { allowed, retryAfter };
  }

  async reserve(
    key: string,
    units: number,
    limit: number,
    ttlSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const existing = this.values.get(key);
    const entry =
      !existing || existing.expiresAt <= now
        ? { value: 0, expiresAt: now + ttlSeconds * 1000 }
        : existing;
    if (entry.value + units > limit) return false;
    entry.value += units;
    this.values.set(key, entry);
    return true;
  }
}

class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisClientType) {}

  async increment(
    keys: string[],
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    const result = (await this.client.eval(
      `local allowed=1 local retry=0
       for _,key in ipairs(KEYS) do
         local count=redis.call('INCR',key)
         if count==1 then redis.call('EXPIRE',key,ARGV[2]) end
         local ttl=redis.call('TTL',key)
         if ttl>retry then retry=ttl end
         if count>tonumber(ARGV[1]) then allowed=0 end
       end
       return {allowed,retry}`,
      { keys, arguments: [String(limit), String(windowSeconds)] }
    )) as [number, number];
    return {
      allowed: Boolean(result[0]),
      retryAfter: Math.max(1, Number(result[1])),
    };
  }

  async reserve(
    key: string,
    units: number,
    limit: number,
    ttlSeconds: number
  ): Promise<boolean> {
    const result = await this.client.eval(
      `local current=tonumber(redis.call('GET',KEYS[1]) or '0')
       local next=current+tonumber(ARGV[1])
       if next>tonumber(ARGV[2]) then return 0 end
       redis.call('SET',KEYS[1],next,'EX',ARGV[3]) return 1`,
      {
        keys: [key],
        arguments: [String(units), String(limit), String(ttlSeconds)],
      }
    );
    return Boolean(result);
  }
}

export class DistributedRateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly namespace = "neloo"
  ) {}

  async consume(
    capability: string,
    guestId: string,
    ipAddress: string | null,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitDecision> {
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const keys = [
      `${this.namespace}:window:${capability}:guest:${guestId}:${window}`,
    ];
    if (ipAddress)
      keys.push(
        `${this.namespace}:window:${capability}:ip:${ipAddress}:${window}`
      );
    return this.store.increment(keys, limit, windowSeconds);
  }

  reserveBudget(
    guestId: string,
    units: number,
    limit: number
  ): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    return this.store.reserve(
      `${this.namespace}:budget:${guestId}:${day}`,
      units,
      limit,
      172800
    );
  }
}

let limiterPromise: Promise<DistributedRateLimiter> | null = null;

export function getDistributedRateLimiter(): Promise<DistributedRateLimiter> {
  if (!limiterPromise) {
    limiterPromise = (async () => {
      const url = process.env.RATE_LIMIT_REDIS_URL?.trim();
      if (!url) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("RATE_LIMIT_REDIS_URL is required in production");
        }
        console.warn(
          "[usage-limits] Using single-process memory storage for local development only"
        );
        return new DistributedRateLimiter(
          new MemoryRateLimitStore(),
          process.env.RATE_LIMIT_NAMESPACE || "neloo"
        );
      }
      const client = createClient({ url });
      await client.connect();
      return new DistributedRateLimiter(
        new RedisRateLimitStore(client as RedisClientType),
        process.env.RATE_LIMIT_NAMESPACE || "neloo"
      );
    })();
  }
  return limiterPromise;
}

export function verifyGuestToken(
  token: string,
  secret: string | undefined,
  production: boolean
): string {
  if (token.startsWith("local-dev:") && !production)
    return token.slice("local-dev:".length);
  const [version, encodedPayload, signature] = token.split(".");
  if (version !== "neloo-anon-v1" || !encodedPayload || !signature || !secret) {
    throw new Error("Invalid guest token");
  }
  const expected = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("hex");
  const suppliedBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    throw new Error("Invalid guest token");
  }
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8")
  ) as {
    sub?: unknown;
    exp?: unknown;
  };
  if (
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp <= Date.now() / 1000
  ) {
    throw new Error("Expired guest token");
  }
  return payload.sub;
}
