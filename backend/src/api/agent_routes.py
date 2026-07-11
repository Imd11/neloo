"""
Agent Management API Routes

This module provides CRUD endpoints for custom agents.
"""

import os
from typing import Optional, List
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from supabase import create_client, Client

from .auth import get_current_user, get_user_id
from ..identity import get_persistent_user

# =============================================================================
# Configuration
# =============================================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Create router
router = APIRouter(prefix="/api/agents", tags=["agents"])


def get_model():
    """Load the configured default chat model only when an AI route needs it."""
    from ..agent.graph import get_model as get_configured_model

    return get_configured_model()


async def _generate_model_text(system_prompt: str, user_prompt: str) -> str:
    model = get_model()
    response = await model.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    content = getattr(response, "content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content).strip()


def get_agent_icon_provider() -> dict[str, str] | None:
    """Return the configured server-side image provider for agent icons."""
    gemini_key = (
        os.environ.get("GEMINI_IMAGE_API_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
    )
    if gemini_key:
        return {
            "provider": "gemini",
            "api_key": gemini_key,
            "model": os.environ.get("GEMINI_IMAGE_MODEL", "").strip() or "gemini-3.1-flash-image",
        }

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        return {
            "provider": "openai",
            "api_key": openai_key,
            "base_url": os.environ.get("OPENAI_BASE_URL", "").strip().rstrip("/") or "https://api.openai.com",
            "model": os.environ.get("OPENAI_IMAGE_MODEL", "").strip() or "gpt-image-2",
        }

    return None


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
                status_code=503,
                detail="Agents require SUPABASE_URL and SUPABASE_SERVICE_KEY. Configure persistence, then restart the backend."
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


# =============================================================================
# Request/Response Models
# =============================================================================

class AgentCreate(BaseModel):
    """Request model for creating an agent."""
    name: str = Field(..., min_length=1, max_length=100)
    # Can be an emoji (legacy) or an AI-generated image Data URL / URL.
    # Data URLs for 1024x1024 PNGs can be >1MB, so avoid tiny limits.
    icon: str = Field(default="🤖", max_length=6_000_000)
    description: str = Field(..., min_length=1, max_length=1000)
    system_prompt: str = Field(..., min_length=1)
    tools: List[str] = Field(default=["search_web"])
    is_public: bool = Field(default=False)


class AgentUpdate(BaseModel):
    """Request model for updating an agent."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    # Same format as AgentCreate.icon (emoji or image Data URL / URL).
    icon: Optional[str] = Field(None, max_length=6_000_000)
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
    user: dict = Depends(get_persistent_user),
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
    user: dict = Depends(get_persistent_user),
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
    user: dict = Depends(get_persistent_user),
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
    user: dict = Depends(get_persistent_user),
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
    user: dict = Depends(get_persistent_user),
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
    user: dict = Depends(get_persistent_user),
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
            "name": source['name'],  # Keep original name without adding a copy suffix
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
    user: dict = Depends(get_persistent_user),
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
    Generate a system prompt using the configured default chat model.
    
    - System Prompt = meta-prompt template with instructions for the LLM.
    - User Prompt = the user's requirements, including agent name, description, and tools.
    - LLM generates the final agent system prompt
    """
    # Tool descriptions for context
    tool_descriptions = {
        "search_web": "Search the web for current information.",
        "code_sandbox": "Execute Python code for computation, data processing, and visualization.",
        "file_operations": "Read, write, and manage user files.",
        "image_generation": "Generate AI images.",
        "browser": "Browse web pages and extract information.",
    }
    
    tools_info = "\n".join([
        f"- {tool}: {tool_descriptions.get(tool, 'Available tool')}"
        for tool in data.tools
    ]) if data.tools else "No special tools"
    
    # Meta-prompt template as System Prompt
    meta_prompt_template = """You are a professional AI prompt engineer. Your task is to generate a complete, professional system prompt based on the agent requirements provided by the user.

Generate the system prompt strictly using this structure:

# [Agent Name] Instruction Template

## 1. Role / Responsibility
* Clearly and concisely define the agent's core identity and primary task.
* Example: "Your responsibility is to act as [role], focusing on helping users [core task]."

## 2. Goals
* Use a list to describe the specific, measurable outcomes the agent should achieve.
* These goals should directly support the stated role.

## 3. Overall Direction
* Use a list to define consistent behavior and style:
    * **Tone and personality:** define the communication style.
    * **Language style:** specify whether to use plain language, professional terminology, or both.
    * **Interaction principles:** ask clarifying questions proactively and seek confirmation when needed.
    * **Context memory:** emphasize using relevant prior conversation context.
    * **Scope limits:** clearly define topics or tasks the agent should avoid.
    * **Special cases:** explain how to respond to greetings or capability questions.

## 4. Step-by-Step Guidance
* Describe the standard workflow for completing the agent's core task:
    * **Step 1: Understand / initialize** - how to analyze the user's request and ask clarifying questions.
    * **Step 2: Plan and confirm** - outline the solution and seek confirmation when useful.
    * **Step 3: Execute the core task** - how to produce the main output.
    * **Step 4: Present and explain** - how to show results and explain reasoning.
    * **Step 5: Feedback and iteration** - request feedback and revise.
    * **Step 6: Deepen or continue** - describe possible follow-up actions.
    * **Step 7: Summarize and close** - summarize the outcome and close the interaction.

## 5. Available Tools
* List the tools the agent can use and explain what each tool is for.

## 6. Constraints and Notes
* List key constraints, limitations, and important operating rules.

---

Generate a complete, customized, high-quality system prompt based on the provided agent information. Output only the generated system prompt, with no extra explanation."""

    # User's requirements as User Prompt
    user_prompt = f"""Generate a system prompt for an agent:

**Agent name**: {data.name}

**Agent description**: {data.description}

**Available tools**:
{tools_info}

Generate the complete system prompt based on the information above."""

    try:
        generated_prompt = await _generate_model_text(meta_prompt_template, user_prompt)
        if not generated_prompt:
            raise HTTPException(status_code=502, detail="Failed to generate prompt")
        return GeneratePromptResponse(system_prompt=generated_prompt)
    except HTTPException:
        raise
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
    
    - Uses the configured default chat model for system prompt generation
    - Uses the configured server-side image provider for icon generation
    """
    import httpx
    import asyncio
    
    # Tool descriptions for context
    tool_descriptions = {
        "search_web": "Search the web for current information.",
        "code_sandbox": "Execute Python code for computation, data processing, and visualization.",
        "file_operations": "Read, write, and manage user files.",
        "image_generation": "Generate AI images.",
        "browser": "Browse web pages and extract information.",
    }
    
    tools_info = "\n".join([
        f"- {tool}: {tool_descriptions.get(tool, 'Available tool')}"
        for tool in data.tools
    ]) if data.tools else "No special tools"
    
    # Meta-prompt for system prompt generation
    meta_prompt = """You are a professional AI prompt engineer. Your task is to generate a complete, professional system prompt based on the agent requirements provided by the user.

Generate the system prompt strictly using this structure:

# [Agent Name] Instruction Template

## 1. Role / Responsibility
* Clearly and concisely define the agent's core identity and primary task.

## 2. Goals
* Use a list to describe the specific, measurable outcomes the agent should achieve.

## 3. Overall Direction
* Define consistent behavior, communication style, and interaction principles.

## 4. Step-by-Step Guidance
* Describe the standard workflow for completing the agent's core task.

## 5. Available Tools
* List the tools the agent can use and explain what each tool is for.

## 6. Constraints and Notes
* List key constraints, limitations, and important operating rules.

Generate a complete, customized, high-quality system prompt based on the provided agent information. Output only the generated system prompt, with no extra explanation."""

    user_prompt = f"""Generate a system prompt for an agent:

**Agent name**: {data.name}

**Agent description**: {data.description}

**Available tools**:
{tools_info}

Generate the complete system prompt based on the information above."""

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

    async def generate_system_prompt() -> str:
        """Generate a system prompt with the configured default chat model."""
        try:
            return await _generate_model_text(meta_prompt, user_prompt)
        except Exception as e:
            print(f"Error generating prompt: {e}")
            return ""

    async def generate_icon(client: httpx.AsyncClient) -> str:
        """Generate icon using the configured server-side image provider."""
        provider = get_agent_icon_provider()
        if not provider:
            return ""

        try:
            if provider["provider"] == "gemini":
                response = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/interactions",
                    headers={
                        "x-goog-api-key": provider["api_key"],
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": provider["model"],
                        "input": icon_prompt,
                        "response_format": {
                            "type": "image",
                            "mime_type": "image/png",
                            "aspect_ratio": "1:1",
                            "image_size": "1K",
                        },
                    },
                    timeout=120.0,
                )
                if response.status_code != 200:
                    return ""
                output_image = response.json().get("output_image", {})
                image_data = output_image.get("data", "")
                if not image_data:
                    return ""
                mime_type = output_image.get("mime_type", "image/png")
                return f"data:{mime_type};base64,{image_data}"

            request_body = {
                "model": provider["model"],
                "prompt": icon_prompt,
                "size": "1024x1024",
                "n": 1,
                "response_format": "b64_json",
            }
            response = await client.post(
                f"{provider['base_url']}/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {provider['api_key']}",
                    "Content-Type": "application/json",
                },
                json=request_body,
                timeout=120.0,
            )
            if response.status_code == 200:
                result = response.json()
                data = result.get("data", [])
                if data and len(data) > 0:
                    b64_json = data[0].get("b64_json", "")
                    if b64_json:
                        return f"data:image/png;base64,{b64_json}"
                    url = data[0].get("url", "")
                    if url:
                        return url
            return ""
        except Exception as e:
            print(f"[Icon Generation] Exception: {e}")
            return ""

    # Run both generations in parallel
    async with httpx.AsyncClient() as client:
        prompt_task = generate_system_prompt()
        icon_task = generate_icon(client)
        
        system_prompt, icon_url = await asyncio.gather(prompt_task, icon_task)
    
    if not system_prompt:
        raise HTTPException(status_code=502, detail="Failed to generate system prompt")
    
    return GenerateAgentResponse(
        system_prompt=system_prompt,
        icon_url=icon_url or ""
    )
