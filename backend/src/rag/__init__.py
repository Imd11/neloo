"""
RAG (Retrieval-Augmented Generation) Module

This module provides knowledge retrieval capabilities for the data analysis agent,
with a focus on econometrics methodology and best practices.

Components:
- vectorstore: Chroma vector database management
- embeddings: Text embedding using OpenAI
- retriever: Knowledge search and retrieval
- loader: Document loading and chunking

Usage:
    from src.rag import search_knowledge, index_documents

    # Search for relevant knowledge
    results = search_knowledge("difference-in-differences assumptions")

    # Index new documents
    index_documents("/path/to/knowledge/methods/")
"""

from .retriever import search_knowledge, get_retriever
from .loader import index_documents, index_single_document
from .vectorstore import get_vectorstore, reset_vectorstore

__all__ = [
    "search_knowledge",
    "get_retriever",
    "index_documents",
    "index_single_document",
    "get_vectorstore",
    "reset_vectorstore",
]
