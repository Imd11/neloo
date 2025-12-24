"""
Supabase JWT Authentication Module

This module provides JWT token verification for API endpoints.
It validates tokens issued by Supabase Auth.

Environment Variables:
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_JWT_SECRET: JWT secret from Supabase (Settings > API > JWT Secret)
"""

import os
import jwt
from typing import Optional
from fastapi import HTTPException, Header, Depends
from functools import lru_cache


# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

# JWT algorithm used by Supabase
JWT_ALGORITHM = "HS256"


# =============================================================================
# JWT Verification
# =============================================================================

@lru_cache(maxsize=1)
def get_jwt_secret() -> Optional[str]:
    """Get JWT secret (cached)."""
    return SUPABASE_JWT_SECRET


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
    secret = get_jwt_secret()

    if not secret:
        # If no JWT secret is configured, skip verification (development mode)
        # This allows the API to work without authentication in local dev
        return {"sub": "anonymous", "email": "anonymous@local"}

    try:
        # Decode and verify the JWT
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            audience="authenticated",  # Supabase uses this audience for authenticated users
        )
        return payload
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
    2. x-user-id header (development fallback)
    3. Anonymous user (if no JWT secret configured)

    Returns:
        User info dict with at least "sub" (user ID) field

    Raises:
        HTTPException: 401 if authentication fails
    """
    # Try to extract token from Authorization header
    token = extract_token_from_header(authorization)

    if token:
        # Verify the JWT token
        return verify_jwt_token(token)

    # Fallback: Check if JWT secret is configured
    if not get_jwt_secret():
        # Development mode: use x-user-id header or default
        return {
            "sub": x_user_id or "default",
            "email": f"{x_user_id or 'default'}@local",
        }

    # JWT secret is configured but no token provided
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

    if x_user_id:
        return {"sub": x_user_id, "email": f"{x_user_id}@local"}

    return None


def get_user_id(user: dict) -> str:
    """
    Extract user ID from user info dict.

    Args:
        user: User info from get_current_user

    Returns:
        User ID string (Supabase user UUID)
    """
    return user.get("sub", "default")
