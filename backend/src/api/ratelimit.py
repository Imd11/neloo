"""Shared rate limiter for LLM-proxy and Chromium routes.

Key is the client IP. Behind Railway/Cloudflare/Vercel you MUST configure the
proxy to populate request.client.host from X-Forwarded-For, otherwise every
request keys on the proxy's IP and the limit is effectively global.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address


def _key_fn(request) -> str:
    # slowapi calls this with the Request; fall back to IP only.
    return get_remote_address(request)


limiter = Limiter(key_func=_key_fn, headers_enabled=True)
