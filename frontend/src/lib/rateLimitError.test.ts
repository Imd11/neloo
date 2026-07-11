import { describe, expect, it } from "vitest";

import { rateLimitRetryAfter } from "./rateLimitError";

describe("rateLimitRetryAfter", () => {
  it("returns Retry-After seconds for 429 responses", () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "17" } });
    expect(rateLimitRetryAfter(response)).toBe(17);
  });

  it("returns null for non-rate-limit responses", () => {
    expect(rateLimitRetryAfter(new Response(null, { status: 500 }))).toBeNull();
  });
});
