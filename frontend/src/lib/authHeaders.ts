export function buildBearerHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}
