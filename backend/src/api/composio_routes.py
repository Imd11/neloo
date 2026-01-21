"""
Composio Integration API Routes

Provides endpoints for connecting/disconnecting third-party apps via Composio.
Uses Composio Python SDK for OAuth flow management.
"""

import os
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .auth import get_current_user
from ..storage.supabase_db import get_supabase_client

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# =============================================================================
# Configuration
# =============================================================================

COMPOSIO_API_KEY = os.getenv("COMPOSIO_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Auth Config ID whitelist (app_name -> auth_config_id)
# Add more as you create them in Composio Dashboard
APP_AUTH_CONFIGS = {
    "twitter": "ac_Kw-txF63L-Wl",
    # Add more apps here:
    # "github": "ac_xxx",
    # "gmail": "ac_yyy",
}

# Composio client singleton
_composio_client = None


def get_composio_client():
    """Get or create Composio client."""
    global _composio_client
    if _composio_client is None:
        if not COMPOSIO_API_KEY:
            raise HTTPException(503, "Composio integration not configured")
        
        # Set API key in environment for SDK
        os.environ["COMPOSIO_API_KEY"] = COMPOSIO_API_KEY
        
        from composio import Composio
        _composio_client = Composio()
    
    return _composio_client


# =============================================================================
# Request/Response Models
# =============================================================================

class ConnectRequest(BaseModel):
    app_name: str


class DisconnectRequest(BaseModel):
    app_name: str


class ConnectionInfo(BaseModel):
    app_name: str
    status: str
    composio_connection_id: Optional[str] = None
    connected_at: Optional[str] = None


class ConnectionsResponse(BaseModel):
    connections: list[ConnectionInfo]


class ConnectResponse(BaseModel):
    redirect_url: str
    connection_id: str


class StatusResponse(BaseModel):
    status: str
    connected: bool = False


class DisconnectResponse(BaseModel):
    status: str
    app: str


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/connections", response_model=ConnectionsResponse)
async def get_connections(user: dict = Depends(get_current_user)):
    """
    Get user's connected apps.
    Returns all connections with status pending or connected.
    """
    user_id = user["sub"]
    
    supabase = await get_supabase_client()
    if not supabase:
        return {"connections": []}
    
    result = await supabase.table("user_integrations")\
        .select("app_name, status, composio_connection_id, connected_at")\
        .eq("user_id", user_id)\
        .in_("status", ["pending", "connected"])\
        .execute()
    
    connections = [
        ConnectionInfo(
            app_name=row["app_name"],
            status=row["status"],
            composio_connection_id=row.get("composio_connection_id"),
            connected_at=row.get("connected_at")
        )
        for row in (result.data or [])
    ]
    
    return {"connections": connections}


@router.post("/connect", response_model=ConnectResponse)
async def connect_app(
    request: ConnectRequest,
    user: dict = Depends(get_current_user)
):
    """
    Initiate OAuth connection for an app.
    Returns redirect URL for user to complete OAuth flow.
    
    Security: Generates a cryptographic state token for CSRF protection
    and user binding. The state is validated in the callback endpoint.
    """
    user_id = user["sub"]
    app_name = request.app_name.lower()
    
    # Validate app is in whitelist
    auth_config_id = APP_AUTH_CONFIGS.get(app_name)
    if not auth_config_id:
        raise HTTPException(400, f"Unsupported app: {app_name}")
    
    # Generate cryptographic state for CSRF protection and user binding
    oauth_state = secrets.token_urlsafe(32)
    
    # Get Composio client
    composio = get_composio_client()
    
    # Build callback URL pointing to our backend (not frontend)
    # This ensures we can verify the connection before updating DB
    callback_url = f"{API_BASE_URL}/api/integrations/callback?state={oauth_state}"
    
    # Initiate connection with Composio
    try:
        connection_request = composio.connected_accounts.initiate(
            user_id=user_id,
            auth_config_id=auth_config_id,
            callback_url=callback_url
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to initiate connection: {str(e)}")
    
    # Save to database with pending status
    # Clear old connection_id and set new oauth_state for validation
    supabase = await get_supabase_client()
    if supabase:
        await supabase.table("user_integrations").upsert({
            "user_id": user_id,
            "app_name": app_name,
            "composio_connection_id": None,  # Clear old, will be set in callback
            "oauth_state": oauth_state,      # For callback validation
            "status": "pending",
            "connected_at": None,            # Clear old
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="user_id,app_name").execute()
    
    return {
        "redirect_url": connection_request.redirect_url,
        "connection_id": connection_request.id
    }


@router.get("/callback")
async def oauth_callback(
    connectedAccountId: str,
    state: str,
):
    """
    OAuth callback endpoint - called by Composio after user authorizes.
    
    Security:
    1. Validates state token (CSRF protection + user binding)
    2. Verifies Composio connection is ACTIVE
    3. Updates DB with connected status
    4. Redirects to frontend
    
    This is a public endpoint (no auth required) because the user
    is redirected here from Composio's OAuth flow.
    """
    # 1. Validate state and find pending record
    supabase = await get_supabase_client()
    if not supabase:
        return RedirectResponse(
            f"{FRONTEND_URL}/?openSettings=1&tab=apps&error=db_error",
            status_code=302
        )
    
    # Find the pending record by state (unique match)
    result = await supabase.table("user_integrations")\
        .select("user_id, app_name")\
        .eq("oauth_state", state)\
        .eq("status", "pending")\
        .execute()
    
    if not result.data or len(result.data) == 0:
        print(f"[OAuth Callback] Invalid or expired state: {state[:16]}...")
        return RedirectResponse(
            f"{FRONTEND_URL}/?openSettings=1&tab=apps&error=invalid_state",
            status_code=302
        )
    
    record = result.data[0]
    user_id = record["user_id"]
    app_name = record["app_name"]  # Use DB value, not query param
    
    # 2. Verify Composio connection is ACTIVE
    try:
        composio = get_composio_client()
        connection = composio.connected_accounts.get(connectedAccountId)
        composio_status = connection.status.upper() if connection.status else "PENDING"
        
        if composio_status != "ACTIVE":
            print(f"[OAuth Callback] Connection not active: {composio_status}")
            return RedirectResponse(
                f"{FRONTEND_URL}/?openSettings=1&tab=apps&app={app_name}&error=not_active",
                status_code=302
            )
        
        # Optional: Double-check the connection belongs to this user
        # (if Composio exposes user_id/entity_id in the payload)
        composio_user_id = getattr(connection, 'user_id', None) or getattr(connection, 'entity_id', None)
        if composio_user_id and str(composio_user_id) != str(user_id):
            print(f"[OAuth Callback] User mismatch: {composio_user_id} != {user_id}")
            return RedirectResponse(
                f"{FRONTEND_URL}/?openSettings=1&tab=apps&error=user_mismatch",
                status_code=302
            )
            
    except Exception as e:
        print(f"[OAuth Callback] Failed to verify Composio connection: {e}")
        return RedirectResponse(
            f"{FRONTEND_URL}/?openSettings=1&tab=apps&app={app_name}&error=verification_failed",
            status_code=302
        )
    
    # 3. Update DB: connected status, clear oauth_state
    try:
        await supabase.table("user_integrations")\
            .update({
                "status": "connected",
                "composio_connection_id": connectedAccountId,
                "oauth_state": None,  # Clear used state
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })\
            .eq("user_id", user_id)\
            .eq("app_name", app_name)\
            .execute()
        
        print(f"[OAuth Callback] Successfully connected {app_name} for user {user_id[:8]}...")
        
    except Exception as e:
        print(f"[OAuth Callback] Failed to update DB: {e}")
        return RedirectResponse(
            f"{FRONTEND_URL}/?openSettings=1&tab=apps&app={app_name}&error=db_update_failed",
            status_code=302
        )
    
    # 4. Redirect to frontend (existing route: /)
    return RedirectResponse(
        f"{FRONTEND_URL}/?openSettings=1&tab=apps&app={app_name}&status=success",
        status_code=302
    )

@router.get("/status/{app_name}", response_model=StatusResponse)
async def check_status(
    app_name: str,
    user: dict = Depends(get_current_user)
):
    """
    Check connection status for an app.
    Used by frontend to poll after OAuth redirect.
    """
    user_id = user["sub"]
    app_name = app_name.lower()
    
    # Get local record
    supabase = await get_supabase_client()
    if not supabase:
        return {"status": "not_found", "connected": False}
    
    result = await supabase.table("user_integrations")\
        .select("composio_connection_id, status")\
        .eq("user_id", user_id)\
        .eq("app_name", app_name)\
        .execute()
    
    if not result.data or len(result.data) == 0:
        return {"status": "not_found", "connected": False}
    
    record = result.data[0]
    
    # If already connected, return immediately
    if record["status"] == "connected":
        return {"status": "connected", "connected": True}
    
    # If pending, check Composio for updates
    connection_id = record.get("composio_connection_id")
    if not connection_id:
        return {"status": record["status"], "connected": False}
    
    try:
        composio = get_composio_client()
        connection = composio.connected_accounts.get(connection_id)
        composio_status = connection.status.upper() if connection.status else "PENDING"
        
        if composio_status == "ACTIVE":
            # Update database
            await supabase.table("user_integrations")\
                .update({
                    "status": "connected",
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })\
                .eq("user_id", user_id)\
                .eq("app_name", app_name)\
                .execute()
            
            return {"status": "connected", "connected": True}
        
        elif composio_status in ("FAILED", "EXPIRED"):
            await supabase.table("user_integrations")\
                .update({
                    "status": composio_status.lower(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })\
                .eq("user_id", user_id)\
                .eq("app_name", app_name)\
                .execute()
            
            return {"status": composio_status.lower(), "connected": False}
        
    except Exception as e:
        print(f"[Composio] Error checking status: {e}")
    
    return {"status": "pending", "connected": False}


@router.post("/disconnect", response_model=DisconnectResponse)
async def disconnect_app(
    request: DisconnectRequest,
    user: dict = Depends(get_current_user)
):
    """
    Disconnect an app.
    Deletes the connection from Composio and updates local database.
    """
    user_id = user["sub"]
    app_name = request.app_name.lower()
    
    # Get local record
    supabase = await get_supabase_client()
    if not supabase:
        raise HTTPException(500, "Database not configured")
    
    result = await supabase.table("user_integrations")\
        .select("composio_connection_id, status")\
        .eq("user_id", user_id)\
        .eq("app_name", app_name)\
        .execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(404, "Connection not found")
    
    record = result.data[0]
    
    # Verify it's connected
    if record["status"] != "connected":
        raise HTTPException(400, f"App is not connected (status: {record['status']})")
    
    connection_id = record.get("composio_connection_id")
    
    # Delete from Composio
    if connection_id:
        try:
            composio = get_composio_client()
            composio.connected_accounts.delete(connection_id)
        except Exception as e:
            # Log but continue - we still update local state
            print(f"[Composio] Error deleting connection: {e}")
    
    # Update local database
    await supabase.table("user_integrations")\
        .update({
            "status": "disconnected",
            "updated_at": datetime.now(timezone.utc).isoformat()
        })\
        .eq("user_id", user_id)\
        .eq("app_name", app_name)\
        .execute()
    
    return {"status": "disconnected", "app": app_name}


@router.get("/available-apps")
async def get_available_apps():
    """
    Get list of available apps that can be connected.
    Returns app names from the whitelist.
    """
    return {
        "apps": list(APP_AUTH_CONFIGS.keys())
    }
