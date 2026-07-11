import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "./route";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe("anonymous session issuance", () => {
  it("limits new guest identities by trusted client address", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.GUEST_SESSIONS_PER_DAY = "1";
    delete process.env.RATE_LIMIT_REDIS_URL;
    const ip = `198.51.100.${Math.floor(Math.random() * 100) + 100}`;
    const request = new NextRequest("http://localhost/api/anonymous-session", {
      method: "POST",
      headers: { "x-real-ip": ip },
    });

    expect((await POST(request)).status).toBe(200);
    const denied = await POST(request);
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBeTruthy();
  });
});
