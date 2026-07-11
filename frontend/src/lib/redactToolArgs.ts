const SENSITIVE_KEY =
  /(token|secret|password|authorization|cookie|credential|api[_-]?key)/i;
const REDACTED = "••••••";

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redact(child),
      ])
    );
  }
  return value;
}

export function redactToolArgs(
  args: Record<string, unknown>
): Record<string, unknown> {
  return redact(args) as Record<string, unknown>;
}
