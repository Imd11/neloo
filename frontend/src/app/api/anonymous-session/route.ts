import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 180;

function encodePayload(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export async function POST() {
  const userId = randomUUID();
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  const secret = process.env.ANONYMOUS_SESSION_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "ANONYMOUS_SESSION_SECRET must be configured for production guest mode." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      token: `local-dev:${userId}`,
      userId,
      expiresAt,
    });
  }

  const encodedPayload = encodePayload({ sub: userId, exp: Math.floor(expiresAt / 1000) });
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex");

  return NextResponse.json({
    token: `neloo-anon-v1.${encodedPayload}.${signature}`,
    userId,
    expiresAt,
  });
}
