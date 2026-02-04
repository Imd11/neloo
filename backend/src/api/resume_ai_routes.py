"""
Resume AI API Routes

Provides endpoints for AI-powered resume optimization.
Uses DeepSeek API via backend proxy.
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/resume", tags=["resume-ai"])

# DeepSeek API configuration
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"


class ChatMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str


class OptimizeRequest(BaseModel):
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None
    stream: bool = False


class OptimizeResponse(BaseModel):
    content: str
    success: bool = True


# System prompt for resume optimization
RESUME_SYSTEM_PROMPT = """你是一位专业的简历优化助手。你的任务是帮助用户优化他们的简历内容。

你的能力包括：
1. 优化职位描述和工作经历的表述
2. 建议更有力的动词和关键词
3. 提供针对特定行业的优化建议
4. 帮助精简冗长的内容
5. 检查语法和表达问题

【重要】当用户要求修改简历内容时，你需要返回 JSON 格式的响应：

如果用户只是提问（不涉及修改），正常回复文字即可。

如果用户要求修改某个字段，返回如下 JSON：
```json
{
  "message": "你的回复文字，解释为什么这样修改",
  "suggestion": {
    "field": "字段路径，如 personal.summary 或 experience.0.description",
    "before": "原始内容",
    "after": "优化后的内容",
    "reason": "修改理由"
  }
}
```

字段路径说明：
- personal.name - 姓名
- personal.title - 职位
- personal.summary - 个人简介
- personal.email - 邮箱
- experience.0.description - 第一段工作经历的描述
- experience.0.position - 第一段工作经历的职位
- education.0.description - 第一段教育经历的描述
- skills.0.name - 第一个技能名称

回复规则：
- 如果是普通对话，直接返回文字
- 如果是修改请求，返回包含 suggestion 的 JSON
- JSON 必须用 ```json 包裹"""


@router.post("/optimize")
async def optimize_resume(request: OptimizeRequest) -> OptimizeResponse:
    """
    AI-powered resume optimization endpoint.
    
    Proxies requests to DeepSeek API using backend API key.
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="DeepSeek API key not configured on server"
        )
    
    # Build messages with system prompt
    system_prompt = request.system_prompt or RESUME_SYSTEM_PROMPT
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": m.role, "content": m.content} for m in request.messages])
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": DEEPSEEK_MODEL,
                    "messages": messages,
                    "stream": False,
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                print(f"❌ DeepSeek API error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"DeepSeek API error: {error_text}"
                )
            
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            return OptimizeResponse(content=content, success=True)
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="DeepSeek API timeout")
    except Exception as e:
        print(f"❌ Resume optimize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
