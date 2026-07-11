export function rateLimitRetryAfter(response: Response): number | null {
  if (response.status !== 429) return null;
  const value = Number.parseInt(response.headers.get("Retry-After") || "", 10);
  return Number.isFinite(value) && value > 0 ? value : 60;
}
