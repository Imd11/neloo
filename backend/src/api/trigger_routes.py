"""
Scheduled Triggers API Routes
Endpoints for managing scheduled agent executions
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid
import os
from supabase import create_client, Client

from .auth import get_current_user

# Initialize Supabase client
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return create_client(url, key)

trigger_router = APIRouter(prefix="/api/triggers", tags=["triggers"])


# Request/Response Models
class CreateTriggerRequest(BaseModel):
    agent_id: str
    cron_expression: str = Field(..., description="Cron expression for scheduling (e.g., '0 9 * * *' for 9AM daily)")
    timezone: str = Field(default="Asia/Shanghai")
    default_prompt: Optional[str] = Field(default=None, description="Default prompt to send when triggered")
    notification_method: str = Field(default="in_app", pattern="^(email|in_app|none)$")
    enabled: bool = Field(default=True)


class UpdateTriggerRequest(BaseModel):
    cron_expression: Optional[str] = None
    timezone: Optional[str] = None
    default_prompt: Optional[str] = None
    notification_method: Optional[str] = None
    enabled: Optional[bool] = None


class TriggerResponse(BaseModel):
    id: str
    agent_id: str
    user_id: str
    cron_expression: str
    timezone: str
    default_prompt: Optional[str]
    notification_method: str
    enabled: bool
    status: str
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    created_at: datetime
    # Include agent info
    agent_name: Optional[str] = None
    agent_icon: Optional[str] = None


class ExecutionLogResponse(BaseModel):
    id: str
    trigger_id: str
    run_id: str
    thread_id: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    error_message: Optional[str]


# Helper to calculate next run time from cron expression
def calculate_next_run(cron_expression: str, timezone: str) -> datetime:
    """Calculate next execution time from cron expression"""
    from croniter import croniter
    from datetime import datetime
    import pytz
    
    try:
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        cron = croniter(cron_expression, now)
        return cron.get_next(datetime)
    except Exception:
        # If croniter fails, return None (will be handled later)
        return None


@trigger_router.get("", response_model=List[TriggerResponse])
async def list_triggers(user: dict = Depends(get_current_user)):
    """List all scheduled triggers for the current user"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Query triggers with agent info
    result = supabase.table("scheduled_triggers").select(
        "*, agents(name, icon)"
    ).eq("user_id", user_id).order("created_at", desc=True).execute()
    
    triggers = []
    for row in result.data:
        agent_info = row.pop("agents", None) or {}
        triggers.append({
            **row,
            "agent_name": agent_info.get("name"),
            "agent_icon": agent_info.get("icon"),
        })
    
    return triggers


@trigger_router.get("/{trigger_id}", response_model=TriggerResponse)
async def get_trigger(trigger_id: str, user: dict = Depends(get_current_user)):
    """Get a specific trigger by ID"""
    supabase = get_supabase()
    user_id = user["id"]
    
    result = supabase.table("scheduled_triggers").select(
        "*, agents(name, icon)"
    ).eq("id", trigger_id).eq("user_id", user_id).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    agent_info = result.data.pop("agents", None) or {}
    return {
        **result.data,
        "agent_name": agent_info.get("name"),
        "agent_icon": agent_info.get("icon"),
    }


@trigger_router.post("", response_model=TriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(request: CreateTriggerRequest, user: dict = Depends(get_current_user)):
    """Create a new scheduled trigger for an agent"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Verify the user owns the agent
    agent_result = supabase.table("agents").select("id, user_id, name, icon").eq("id", request.agent_id).single().execute()
    
    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent_result.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You don't own this agent")
    
    # Calculate next run time
    next_run = calculate_next_run(request.cron_expression, request.timezone)
    
    # Create trigger
    trigger_data = {
        "id": str(uuid.uuid4()),
        "agent_id": request.agent_id,
        "user_id": user_id,
        "cron_expression": request.cron_expression,
        "timezone": request.timezone,
        "default_prompt": request.default_prompt,
        "notification_method": request.notification_method,
        "enabled": request.enabled,
        "status": "idle",
        "next_run": next_run.isoformat() if next_run else None,
    }
    
    result = supabase.table("scheduled_triggers").insert(trigger_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create trigger")
    
    return {
        **result.data[0],
        "agent_name": agent_result.data["name"],
        "agent_icon": agent_result.data["icon"],
    }


@trigger_router.put("/{trigger_id}", response_model=TriggerResponse)
async def update_trigger(
    trigger_id: str,
    request: UpdateTriggerRequest,
    user: dict = Depends(get_current_user)
):
    """Update a scheduled trigger"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Check ownership
    existing = supabase.table("scheduled_triggers").select("id, user_id, timezone").eq("id", trigger_id).single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    if existing.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build update data
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    
    # Recalculate next_run if cron changed
    if "cron_expression" in update_data:
        tz = update_data.get("timezone", existing.data["timezone"])
        next_run = calculate_next_run(update_data["cron_expression"], tz)
        if next_run:
            update_data["next_run"] = next_run.isoformat()
    
    result = supabase.table("scheduled_triggers").update(update_data).eq("id", trigger_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update trigger")
    
    # Fetch with agent info
    full_result = supabase.table("scheduled_triggers").select(
        "*, agents(name, icon)"
    ).eq("id", trigger_id).single().execute()
    
    agent_info = full_result.data.pop("agents", None) or {}
    return {
        **full_result.data,
        "agent_name": agent_info.get("name"),
        "agent_icon": agent_info.get("icon"),
    }


@trigger_router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(trigger_id: str, user: dict = Depends(get_current_user)):
    """Delete a scheduled trigger"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Check ownership
    existing = supabase.table("scheduled_triggers").select("id, user_id").eq("id", trigger_id).single().execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    if existing.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    supabase.table("scheduled_triggers").delete().eq("id", trigger_id).execute()
    return None


@trigger_router.get("/{trigger_id}/logs", response_model=List[ExecutionLogResponse])
async def get_trigger_logs(
    trigger_id: str,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get execution logs for a trigger"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Verify ownership via trigger
    trigger = supabase.table("scheduled_triggers").select("id, user_id").eq("id", trigger_id).single().execute()
    
    if not trigger.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    if trigger.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = supabase.table("trigger_execution_logs").select("*").eq(
        "trigger_id", trigger_id
    ).order("started_at", desc=True).limit(limit).execute()
    
    return result.data


@trigger_router.post("/{trigger_id}/run")
async def run_trigger_now(trigger_id: str, user: dict = Depends(get_current_user)):
    """Manually trigger an agent execution (for testing)"""
    supabase = get_supabase()
    user_id = user["id"]
    
    # Get trigger with agent info
    trigger = supabase.table("scheduled_triggers").select(
        "*, agents(id, name, system_prompt, tools)"
    ).eq("id", trigger_id).single().execute()
    
    if not trigger.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    
    if trigger.data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create execution log
    run_id = str(uuid.uuid4())[:8]
    log_data = {
        "id": str(uuid.uuid4()),
        "trigger_id": trigger_id,
        "run_id": run_id,
        "status": "pending",
    }
    supabase.table("trigger_execution_logs").insert(log_data).execute()
    
    # Update trigger status
    supabase.table("scheduled_triggers").update({
        "status": "running",
        "last_run": datetime.utcnow().isoformat(),
    }).eq("id", trigger_id).execute()
    
    # TODO: Actually execute the agent via LangGraph
    # For now, just mark as success and return
    agent = trigger.data.get("agents", {})
    
    # Simulate execution completion
    supabase.table("trigger_execution_logs").update({
        "status": "success",
        "completed_at": datetime.utcnow().isoformat(),
    }).eq("run_id", run_id).eq("trigger_id", trigger_id).execute()
    
    supabase.table("scheduled_triggers").update({
        "status": "idle",
    }).eq("id", trigger_id).execute()
    
    return {
        "message": "Trigger executed successfully",
        "run_id": run_id,
        "agent_name": agent.get("name"),
    }
