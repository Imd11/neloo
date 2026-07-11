import { NextRequest, NextResponse } from "next/server";

import {
  getDistributedRateLimiter,
  verifyGuestToken,
} from "./distributed-rate-limit";

export function clientKey(request: NextRequest): string | null {
  const forwarded =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) || [];
  const hops = Math.max(
    0,
    Number.parseInt(process.env.TRUSTED_PROXY_HOPS || "0", 10)
  );
  const peer = request.headers.get("x-real-ip");
  if (!peer) return null;
  const chain = [...forwarded, peer];
  return chain.length > hops ? chain[chain.length - 1 - hops] : null;
}

function authenticatedGuestId(request: NextRequest): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new Error("Authentication required");
  return verifyGuestToken(
    authorization.slice("Bearer ".length),
    process.env.ANONYMOUS_SESSION_SECRET?.trim(),
    process.env.NODE_ENV === "production"
  );
}

export async function runWithImageConcurrency<T>(
  request: NextRequest,
  operation: () => Promise<T>
): Promise<T> {
  const limiter = await getDistributedRateLimiter();
  return limiter.withConcurrency(
    "image",
    authenticatedGuestId(request),
    operation
  );
}

export async function rejectUnsafeImageRequest(
  request: NextRequest,
  maxRequests: number
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Cross-origin image requests are not allowed" },
      { status: 403 }
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  let guestId: string;
  try {
    guestId = verifyGuestToken(
      authorization.slice("Bearer ".length),
      process.env.ANONYMOUS_SESSION_SECRET?.trim(),
      process.env.NODE_ENV === "production"
    );
  } catch {
    return NextResponse.json({ error: "Invalid guest token" }, { status: 401 });
  }

  let limiter;
  try {
    limiter = await getDistributedRateLimiter();
  } catch {
    return NextResponse.json(
      { error: "Shared usage limits are unavailable" },
      { status: 503 }
    );
  }
  const ipAddress = clientKey(request);
  if (!ipAddress && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Trusted client address is unavailable" },
      { status: 503 }
    );
  }
  const decision = await limiter.consume(
    "image",
    guestId,
    ipAddress,
    maxRequests,
    600
  );
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Too many image requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfter) } }
    );
  }
  const budget = await limiter.reserveBudget(
    guestId,
    1,
    Number.parseInt(process.env.DAILY_BUDGET_UNITS || "200", 10)
  );
  if (!budget) {
    return NextResponse.json(
      { error: "Daily usage budget exceeded" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
  return null;
}

export function assertSafeRemoteImageUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const blocked =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1";

  if (url.protocol !== "https:" || blocked) {
    throw new Error("Only public HTTPS image URLs are supported");
  }

  return url;
}
