"""
Knowledge Retriever

Provides the main search interface for retrieving relevant knowledge
from the vector store.
"""

from typing import Optional
from dataclasses import dataclass


@dataclass
class SearchResult:
    """A single search result with content and metadata."""
    content: str
    source: str
    category: str
    score: float
    title: Optional[str] = None
    file_type: Optional[str] = None


def search_knowledge(
    query: str,
    k: int = 5,
    category: Optional[str] = None,
    min_score: float = 0.0,
) -> list[SearchResult]:
    """
    Search the knowledge base for relevant information.

    This is the main entry point for RAG retrieval.

    Args:
        query: Natural language search query
        k: Maximum number of results to return
        category: Filter by category (methods, checklists, errors, papers, etc.)
        min_score: Minimum similarity score threshold (0-1, higher is more similar)

    Returns:
        List of SearchResult objects sorted by relevance

    Example:
        results = search_knowledge(
            "How to test parallel trends assumption in DID?",
            category="methods",
            k=3
        )
        for r in results:
            print(f"[{r.category}] {r.source}: {r.content[:200]}...")
    """
    from .vectorstore import similarity_search_with_score

    # Build filter if category specified
    filter_dict = {"category": category} if category else None

    # Search with scores
    results = similarity_search_with_score(query, k=k, filter=filter_dict)

    search_results = []
    for doc, score in results:
        # Chroma returns distance, convert to similarity (1 - distance)
        # Lower distance = more similar
        similarity = 1 - score if score <= 1 else 1 / (1 + score)

        if similarity >= min_score:
            search_results.append(SearchResult(
                content=doc.page_content,
                source=doc.metadata.get("source", "unknown"),
                category=doc.metadata.get("category", "unknown"),
                score=similarity,
                title=doc.metadata.get("title"),
                file_type=doc.metadata.get("file_type"),
            ))

    # Sort by score descending
    search_results.sort(key=lambda x: x.score, reverse=True)

    return search_results


def search_knowledge_formatted(
    query: str,
    k: int = 5,
    category: Optional[str] = None,
) -> str:
    """
    Search knowledge and return formatted string for LLM context.

    This is designed to be used directly in prompts or tool outputs.

    Args:
        query: Search query
        k: Number of results
        category: Optional category filter

    Returns:
        Formatted string with search results
    """
    results = search_knowledge(query, k=k, category=category)

    if not results:
        return f"No relevant knowledge found for: {query}"

    output_parts = [f"## Knowledge Search Results for: {query}\n"]

    for i, result in enumerate(results, 1):
        header = f"### [{i}] {result.title or result.source}"
        if result.category:
            header += f" ({result.category})"

        output_parts.append(header)
        output_parts.append(f"**Relevance Score:** {result.score:.2f}")
        output_parts.append(f"\n{result.content}\n")
        output_parts.append("---\n")

    return "\n".join(output_parts)


def get_retriever(
    k: int = 5,
    category: Optional[str] = None,
    search_type: str = "similarity",
):
    """
    Get a LangChain retriever for use in chains.

    Args:
        k: Number of documents to retrieve
        category: Optional category filter
        search_type: Type of search ("similarity" or "mmr")

    Returns:
        LangChain Retriever object
    """
    from .vectorstore import get_vectorstore

    vectorstore = get_vectorstore()

    search_kwargs = {"k": k}
    if category:
        search_kwargs["filter"] = {"category": category}

    return vectorstore.as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )


def get_relevant_context(
    query: str,
    categories: Optional[list[str]] = None,
    max_tokens: int = 2000,
) -> str:
    """
    Get relevant context from multiple categories, respecting token limits.

    Useful for building comprehensive context for complex queries.

    Args:
        query: Search query
        categories: List of categories to search (None = all)
        max_tokens: Approximate maximum tokens in output

    Returns:
        Combined context string
    """
    if categories is None:
        categories = ["methods", "checklists", "errors", "code_templates"]

    all_results = []

    # Search each category
    for cat in categories:
        results = search_knowledge(query, k=2, category=cat)
        all_results.extend(results)

    # Sort by relevance
    all_results.sort(key=lambda x: x.score, reverse=True)

    # Build context respecting token limit (rough estimate: 4 chars per token)
    context_parts = []
    current_length = 0
    max_chars = max_tokens * 4

    for result in all_results:
        if current_length + len(result.content) > max_chars:
            # Truncate this result if it's the first one
            if not context_parts:
                remaining = max_chars - current_length
                context_parts.append(f"[{result.category}] {result.content[:remaining]}...")
            break

        context_parts.append(f"[{result.category}] {result.content}")
        current_length += len(result.content)

    return "\n\n---\n\n".join(context_parts)
