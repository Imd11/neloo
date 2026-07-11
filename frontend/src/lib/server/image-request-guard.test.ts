import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { DistributedLimitError } from "./distributed-rate-limit";
import * as guard from "./image-request-guard";
import { POST as editImage } from "../../app/api/edit/route";
import { POST as generateImage } from "../../app/api/generate-image/route";
import { POST as resizeImage } from "../../app/api/resize-download/route";

const { clientKey, distributedLimitResponse } = guard;

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("trusted client address", () => {
  it("uses Vercel's overwritten forwarding header on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("https://neloo.test/api/generate-image", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.20, 203.0.113.5",
        "x-real-ip": "192.0.2.99",
      },
    });

    expect(clientKey(request)).toBe("198.51.100.20");
  });

  it("fails closed in self-hosted production without trusted proxy hops", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    const request = new NextRequest("https://neloo.test/api/generate-image", {
      headers: { "x-real-ip": "198.51.100.21" },
    });

    expect(clientKey(request)).toBeNull();
  });
});

describe("distributed concurrency response", () => {
  it("preserves 429 and Retry-After for image routes", async () => {
    const response = distributedLimitResponse(
      new DistributedLimitError("Busy", 5)
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("5");
    await expect(response?.json()).resolves.toEqual({ error: "Busy" });
  });

  it.each([
    [
      "generate",
      generateImage,
      () =>
        new NextRequest("http://localhost/api/generate-image", {
          method: "POST",
          body: JSON.stringify({ prompt: "A lighthouse" }),
        }),
    ],
    [
      "edit",
      editImage,
      () => {
        const body = new URLSearchParams();
        body.set("originalImageUrl", "https://example.com/image.png");
        body.set("markedImageDataUrl", "data:image/png;base64,AA==");
        body.set("prompt", "Remove the sign");
        return new NextRequest("http://localhost/api/edit", {
          method: "POST",
          body: body.toString(),
          headers: { "content-type": "application/x-www-form-urlencoded" },
        });
      },
    ],
    [
      "resize",
      resizeImage,
      () =>
        new NextRequest("http://localhost/api/resize-download", {
          method: "POST",
          body: JSON.stringify({
            imageUrl: "https://example.com/image.png",
            width: 100,
            height: 100,
          }),
        }),
    ],
  ])("returns 429 from the %s route", async (_name, route, requestFactory) => {
    vi.spyOn(guard, "rejectUnsafeImageRequest").mockResolvedValue(null);
    vi.spyOn(guard, "runWithImageConcurrency").mockRejectedValue(
      new DistributedLimitError("Busy", 5)
    );

    const response = await route(requestFactory());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });
});
