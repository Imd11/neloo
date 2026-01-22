"""
PDF Generation Tool - create_pdf

Creates PDF documents with structured content.
Based on Anthropic's Agent Skills for pdf document creation.
"""

import json
import base64
from typing import Annotated, Any
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from ..runtime_context import user_id_ctx, thread_id_ctx
from ..sandbox import execute_python
from ..storage.file_storage import save_generated_file


def _validate_context(config: RunnableConfig | None) -> tuple[str, str]:
    """Validate and extract user_id and thread_id from config."""
    user_id = None
    thread_id = None
    
    if config:
        configurable = config.get("configurable") or {}
        if isinstance(configurable, dict):
            user_id = configurable.get("user_id")
            thread_id = configurable.get("thread_id")
    
    if not user_id:
        user_id = user_id_ctx.get()
    if not thread_id:
        thread_id = thread_id_ctx.get()
    
    if not user_id or user_id in ("default", "anonymous"):
        raise ValueError("无法获取用户身份，请重新登录")
    if not thread_id or thread_id == "default":
        raise ValueError("无法获取会话ID，请刷新页面")
    
    return user_id, thread_id


@tool
def create_pdf(
    spec: Annotated[str, """
JSON格式的PDF规格说明：
{
    "title": "文档标题",
    "author": "作者",
    "content": [
        {"type": "heading", "text": "第一章"},
        {"type": "paragraph", "text": "正文内容..."},
        {"type": "bullet_list", "items": ["要点1", "要点2"]}
    ],
    "page_size": "A4"
}
    """],
    output_name: Annotated[str, "输出文件名，如 'report.pdf'"],
    config: RunnableConfig = None,  # type: ignore[assignment]
) -> dict[str, Any]:
    """
    创建 PDF 文档。
    
    适用场景：正式报告、发票、证书
    
    返回包含 file_id, download_url, summary 的结构化对象。
    """
    try:
        user_id, thread_id = _validate_context(config)
    except ValueError as e:
        return {"success": False, "error": str(e)}
    
    if not output_name.endswith('.pdf'):
        output_name += '.pdf'
    
    try:
        spec_dict = json.loads(spec) if isinstance(spec, str) else spec
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON spec: {e}"}
    
    code = f'''
import json
import base64
from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

spec = {json.dumps(spec_dict)}

page_size = A4 if spec.get("page_size", "A4") == "A4" else letter

import io
buffer = io.BytesIO()
doc = SimpleDocTemplate(buffer, pagesize=page_size)

styles = getSampleStyleSheet()
story = []

if spec.get("title"):
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=24, spaceAfter=30)
    story.append(Paragraph(spec["title"], title_style))

for item in spec.get("content", []):
    item_type = item.get("type", "paragraph")
    
    if item_type == "heading":
        story.append(Spacer(1, 12))
        story.append(Paragraph(item.get("text", ""), styles['Heading1']))
    elif item_type == "paragraph":
        story.append(Paragraph(item.get("text", ""), styles['Normal']))
        story.append(Spacer(1, 6))
    elif item_type == "bullet_list":
        items = [ListItem(Paragraph(b, styles['Normal'])) for b in item.get("items", [])]
        story.append(ListFlowable(items, bulletType='bullet'))
        story.append(Spacer(1, 6))

doc.build(story)
file_bytes = buffer.getvalue()

print("__FILE_BASE64_START__")
print(base64.b64encode(file_bytes).decode('utf-8'))
print("__FILE_BASE64_END__")
'''
    
    result = execute_python(code=code, timeout=60, user_id=user_id, thread_id=thread_id)
    
    if not result.get("success"):
        return {"success": False, "error": result.get("error") or result.get("stderr", "Execution failed")}
    
    stdout = result.get("stdout", "")
    try:
        start_idx = stdout.index("__FILE_BASE64_START__") + len("__FILE_BASE64_START__")
        end_idx = stdout.index("__FILE_BASE64_END__")
        file_bytes = base64.b64decode(stdout[start_idx:end_idx].strip())
    except Exception as e:
        return {"success": False, "error": f"Failed to retrieve file content: {e}"}
    
    file_info = save_generated_file(
        filename=output_name, data=file_bytes,
        user_id=user_id, thread_id=thread_id, file_type="generated"
    )
    
    if not file_info:
        return {"success": False, "error": "Failed to save file to storage"}
    
    content = spec_dict.get("content", [])
    
    return {
        "success": True,
        "file_id": file_info.get("file_id"),
        "download_url": file_info.get("download_url"),
        "filename": output_name,
        "file_type": "generated",
        "summary": f"已创建 PDF 文档 {output_name}，共 {len(content)} 个内容块",
    }


PDF_TOOLS = [create_pdf]
