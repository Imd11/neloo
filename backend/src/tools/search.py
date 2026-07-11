"""
Web Search Tool

Provides web search functionality using Tavily API.
"""

import os
from typing import Any, Literal


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
) -> dict[str, Any]:
    """
    Search the internet for information

    Uses Tavily API to perform web searches and return relevant results.

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default: 5)
        topic: Search topic type - "general", "news", or "finance"
        include_raw_content: Whether to include raw page content

    Returns:
        dict containing search results with titles, URLs, and snippets

    Example:
        results = internet_search("Python pandas tutorial", max_results=3)
        for result in results.get("results", []):
            print(f"- {result['title']}: {result['url']}")
    """
    try:
        from tavily import TavilyClient

        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return {"error": "TAVILY_API_KEY not set", "results": []}

        client = TavilyClient(api_key=api_key)

        result = client.search(
            query=query,
            max_results=max_results,
            topic=topic,
            include_raw_content=include_raw_content,
        )

        return result

    except ImportError:
        return {
            "error": "tavily-python not installed. Run: pip install tavily-python",
            "results": [],
        }
    except Exception as e:
        return {"error": f"Search failed: {str(e)}", "results": []}
