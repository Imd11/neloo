"""Shared URL-signature logic for file and image downloads.

Signatures embed an expiry (format '{exp}.{hmac16}') so a leaked URL stops
working after the TTL. FILE_SECRET_KEY is read live (lru_cache) so multi-worker
deployments share one key via env, instead of each worker generating its own
random key at import time.
"""

import hashlib
import hmac
import os
import secrets
import time
from functools import lru_cache

DEFAULT_SIG_TTL = 7 * 24 * 3600  # 7 days


@lru_cache(maxsize=1)
def get_file_secret_key() -> str:
    return os.environ.get("FILE_SECRET_KEY") or secrets.token_hex(32)


def generate_url_signature(file_id: str, expires_in: int = DEFAULT_SIG_TTL) -> str:
    """HMAC over '{file_id}:{exp}'; returns '{exp}.{hmac16}'."""
    exp = int(time.time()) + expires_in
    mac = hmac.new(
        get_file_secret_key().encode(),
        f"{file_id}:{exp}".encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{exp}.{mac}"


def verify_url_signature(file_id: str, signature: str) -> bool:
    """Verify HMAC + expiry. Legacy signatures without exp are rejected."""
    try:
        exp_str, mac = signature.split(".", 1)
        exp = int(exp_str)
    except (ValueError, AttributeError):
        return False
    if exp <= time.time():
        return False
    expected = hmac.new(
        get_file_secret_key().encode(),
        f"{file_id}:{exp}".encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return hmac.compare_digest(expected, mac)
