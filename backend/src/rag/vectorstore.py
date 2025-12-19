"""
Vector Store Management

Uses Chroma as the vector database for storing and retrieving knowledge embeddings.
Supports both persistent storage and in-memory operation.
"""

import os
from pathlib import Path
from typing import Optional

# Lazy imports to avoid startup overhead
_vectorstore = None
_embeddings = None


def get_embeddings():
    """Get or create the embedding model."""
    global _embeddings
    if _embeddings is None:
        # Try OpenAI embeddings first (best quality)
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key:
            from langchain_openai import OpenAIEmbeddings
            _embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=openai_key,
            )
        else:
            # Fallback to HuggingFace embeddings (free, local)
            try:
                from langchain_community.embeddings import HuggingFaceEmbeddings
                _embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2",
                    model_kwargs={"device": "cpu"},
                )
            except ImportError:
                raise ImportError(
                    "No embedding model available. Either set OPENAI_API_KEY or "
                    "install sentence-transformers: pip install sentence-transformers"
                )
    return _embeddings


def get_persist_directory() -> Path:
    """Get the directory for persisting the vector store."""
    # Store in backend/data/chroma
    backend_dir = Path(__file__).parent.parent.parent
    persist_dir = backend_dir / "data" / "chroma"
    persist_dir.mkdir(parents=True, exist_ok=True)
    return persist_dir


def get_vectorstore(collection_name: str = "econometrics_knowledge"):
    """
    Get or create the Chroma vector store.

    Args:
        collection_name: Name of the collection to use

    Returns:
        Chroma vector store instance
    """
    global _vectorstore

    if _vectorstore is None:
        try:
            from langchain_chroma import Chroma
        except ImportError:
            raise ImportError(
                "langchain-chroma is required. Install with: pip install langchain-chroma"
            )

        persist_dir = get_persist_directory()
        embeddings = get_embeddings()

        _vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=str(persist_dir),
        )

        # Log status
        count = _vectorstore._collection.count()
        print(f"[RAG] Loaded vector store with {count} documents from {persist_dir}")

    return _vectorstore


def reset_vectorstore(collection_name: str = "econometrics_knowledge") -> None:
    """
    Reset the vector store by deleting all documents.

    Use with caution - this deletes all indexed knowledge!
    """
    global _vectorstore

    try:
        from langchain_chroma import Chroma
    except ImportError:
        raise ImportError(
            "langchain-chroma is required. Install with: pip install langchain-chroma"
        )

    persist_dir = get_persist_directory()

    # Delete existing collection
    if _vectorstore is not None:
        try:
            _vectorstore.delete_collection()
        except Exception:
            pass
        _vectorstore = None

    # Recreate empty store
    embeddings = get_embeddings()
    _vectorstore = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(persist_dir),
    )

    print(f"[RAG] Vector store reset. Collection: {collection_name}")


def add_documents(documents: list, ids: Optional[list[str]] = None) -> list[str]:
    """
    Add documents to the vector store.

    Args:
        documents: List of LangChain Document objects
        ids: Optional list of document IDs

    Returns:
        List of document IDs that were added
    """
    vectorstore = get_vectorstore()

    if ids:
        return vectorstore.add_documents(documents, ids=ids)
    else:
        return vectorstore.add_documents(documents)


def similarity_search(query: str, k: int = 5, filter: Optional[dict] = None) -> list:
    """
    Search for similar documents.

    Args:
        query: Search query
        k: Number of results to return
        filter: Optional metadata filter

    Returns:
        List of Document objects
    """
    vectorstore = get_vectorstore()

    if filter:
        return vectorstore.similarity_search(query, k=k, filter=filter)
    else:
        return vectorstore.similarity_search(query, k=k)


def similarity_search_with_score(
    query: str,
    k: int = 5,
    filter: Optional[dict] = None
) -> list[tuple]:
    """
    Search for similar documents with relevance scores.

    Args:
        query: Search query
        k: Number of results to return
        filter: Optional metadata filter

    Returns:
        List of (Document, score) tuples
    """
    vectorstore = get_vectorstore()

    if filter:
        return vectorstore.similarity_search_with_score(query, k=k, filter=filter)
    else:
        return vectorstore.similarity_search_with_score(query, k=k)
