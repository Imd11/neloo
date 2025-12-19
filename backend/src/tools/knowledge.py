"""
Knowledge Search Tool

Provides econometrics and statistical methodology knowledge retrieval
through the RAG system.
"""

from typing import Optional, Literal
from langchain_core.tools import tool


@tool
def search_knowledge(
    query: str,
    category: Optional[Literal["methods", "checklists", "errors", "papers", "python_templates", "stata_reference", "preferences"]] = None,
    num_results: int = 3,
) -> str:
    """
    Search the econometrics and data analysis knowledge base for methodology guidance,
    best practices, common errors, and code templates.

    Use this tool when:
    - Planning an empirical analysis (e.g., "How to implement DID?")
    - Checking methodology requirements (e.g., "What are IV assumptions?")
    - Looking for Python code templates to execute (e.g., "Python regression table template")
    - Understanding Stata output formats (reference only) (e.g., "Stata esttab format")
    - Avoiding common mistakes (e.g., "DID common errors")

    Args:
        query: Natural language search query describing what you need.
               Examples:
               - "How to test parallel trends in difference-in-differences"
               - "Python code for event study plot"
               - "Stata regression table format reference"

        category: Optional filter to search specific knowledge types:
               - "methods": Methodology guides (DID, IV, RDD, Panel, etc.)
               - "checklists": Analysis verification checklists
               - "errors": Common mistakes and how to avoid them
               - "papers": Academic paper references and examples
               - "python_templates": Python code templates (USE THESE for execution)
               - "stata_reference": Stata code reference (for understanding output formats ONLY, do NOT execute)
               - "preferences": User-specific analysis preferences
               Leave empty to search all categories.

        num_results: Number of results to return (1-10, default 3)

    Returns:
        Formatted string with relevant knowledge excerpts and their sources.

    IMPORTANT:
    - python_templates: These are the actual Python implementations to use in the sandbox
    - stata_reference: These are Stata code FOR REFERENCE ONLY - use them to understand
      the desired output format, then use the corresponding python_templates to produce equivalent results
    """
    try:
        from src.rag import search_knowledge as rag_search

        # Clamp num_results
        num_results = max(1, min(10, num_results))

        results = rag_search(query, k=num_results, category=category)

        if not results:
            return f"No relevant knowledge found for: {query}\n\nTip: Try a broader query or remove the category filter."

        output_parts = []
        for i, result in enumerate(results, 1):
            header = f"## [{i}] {result.title or result.source}"
            if result.category:
                header += f" (Category: {result.category})"

            output_parts.append(header)
            output_parts.append(f"**Relevance:** {result.score:.0%}")
            output_parts.append("")
            output_parts.append(result.content)
            output_parts.append("\n---\n")

        return "\n".join(output_parts)

    except ImportError as e:
        return f"Knowledge base not available: {e}\n\nPlease ensure RAG dependencies are installed."
    except Exception as e:
        return f"Error searching knowledge base: {e}"


@tool
def list_knowledge_categories() -> str:
    """
    List all available knowledge categories and their contents.

    Use this to understand what knowledge is available before searching.

    Returns:
        Overview of knowledge categories and document counts.
    """
    try:
        from src.rag.loader import get_indexed_stats

        stats = get_indexed_stats()

        output = ["# Knowledge Base Overview", ""]
        output.append(f"**Total Documents:** {stats['total_documents']}")
        output.append("")

        output.append("## By Category")
        for category, count in sorted(stats['by_category'].items()):
            descriptions = {
                "methods": "Methodology guides (DID, IV, RDD, etc.)",
                "checklists": "Analysis verification checklists",
                "errors": "Common mistakes and solutions",
                "papers": "Academic paper references",
                "python_templates": "Python code templates (USE THESE in sandbox)",
                "stata_reference": "Stata code reference (output format reference ONLY)",
                "preferences": "User analysis preferences",
            }
            desc = descriptions.get(category, "")
            output.append(f"- **{category}**: {count} documents - {desc}")

        output.append("")
        output.append("## By File Type")
        for file_type, count in sorted(stats['by_file_type'].items()):
            output.append(f"- {file_type}: {count}")

        return "\n".join(output)

    except Exception as e:
        return f"Error listing knowledge categories: {e}"
