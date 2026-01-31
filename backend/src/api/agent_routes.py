"""
Agent Management API Routes

This module provides CRUD endpoints for custom agents.
"""

import os
from typing import Optional, List
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from supabase import create_client, Client

from .auth import get_current_user, get_user_id

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Create router
router = APIRouter(prefix="/api/agents", tags=["agents"])


# =============================================================================
# Supabase Client
# =============================================================================

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """Get Supabase client instance."""
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise HTTPException(
                status_code=500,
                detail="Supabase not configured"
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


# =============================================================================
# Request/Response Models
# =============================================================================

class AgentCreate(BaseModel):
    """Request model for creating an agent."""
    name: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(default="🤖", max_length=10)
    description: str = Field(..., min_length=1, max_length=1000)
    system_prompt: str = Field(..., min_length=1)
    tools: List[str] = Field(default=["search_web"])
    is_public: bool = Field(default=False)


class AgentUpdate(BaseModel):
    """Request model for updating an agent."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    system_prompt: Optional[str] = Field(None, min_length=1)
    tools: Optional[List[str]] = None
    is_public: Optional[bool] = None


class AgentResponse(BaseModel):
    """Response model for agent data."""
    id: str
    user_id: str
    name: str
    icon: str
    description: str
    system_prompt: str
    tools: List[str]
    is_public: bool
    usage_count: int
    created_at: str
    updated_at: str


class AgentListResponse(BaseModel):
    """Response model for agent list."""
    agents: List[AgentResponse]
    total: int


class GeneratePromptRequest(BaseModel):
    """Request model for generating system prompt."""
    name: str
    description: str
    tools: List[str] = []


class GeneratePromptResponse(BaseModel):
    """Response model for generated prompt."""
    system_prompt: str


# =============================================================================
# Helper Functions
# =============================================================================

def row_to_agent(row: dict) -> AgentResponse:
    """Convert database row to AgentResponse."""
    return AgentResponse(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        name=row["name"],
        icon=row["icon"],
        description=row["description"],
        system_prompt=row["system_prompt"],
        tools=row.get("tools", []),
        is_public=row.get("is_public", False),
        usage_count=row.get("usage_count", 0),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("", response_model=AgentListResponse)
async def list_my_agents(
    user: dict = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AgentListResponse:
    """
    List agents created by the current user.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Get agents with pagination
    result = (
        supabase.table("agents")
        .select("*", count="exact")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    
    agents = [row_to_agent(row) for row in result.data]
    total = result.count or len(agents)
    
    return AgentListResponse(agents=agents, total=total)


@router.get("/store", response_model=AgentListResponse)
async def list_store_agents(
    search: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query(default="popular", regex="^(popular|newest)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AgentListResponse:
    """
    List public agents in the store.
    """
    supabase = get_supabase()
    
    # Build query
    query = supabase.table("agents").select("*", count="exact").eq("is_public", True)
    
    # Apply search filter if provided
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")
    
    # Apply sorting
    if sort_by == "popular":
        query = query.order("usage_count", desc=True)
    else:  # newest
        query = query.order("created_at", desc=True)
    
    # Apply pagination
    result = query.range(offset, offset + limit - 1).execute()
    
    agents = [row_to_agent(row) for row in result.data]
    total = result.count or len(agents)
    
    return AgentListResponse(agents=agents, total=total)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
) -> AgentResponse:
    """
    Get a specific agent by ID.
    User can access their own agents or public agents.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    result = supabase.table("agents").select("*").eq("id", agent_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = result.data[0]
    
    # Check access: must be owner or agent must be public
    if agent["user_id"] != user_id and not agent.get("is_public", False):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return row_to_agent(agent)


@router.post("", response_model=AgentResponse)
async def create_agent(
    data: AgentCreate,
    user: dict = Depends(get_current_user),
) -> AgentResponse:
    """
    Create a new agent.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Insert agent
    result = (
        supabase.table("agents")
        .insert({
            "user_id": user_id,
            "name": data.name,
            "icon": data.icon,
            "description": data.description,
            "system_prompt": data.system_prompt,
            "tools": data.tools,
            "is_public": data.is_public,
        })
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create agent")
    
    return row_to_agent(result.data[0])


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    user: dict = Depends(get_current_user),
) -> AgentResponse:
    """
    Update an existing agent.
    Only the owner can update an agent.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Check ownership
    existing = supabase.table("agents").select("user_id").eq("id", agent_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build update data (only non-None fields)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update agent
    result = (
        supabase.table("agents")
        .update(update_data)
        .eq("id", agent_id)
        .execute()
    )
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update agent")
    
    return row_to_agent(result.data[0])


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Delete an agent.
    Only the owner can delete an agent.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Check ownership
    existing = supabase.table("agents").select("user_id").eq("id", agent_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    if existing.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete agent (cascades to scheduled_triggers)
    supabase.table("agents").delete().eq("id", agent_id).execute()
    
    return {"success": True, "message": "Agent deleted"}


@router.post("/{agent_id}/copy", response_model=AgentResponse)
async def copy_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
) -> AgentResponse:
    """
    Copy a public agent to the current user's list.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Get the source agent (must be public or owned by user)
    result = supabase.table("agents").select("*").eq("id", agent_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    source = result.data[0]
    if source["user_id"] != user_id and not source.get("is_public", False):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create a copy for the user
    copy_result = (
        supabase.table("agents")
        .insert({
            "user_id": user_id,
            "name": f"{source['name']} (副本)",
            "icon": source["icon"],
            "description": source["description"],
            "system_prompt": source["system_prompt"],
            "tools": source.get("tools", []),
            "is_public": False,  # Copies are private by default
        })
        .execute()
    )
    
    if not copy_result.data:
        raise HTTPException(status_code=500, detail="Failed to copy agent")
    
    # Increment usage count on the source agent
    supabase.rpc("increment_agent_usage", {"agent_uuid": agent_id}).execute()
    
    return row_to_agent(copy_result.data[0])


@router.post("/{agent_id}/use")
async def use_agent(
    agent_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Mark an agent as used (increment usage count).
    Returns the system prompt for injecting into conversation.
    """
    user_id = get_user_id(user)
    supabase = get_supabase()
    
    # Get the agent
    result = supabase.table("agents").select("*").eq("id", agent_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = result.data[0]
    if agent["user_id"] != user_id and not agent.get("is_public", False):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment usage count
    supabase.rpc("increment_agent_usage", {"agent_uuid": agent_id}).execute()
    
    return {
        "agent_id": agent_id,
        "name": agent["name"],
        "system_prompt": agent["system_prompt"],
        "tools": agent.get("tools", []),
    }


@router.post("/generate-prompt", response_model=GeneratePromptResponse)
async def generate_prompt(
    data: GeneratePromptRequest,
    user: dict = Depends(get_current_user),
) -> GeneratePromptResponse:
    """
    Generate a system prompt from description using meta-prompt template.
    """
    # Meta-prompt template for generating system prompts
    tools_description = ", ".join(data.tools) if data.tools else "无特殊工具"
    
    system_prompt = f"""# {data.name} 指令

## 1. 职责 (Role)
* 你是一个专业的 AI 助手，专注于：{data.description}

## 2. 目标 (Goal)
* 准确理解用户的需求和意图
* 提供高质量、专业的输出结果
* 持续优化用户交互体验
* 在能力范围内尽力满足用户需求

## 3. 整体方向 (Direction)
* **语气与个性:** 专业、友好、耐心
* **交互原则:** 主动询问澄清问题，确保理解正确
* **范围限制:** 专注于 {data.name} 相关任务

## 4. 可用工具
* {tools_description}

## 5. 分步指引 (Workflow)
1. **理解需求**: 仔细阅读用户输入，必要时主动提问澄清
2. **分析任务**: 将复杂任务分解为可执行的步骤
3. **执行任务**: 使用合适的工具和方法完成任务
4. **呈现结果**: 以清晰、结构化的方式展示结果
5. **征求反馈**: 询问用户是否需要调整或补充

## 6. 注意事项
* 如果遇到不确定的情况，优先询问用户
* 保持回复简洁但完整
* 遇到错误时及时说明并提供替代方案
"""
    
    return GeneratePromptResponse(system_prompt=system_prompt)
