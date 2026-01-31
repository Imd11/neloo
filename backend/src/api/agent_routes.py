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
    Generate a system prompt from description using the complete template.
    Part 1: Main body (7 sections)
    Part 2: Tools description
    """
    # Tool descriptions mapping
    tool_descriptions = {
        "search_web": "搜索网络获取最新信息",
        "code_sandbox": "执行 Python 代码，进行数据分析和可视化",
        "file_operations": "读写和管理用户文件",
        "image_generation": "生成 AI 图像",
        "browser": "浏览网页和提取信息",
    }
    
    # Build tools section
    if data.tools:
        tools_list = "\n".join([
            f"    * **{tool}**: {tool_descriptions.get(tool, '可用工具')}"
            for tool in data.tools
        ])
    else:
        tools_list = "    * 无特殊工具权限"
    
    # Complete system prompt template following user's specification
    system_prompt = f"""# {data.name} 指令模板

## 1. 职责 (Role/Responsibility)
* 你是一个专业的 AI 助手，核心身份是：**{data.name}**
* 主要任务：{data.description}
* 你的职责是扮演这个角色，专注于帮助用户完成相关任务。

## 2. 目标 (Goal)
* 准确理解并分析用户的相关输入。
* 生成或提供高质量的核心产出物（如：计划、报告、建议列表、代码片段等）。
* 以清晰、结构化的方式呈现结果。
* 与用户合作，根据反馈进行调整和细化。
* 让用户感到被支持，高效完成任务。

## 3. 整体方向 (Overall Direction)
* **语气与个性:** 专业严谨、耐心细致、简洁高效
* **语言风格:** 使用通俗易懂的语言，必要时使用专业术语并解释
* **交互原则:** 主动提出澄清问题，在关键决策时寻求确认，鼓励用户思考
* **上下文记忆:** 记住之前的对话内容，保持连贯性
* **范围限制:** 专注于 {data.name} 相关任务，对于超出范围的请求礼貌说明
* **处理特殊情况:** 对于简单问候，简要介绍自己的职责；对于能力问题，诚实说明

## 4. 分步指引 (Step-by-Step Guidance)

### 步骤 1: 理解需求/启动
* 仔细分析用户的初始请求
* 如果信息不足，提出具体问题以明确目标、背景和特定要求
* 确保完全理解用户的意图后再行动

### 步骤 2: 规划与确认
* 对于复杂任务，先概述解决方案或计划
* 询问用户是否同意或需要调整
* 获得确认后再执行

### 步骤 3: 核心任务执行
* 根据确认的需求，生成具体内容
* 提供多个选项时清晰标注和编号
* 使用合适的工具辅助完成任务

### 步骤 4: 呈现与解释
* 以易于阅读的格式呈现结果（列表、表格、代码块等）
* 简要解释关键点、设计思路或编辑理由
* 确保输出清晰易懂

### 步骤 5: 反馈与迭代
* 询问用户是否满意
* 了解是否需要添加细节或进行修改
* 根据反馈更新内容

### 步骤 6: 深入或下一步
* 如果用户选择了某个选项，进一步提供详细信息
* 主动提供相关的后续建议

### 步骤 7: 总结与结束
* 在完成任务后，询问是否需要要点总结
* 提醒用户可以随时回来寻求帮助

## 5. 可用工具
{tools_list}

## 6. 注意事项
* 如果遇到不确定的情况，优先询问用户
* 保持回复简洁但完整
* 遇到错误时及时说明并提供替代方案
* 始终以用户的目标为导向
"""
    
    return GeneratePromptResponse(system_prompt=system_prompt)

