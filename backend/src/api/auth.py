"""
Supabase JWT Authentication Module

This module provides JWT token verification for API endpoints.
It validates tokens issued by Supabase Auth.

Environment Variables:
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_JWT_SECRET: JWT secret from Supabase (Settings > API > JWT Secret)
"""

import base64
import hashlib
import hmac
import json
import os
import time
import jwt
from typing import Optional
from uuid import UUID
from fastapi import HTTPException, Header, Depends
from functools import lru_cache


# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")

# JWT algorithm used by Supabase
JWT_ALGORITHM = "HS256"


# =============================================================================
# JWT Verification
# =============================================================================

@lru_cache(maxsize=1)
def get_jwt_secret() -> Optional[str]:
    """Supabase JWT secret (read live from env, cached). Clear cache to refresh."""
    return os.environ.get("SUPABASE_JWT_SECRET")


@lru_cache(maxsize=1)
def allow_anonymous() -> bool:
    """True only when the operator explicitly opts into unauthenticated local mode.

    When False (default), authenticated routes require a valid Supabase JWT.
    When True, requests without a token are accepted as a local user — intended
    ONLY for single-user local development, never for public deployments.
    """
    return os.environ.get("ALLOW_ANONYMOUS", "false").lower() == "true"


def allow_insecure_local_tokens() -> bool:
    """Allow raw local user IDs only for an explicitly local development setup."""
    return os.environ.get("ALLOW_INSECURE_LOCAL_TOKENS", "false").lower() == "true"


def _decode_anonymous_session(token: str) -> Optional[dict]:
    """Verify a short-lived, server-signed guest session token."""
    prefix = "neloo-anon-v1."
    if not token.startswith(prefix):
        return None

    secret = os.environ.get("ANONYMOUS_SESSION_SECRET", "")
    if not secret:
        raise HTTPException(status_code=401, detail="Anonymous sessions are not configured")

    try:
        encoded_payload, signature = token[len(prefix):].split(".", 1)
        expected = hmac.new(
            secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("signature mismatch")

        padding = "=" * (-len(encoded_payload) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded_payload + padding))
        user_id = str(UUID(str(payload["sub"])))
        if int(payload["exp"]) <= int(time.time()):
            raise ValueError("token expired")
        return {
            "sub": user_id,
            "email": f"guest-{user_id}@local",
            "identity_type": "guest",
        }
    except (KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid anonymous session") from exc


def verify_jwt_token(token: str) -> dict:
    """
    Verify a Supabase JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload containing user info

    Raises:
        HTTPException: If token is invalid or expired
    """
    if allow_anonymous():
        anonymous_session = _decode_anonymous_session(token)
        if anonymous_session:
            return anonymous_session

        if token.startswith("local-dev:"):
            if not allow_insecure_local_tokens():
                raise HTTPException(status_code=401, detail="Local development token is disabled")
            try:
                user_id = str(UUID(token.removeprefix("local-dev:")))
            except ValueError as exc:
                raise HTTPException(status_code=401, detail="Invalid local development token") from exc
            return {
                "sub": user_id,
                "email": f"guest-{user_id}@local",
                "identity_type": "guest",
            }

    secret = get_jwt_secret()

    if not secret:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: configure SUPABASE_JWT_SECRET, "
            "or set ALLOW_ANONYMOUS=true for local development only.",
        )

    try:
        # Decode and verify the JWT
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            audience="authenticated",  # Supabase uses this audience for authenticated users
        )
        return {**payload, "identity_type": "supabase"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}",
        )


def extract_token_from_header(authorization: Optional[str]) -> Optional[str]:
    """
    Extract JWT token from Authorization header.

    Args:
        authorization: Authorization header value (e.g., "Bearer <token>")

    Returns:
        Token string or None
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]

    return None


# =============================================================================
# FastAPI Dependencies
# =============================================================================

def authenticate_authorization_header(authorization: Optional[str]) -> dict:
    """Authenticate a Bearer header without FastAPI dependency injection."""
    token = extract_token_from_header(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    return verify_jwt_token(token)

async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
) -> dict:
    """
    FastAPI dependency to get the current authenticated user.

    This dependency can be used in route handlers to require authentication:

    ```python
    @app.get("/protected")
    async def protected_route(user: dict = Depends(get_current_user)):
        return {"user_id": user["sub"]}
    ```

    Authentication methods (in order of priority):
    1. Bearer token in Authorization header (production)
    2. x-user-id header (anonymous local-dev mode only, via ALLOW_ANONYMOUS=true)
    3. Rejected with 401 otherwise

    Returns:
        User info dict with at least "sub" (user ID) field

    Raises:
        HTTPException: 401 if authentication fails
    """
    # Try to extract token from Authorization header
    if authorization:
        return authenticate_authorization_header(authorization)

    # Raw headers are allowed only for explicitly local development.
    if allow_anonymous() and allow_insecure_local_tokens():
        return {
            "sub": x_user_id or "default",
            "email": f"{x_user_id or 'default'}@local",
            "identity_type": "guest",
        }

    raise HTTPException(
        status_code=401,
        detail="Authentication required",
    )


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
) -> Optional[dict]:
    """
    FastAPI dependency to get the current user (optional).

    Unlike get_current_user, this doesn't raise an error if no auth is provided.
    Useful for routes that work with or without authentication.

    Returns:
        User info dict or None
    """
    token = extract_token_from_header(authorization)

    if token:
        try:
            return verify_jwt_token(token)
        except HTTPException:
            return None

    if x_user_id and allow_anonymous() and allow_insecure_local_tokens():
        return {
            "sub": x_user_id,
            "email": f"{x_user_id}@local",
            "identity_type": "guest",
        }

    return None


def get_user_id(user: dict) -> str:
    """
    Extract user ID from user info dict.

    Args:
        user: User info from get_current_user

    Returns:
        User ID string (Supabase user UUID)
    """
    user_id = user.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Authenticated identity is missing")
    return user_id
