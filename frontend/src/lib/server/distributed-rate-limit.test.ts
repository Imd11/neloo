import { describe, expect, it } from "vitest";

import {
  DistributedRateLimiter,
  MemoryRateLimitStore,
  verifyGuestToken,
} from "./distributed-rate-limit";

describe("DistributedRateLimiter", () => {
  it("shares guest and IP windows across limiter instances", async () => {
    const store = new MemoryRateLimitStore();
    const first = new DistributedRateLimiter(store, "test");
    const second = new DistributedRateLimiter(store, "test");

    expect((await first.consume("image", "guest-1", "192.0.2.1", 1, 600)).allowed).toBe(true);
    expect((await second.consume("image", "guest-2", "192.0.2.1", 1, 600)).allowed).toBe(false);
  });

  it("reserves daily budget atomically", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = new DistributedRateLimiter(store, "test");

    expect(await limiter.reserveBudget("guest-1", 3, 5)).toBe(true);
    expect(await limiter.reserveBudget("guest-1", 3, 5)).toBe(false);
  });
});

describe("verifyGuestToken", () => {
  it("rejects unsigned tokens in production", () => {
    expect(() => verifyGuestToken("local-dev:guest", "secret", true)).toThrow();
  });
});
