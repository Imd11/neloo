import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestWindows = new Map<string, number[]>();

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function rejectUnsafeImageRequest(
  request: NextRequest,
  maxRequests: number
): NextResponse | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin image requests are not allowed" }, { status: 403 });
  }

  const now = Date.now();
  const key = clientKey(request);
  const recent = (requestWindows.get(key) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= maxRequests) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000);
    return NextResponse.json(
      { error: "Too many image requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  recent.push(now);
  requestWindows.set(key, recent);
  return null;
}

export function assertSafeRemoteImageUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const blocked = hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname === "::1";

  if (url.protocol !== "https:" || blocked) {
    throw new Error("Only public HTTPS image URLs are supported");
  }

  return url;
}
