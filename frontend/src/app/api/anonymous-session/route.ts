import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getDistributedRateLimiter } from "@/lib/server/distributed-rate-limit";
import { clientKey } from "@/lib/server/image-request-guard";

export const dynamic = "force-dynamic";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 180;

function encodePayload(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export async function POST(request: NextRequest) {
  const ipAddress = clientKey(request);
  if (!ipAddress && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Trusted client address is unavailable" },
      { status: 503 }
    );
  }

  try {
    const limiter = await getDistributedRateLimiter();
    const limit = Math.max(
      1,
      Number.parseInt(process.env.GUEST_SESSIONS_PER_DAY || "2", 10)
    );
    const decision = await limiter.consume(
      "session",
      ipAddress || "local-development",
      ipAddress,
      limit,
      86_400
    );
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "Too many guest sessions have been created from this address",
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfter) },
        }
      );
    }
  } catch {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Shared usage limits are unavailable" },
        { status: 503 }
      );
    }
  }

  const userId = randomUUID();
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  const secret = process.env.ANONYMOUS_SESSION_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "ANONYMOUS_SESSION_SECRET must be configured for production guest mode.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      token: `local-dev:${userId}`,
      userId,
      expiresAt,
    });
  }

  const encodedPayload = encodePayload({
    sub: userId,
    exp: Math.floor(expiresAt / 1000),
  });
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("hex");

  return NextResponse.json({
    token: `neloo-anon-v1.${encodedPayload}.${signature}`,
    userId,
    expiresAt,
  });
}
