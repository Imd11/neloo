"""Application identity persistence for guest and Supabase users."""

from datetime import datetime, timezone
import os

from fastapi import Depends, HTTPException

from .api.auth import get_current_user
from .storage.supabase_db import get_supabase_client


def database_is_configured() -> bool:
    """Return whether the backend has the credentials needed for persistence."""
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"))


async def ensure_app_identity(user_id: str, identity_type: str) -> None:
    """Upsert an application owner before accessing user-owned persistence."""
    if not database_is_configured():
        return
    if identity_type not in {"guest", "supabase"}:
        raise HTTPException(status_code=401, detail="Invalid application identity type")

    try:
        client = await get_supabase_client()
        if client is None:
            raise RuntimeError("Supabase client is unavailable")
        await (
            client.table("app_identities")
            .upsert(
                {
                    "id": user_id,
                    "identity_type": identity_type,
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="id",
            )
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Identity persistence is temporarily unavailable",
        ) from exc


async def get_persistent_user(user: dict = Depends(get_current_user)) -> dict:
    """Authenticate and ensure the owner exists before user-data operations."""
    user_id = user.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Authenticated identity is missing")
    await ensure_app_identity(user_id, user.get("identity_type", "supabase"))
    return user
