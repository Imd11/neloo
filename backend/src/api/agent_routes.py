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
    favorite_count: int = 0  # Number of times added to collections
    creator_name: Optional[str] = None  # Display name of creator
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

def row_to_agent(row: dict, creator_name: Optional[str] = None) -> AgentResponse:
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
        favorite_count=row.get("favorite_count", 0),
        creator_name=creator_name,
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
    List public agents in the store with creator names.
    """
    supabase = get_supabase()
    
    # Step 1: Get public agents
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
    
    # Step 2: Batch fetch creator names from user_profiles
    user_ids = list(set(row["user_id"] for row in result.data if row.get("user_id")))
    creator_names_map = {}
    
    if user_ids:
        try:
            profiles_result = supabase.table("user_profiles").select("id, display_name").in_("id", user_ids).execute()
            for profile in profiles_result.data:
                creator_names_map[profile["id"]] = profile.get("display_name")
        except Exception as e:
            # If user_profiles table doesn't exist or query fails, continue without creator names
            print(f"Warning: Could not fetch user profiles: {e}")
    
    # Convert rows to AgentResponse with creator names
    agents = []
    for row in result.data:
        creator_name = creator_names_map.get(row.get("user_id"))
        agents.append(row_to_agent(row, creator_name=creator_name))
    
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
    Copy a public agent to the current user's list (add to favorites).
    Also increments the source agent's favorite_count and usage_count.
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
            "name": source['name'],  # Keep original name (no "副本" suffix)
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
    
    # Increment both usage_count and favorite_count on the source agent
    try:
        supabase.rpc("increment_agent_usage", {"agent_uuid": agent_id}).execute()
        supabase.rpc("increment_agent_favorite", {"agent_uuid": agent_id}).execute()
    except Exception:
        # If the RPC functions don't exist, fall back to direct update
        supabase.table("agents").update({
            "usage_count": source.get("usage_count", 0) + 1,
            "favorite_count": source.get("favorite_count", 0) + 1,
        }).eq("id", agent_id).execute()
    
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
    Generate a system prompt using LLM (DeepSeek).
    
    - System Prompt = 元提示词模板 (instructions for LLM on how to generate)
    - User Prompt = 用户的需求 (agent name, description, tools)
    - LLM generates the final agent system prompt
    """
    import httpx
    
    # Get DeepSeek API key
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="DeepSeek API not configured")
    
    # Tool descriptions for context
    tool_descriptions = {
        "search_web": "搜索网络获取最新信息",
        "code_sandbox": "执行 Python 代码，进行数据分析和可视化",
        "file_operations": "读写和管理用户文件",
        "image_generation": "生成 AI 图像",
        "browser": "浏览网页和提取信息",
    }
    
    tools_info = "\n".join([
        f"- {tool}: {tool_descriptions.get(tool, '可用工具')}"
        for tool in data.tools
    ]) if data.tools else "无特殊工具"
    
    # Meta-prompt template as System Prompt
    meta_prompt_template = """你是一个专业的 AI 提示词工程师。你的任务是根据用户提供的智能体需求，生成一个完整、专业的系统提示词（System Prompt）。

请严格按照以下模板结构生成系统提示词：

# [智能体名称] 指令模板

## 1. 职责 (Role/Responsibility)
* 清晰、简洁地定义这个智能体的核心身份和主要任务。
* 示例："你的职责是 [扮演的角色]，专注于帮助用户 [核心任务]。"

## 2. 目标 (Goal)
* (使用列表) 列出这个智能体需要达成的具体、可衡量的关键成果。
* 这些目标应直接支持"职责"的实现。

## 3. 整体方向 (Overall Direction)
* (使用列表) 设定贯穿始终的行为准则和风格：
    * **语气与个性:** 定义应有的沟通风格
    * **语言风格:** 使用通俗易懂的语言或专业术语
    * **交互原则:** 主动提出澄清问题，寻求确认
    * **上下文记忆:** 强调需要记住之前的对话内容
    * **范围限制:** 明确哪些话题不应讨论
    * **处理特殊情况:** 如何响应简单问候或能力问题

## 4. 分步指引 (Step-by-Step Guidance)
* 详细描述智能体完成核心任务的标准工作流程：
    * **步骤 1: 理解需求/启动** - 如何分析用户请求，主动提问澄清
    * **步骤 2: 规划与确认** - 概述解决方案，寻求用户确认
    * **步骤 3: 核心任务执行** - 如何生成主要输出内容
    * **步骤 4: 呈现与解释** - 如何展示结果和解释思路
    * **步骤 5: 反馈与迭代** - 征求反馈并调整
    * **步骤 6: 深入或下一步** - 选择后的深入操作
    * **步骤 7: 总结与结束** - 总结和结束交互

## 5. 可用工具
* 列出智能体可以使用的工具及其用途

## 6. 注意事项
* 列出关键的注意事项和限制

---

请根据用户提供的智能体信息，生成一个完整、个性化、高质量的系统提示词。直接输出生成的系统提示词，不需要额外解释。"""

    # User's requirements as User Prompt
    user_prompt = f"""请为我生成一个智能体的系统提示词：

**智能体名称**: {data.name}

**智能体描述**: {data.description}

**可用工具**:
{tools_info}

请根据以上信息，生成完整的系统提示词。"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": meta_prompt_template},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to generate prompt")
            
            result = response.json()
            generated_prompt = result["choices"][0]["message"]["content"].strip()
            
            return GeneratePromptResponse(system_prompt=generated_prompt)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# =============================================================================
# Generate Agent (Prompt + Icon in Parallel)
# =============================================================================

class GenerateAgentRequest(BaseModel):
    """Request model for generating full agent (prompt + icon)."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    tools: List[str] = []


class GenerateAgentResponse(BaseModel):
    """Response model for generated agent data."""
    system_prompt: str
    icon_url: str  # Data URL (base64) or empty string if failed


@router.post("/generate-agent", response_model=GenerateAgentResponse)
async def generate_agent(
    data: GenerateAgentRequest,
    user: dict = Depends(get_current_user),
) -> GenerateAgentResponse:
    """
    Generate both system prompt and icon in parallel.
    
    - Uses DeepSeek for system prompt generation
    - Uses FLUX.2 Klein via OpenRouter for icon generation
    """
    import httpx
    import asyncio
    
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY", "")
    tuzi_key = os.environ.get("TUZI_API_KEY", "")
    
    if not deepseek_key:
        raise HTTPException(status_code=500, detail="DeepSeek API not configured")
    
    # Tool descriptions for context
    tool_descriptions = {
        "search_web": "搜索网络获取最新信息",
        "code_sandbox": "执行 Python 代码，进行数据分析和可视化",
        "file_operations": "读写和管理用户文件",
        "image_generation": "生成 AI 图像",
        "browser": "浏览网页和提取信息",
    }
    
    tools_info = "\n".join([
        f"- {tool}: {tool_descriptions.get(tool, '可用工具')}"
        for tool in data.tools
    ]) if data.tools else "无特殊工具"
    
    # Meta-prompt for system prompt generation
    meta_prompt = """你是一个专业的 AI 提示词工程师。你的任务是根据用户提供的智能体需求，生成一个完整、专业的系统提示词（System Prompt）。

请严格按照以下模板结构生成系统提示词：

# [智能体名称] 指令模板

## 1. 职责 (Role/Responsibility)
* 清晰、简洁地定义这个智能体的核心身份和主要任务。

## 2. 目标 (Goal)
* (使用列表) 列出这个智能体需要达成的具体、可衡量的关键成果。

## 3. 整体方向 (Overall Direction)
* 设定贯穿始终的行为准则和风格。

## 4. 分步指引 (Step-by-Step Guidance)
* 详细描述智能体完成核心任务的标准工作流程。

## 5. 可用工具
* 列出智能体可以使用的工具及其用途。

## 6. 注意事项
* 列出关键的注意事项和限制。

请根据用户提供的智能体信息，生成一个完整、个性化、高质量的系统提示词。直接输出生成的系统提示词，不需要额外解释。"""

    user_prompt = f"""请为我生成一个智能体的系统提示词：

**智能体名称**: {data.name}

**智能体描述**: {data.description}

**可用工具**:
{tools_info}

请根据以上信息，生成完整的系统提示词。"""

    # Icon generation prompt
    icon_prompt = f"""Create a simple, modern app icon for an AI assistant called "{data.name}". 
The assistant's purpose is: {data.description}

Requirements:
- Simple, flat design style suitable for an app icon
- Single centered symbol or object
- Clean gradient background
- No text or letters
- Professional and modern look
- Square format, suitable as a 512x512 icon
- Vibrant but not garish colors"""

    async def generate_system_prompt(client: httpx.AsyncClient) -> str:
        """Generate system prompt using DeepSeek."""
        try:
            response = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {deepseek_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": meta_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
                timeout=60.0,
            )
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"].strip()
            return ""
        except Exception as e:
            print(f"Error generating prompt: {e}")
            return ""

    async def generate_icon(client: httpx.AsyncClient) -> str:
        """Generate icon using Gemini via tu-zi.com API."""
        print(f"[Icon Generation] Starting icon generation...")
        print(f"[Icon Generation] TUZI API Key configured: {bool(tuzi_key)}")
        if not tuzi_key:
            print("[Icon Generation] ERROR: No TUZI API Key!")
            return ""
        
        try:
            request_body = {
                "model": "gemini-2.5-flash-image-preview-nt",
                "prompt": icon_prompt,
                "size": "1024x1024",
                "n": 1,
                "response_format": "b64_json"
            }
            print(f"[Icon Generation] Request body: {request_body}")
            
            response = await client.post(
                "https://api.tu-zi.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {tuzi_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
                timeout=120.0,
            )
            
            print(f"[Icon Generation] Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"[Icon Generation] Full response keys: {result.keys() if isinstance(result, dict) else 'not a dict'}")
                
                # tu-zi.com returns: { "data": [{ "b64_json": "..." }] }
                data = result.get("data", [])
                if data and len(data) > 0:
                    b64_json = data[0].get("b64_json", "")
                    if b64_json:
                        # Convert to data URL format
                        image_url = f"data:image/png;base64,{b64_json}"
                        print(f"[Icon Generation] Successfully got image, length: {len(b64_json)}")
                        return image_url
                    
                    # Alternative: check for url field
                    url = data[0].get("url", "")
                    if url:
                        print(f"[Icon Generation] Got image URL: {url[:100]}...")
                        return url
                
                print(f"[Icon Generation] No valid image found in response: {result}")
                return ""
            else:
                print(f"[Icon Generation] API error: {response.status_code} - {response.text}")
                return ""
        except Exception as e:
            print(f"[Icon Generation] Exception: {e}")
            import traceback
            traceback.print_exc()
            return ""

    # Run both generations in parallel
    async with httpx.AsyncClient() as client:
        prompt_task = generate_system_prompt(client)
        icon_task = generate_icon(client)
        
        system_prompt, icon_url = await asyncio.gather(prompt_task, icon_task)
    
    if not system_prompt:
        raise HTTPException(status_code=502, detail="Failed to generate system prompt")
    
    return GenerateAgentResponse(
        system_prompt=system_prompt,
        icon_url=icon_url or ""
    )

