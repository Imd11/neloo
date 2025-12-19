#!/usr/bin/env python
"""
Knowledge Base Indexing Script

This script indexes all documents from the knowledge/ directory into the
vector store for RAG retrieval.

Usage:
    python -m src.rag.index_knowledge

Or from the backend directory:
    python scripts/index_knowledge.py
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")


def main():
    """Index all knowledge documents."""
    from src.rag import index_documents, get_vectorstore
    from src.rag.loader import get_knowledge_dir, get_indexed_stats

    print("=" * 60)
    print("Knowledge Base Indexer")
    print("=" * 60)

    knowledge_dir = get_knowledge_dir()
    print(f"\nKnowledge directory: {knowledge_dir}")

    if not knowledge_dir.exists():
        print(f"ERROR: Knowledge directory not found: {knowledge_dir}")
        print("Please create the directory and add documents first.")
        return 1

    # List available documents
    print("\nAvailable documents:")
    for category_dir in knowledge_dir.iterdir():
        if category_dir.is_dir() and not category_dir.name.startswith("."):
            files = list(category_dir.rglob("*"))
            doc_files = [f for f in files if f.is_file() and not f.name.startswith(".")]
            print(f"  {category_dir.name}/: {len(doc_files)} files")
            for f in doc_files[:5]:  # Show first 5
                print(f"    - {f.name}")
            if len(doc_files) > 5:
                print(f"    ... and {len(doc_files) - 5} more")

    # Index documents
    print("\nIndexing documents...")
    try:
        total_chunks = index_documents()
        print(f"\nIndexing complete! Total chunks: {total_chunks}")
    except Exception as e:
        print(f"\nERROR during indexing: {e}")
        import traceback
        traceback.print_exc()
        return 1

    # Show stats
    print("\n" + "=" * 60)
    print("Index Statistics")
    print("=" * 60)
    try:
        stats = get_indexed_stats()
        print(f"\nTotal documents: {stats['total_documents']}")

        print("\nBy category:")
        for cat, count in sorted(stats['by_category'].items()):
            print(f"  {cat}: {count}")

        print("\nBy file type:")
        for ftype, count in sorted(stats['by_file_type'].items()):
            print(f"  {ftype}: {count}")
    except Exception as e:
        print(f"Could not retrieve stats: {e}")

    # Test search
    print("\n" + "=" * 60)
    print("Test Search")
    print("=" * 60)
    try:
        from src.rag import search_knowledge

        test_query = "parallel trends DID"
        print(f"\nQuery: '{test_query}'")
        results = search_knowledge(test_query, k=2)

        if results:
            print(f"Found {len(results)} results:")
            for i, r in enumerate(results, 1):
                print(f"\n[{i}] {r.title or r.source} (score: {r.score:.2f})")
                print(f"    Category: {r.category}")
                print(f"    Preview: {r.content[:150]}...")
        else:
            print("No results found. Try adding more documents.")
    except Exception as e:
        print(f"Search test failed: {e}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
