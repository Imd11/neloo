"""
Document Loader and Indexer

Loads knowledge documents from the knowledge/ directory and indexes them
into the vector store for retrieval.

Supports:
- Markdown files (.md) - methodology guides, checklists
- Text files (.txt) - notes, references
- Python files (.py) - code templates with documentation
- PDF files (.pdf) - research papers (requires pypdf)
"""

import os
import hashlib
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from langchain_core.documents import Document


@dataclass
class DocumentConfig:
    """Configuration for different document types."""
    chunk_size: int
    chunk_overlap: int
    should_chunk: bool


# Document type configurations
DOC_CONFIGS = {
    # Methodology docs: keep relatively intact, light chunking
    "methods": DocumentConfig(chunk_size=2000, chunk_overlap=200, should_chunk=True),
    # Checklists: don't chunk, keep whole
    "checklists": DocumentConfig(chunk_size=4000, chunk_overlap=0, should_chunk=False),
    # Error examples: moderate chunking
    "errors": DocumentConfig(chunk_size=1500, chunk_overlap=150, should_chunk=True),
    # Papers: heavier chunking for long documents
    "papers": DocumentConfig(chunk_size=1000, chunk_overlap=100, should_chunk=True),
    # Python templates: the actual code to use in sandbox, keep whole
    "python_templates": DocumentConfig(chunk_size=5000, chunk_overlap=0, should_chunk=False),
    # Stata reference: reference only, NOT for execution, keep whole
    "stata_reference": DocumentConfig(chunk_size=3000, chunk_overlap=0, should_chunk=False),
    # Legacy support
    "code_templates": DocumentConfig(chunk_size=3000, chunk_overlap=0, should_chunk=False),
    # Preferences: keep whole
    "preferences": DocumentConfig(chunk_size=2000, chunk_overlap=0, should_chunk=False),
}

DEFAULT_CONFIG = DocumentConfig(chunk_size=1500, chunk_overlap=150, should_chunk=True)


def get_knowledge_dir() -> Path:
    """Get the knowledge directory path."""
    backend_dir = Path(__file__).parent.parent.parent
    return backend_dir / "knowledge"


def compute_doc_id(content: str, source: str) -> str:
    """Compute a stable document ID from content and source."""
    hash_input = f"{source}:{content[:500]}"
    return hashlib.md5(hash_input.encode()).hexdigest()[:16]


def load_markdown_file(file_path: Path, category: str) -> list[Document]:
    """Load a markdown file and optionally chunk it."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    config = DOC_CONFIGS.get(category, DEFAULT_CONFIG)

    metadata = {
        "source": str(file_path.name),
        "category": category,
        "file_path": str(file_path),
        "file_type": "markdown",
    }

    # Extract title from first heading if present
    lines = content.split("\n")
    for line in lines:
        if line.startswith("# "):
            metadata["title"] = line[2:].strip()
            break

    if not config.should_chunk or len(content) <= config.chunk_size:
        # Return as single document
        return [Document(page_content=content, metadata=metadata)]

    # Chunk the document
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "],
    )

    chunks = splitter.split_text(content)
    documents = []

    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            **metadata,
            "chunk_index": i,
            "total_chunks": len(chunks),
        }
        documents.append(Document(page_content=chunk, metadata=chunk_metadata))

    return documents


def load_python_file(file_path: Path, category: str) -> list[Document]:
    """Load a Python file as a code template."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    metadata = {
        "source": str(file_path.name),
        "category": category,
        "file_path": str(file_path),
        "file_type": "python",
        "title": file_path.stem.replace("_", " ").title(),
    }

    # Extract docstring as description
    if content.startswith('"""'):
        end = content.find('"""', 3)
        if end != -1:
            metadata["description"] = content[3:end].strip()

    # Don't chunk code files
    return [Document(page_content=content, metadata=metadata)]


def load_pdf_file(file_path: Path, category: str) -> list[Document]:
    """Load a PDF file (research paper)."""
    try:
        from langchain_community.document_loaders import PyPDFLoader
    except ImportError:
        print(f"[RAG] Skipping PDF {file_path.name}: pypdf not installed")
        return []

    loader = PyPDFLoader(str(file_path))
    pages = loader.load()

    config = DOC_CONFIGS.get(category, DEFAULT_CONFIG)

    # Add category metadata to all pages
    for page in pages:
        page.metadata["category"] = category
        page.metadata["file_type"] = "pdf"

    if not config.should_chunk:
        return pages

    # Chunk across pages
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap,
    )

    return splitter.split_documents(pages)


def load_text_file(file_path: Path, category: str) -> list[Document]:
    """Load a plain text file."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    config = DOC_CONFIGS.get(category, DEFAULT_CONFIG)

    metadata = {
        "source": str(file_path.name),
        "category": category,
        "file_path": str(file_path),
        "file_type": "text",
    }

    if not config.should_chunk or len(content) <= config.chunk_size:
        return [Document(page_content=content, metadata=metadata)]

    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap,
    )

    chunks = splitter.split_text(content)
    documents = []

    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            **metadata,
            "chunk_index": i,
            "total_chunks": len(chunks),
        }
        documents.append(Document(page_content=chunk, metadata=chunk_metadata))

    return documents


def load_document(file_path: Path, category: str) -> list[Document]:
    """Load a document based on its file extension."""
    suffix = file_path.suffix.lower()

    loaders = {
        ".md": load_markdown_file,
        ".markdown": load_markdown_file,
        ".py": load_python_file,
        ".pdf": load_pdf_file,
        ".txt": load_text_file,
    }

    loader = loaders.get(suffix)
    if loader is None:
        print(f"[RAG] Skipping unsupported file type: {file_path}")
        return []

    try:
        return loader(file_path, category)
    except Exception as e:
        print(f"[RAG] Error loading {file_path}: {e}")
        return []


def index_single_document(file_path: str | Path, category: Optional[str] = None) -> int:
    """
    Index a single document into the vector store.

    Args:
        file_path: Path to the document
        category: Category for the document (auto-detected if not provided)

    Returns:
        Number of chunks indexed
    """
    from .vectorstore import add_documents

    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    # Auto-detect category from parent directory
    if category is None:
        category = file_path.parent.name

    documents = load_document(file_path, category)

    if not documents:
        return 0

    # Generate stable IDs
    ids = [
        compute_doc_id(doc.page_content, doc.metadata.get("source", ""))
        for doc in documents
    ]

    add_documents(documents, ids=ids)

    print(f"[RAG] Indexed {len(documents)} chunks from {file_path.name}")
    return len(documents)


def index_documents(
    directory: Optional[str | Path] = None,
    category: Optional[str] = None,
    recursive: bool = True
) -> int:
    """
    Index all documents from a directory into the vector store.

    Args:
        directory: Directory to index (defaults to knowledge/)
        category: Category filter (e.g., "methods", "papers")
        recursive: Whether to process subdirectories

    Returns:
        Total number of chunks indexed
    """
    from .vectorstore import add_documents

    if directory is None:
        directory = get_knowledge_dir()
    else:
        directory = Path(directory)

    if not directory.exists():
        print(f"[RAG] Directory not found: {directory}")
        return 0

    total_chunks = 0
    all_documents = []
    all_ids = []

    # Determine directories to process
    if category:
        dirs_to_process = [directory / category] if (directory / category).exists() else []
    else:
        dirs_to_process = [
            d for d in directory.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]

    for cat_dir in dirs_to_process:
        cat_name = cat_dir.name

        # Get all files in the category directory
        if recursive:
            files = list(cat_dir.rglob("*"))
        else:
            files = list(cat_dir.glob("*"))

        for file_path in files:
            if file_path.is_file() and not file_path.name.startswith("."):
                # Determine actual category from path
                # e.g., code_templates/python -> python_templates
                # e.g., code_templates/stata -> stata_reference
                actual_category = cat_name
                if cat_name == "code_templates":
                    parent_name = file_path.parent.name
                    if parent_name == "python":
                        actual_category = "python_templates"
                    elif parent_name == "stata":
                        actual_category = "stata_reference"

                documents = load_document(file_path, actual_category)

                for doc in documents:
                    doc_id = compute_doc_id(
                        doc.page_content,
                        doc.metadata.get("source", "")
                    )
                    all_documents.append(doc)
                    all_ids.append(doc_id)

    if all_documents:
        add_documents(all_documents, ids=all_ids)
        total_chunks = len(all_documents)

    print(f"[RAG] Indexed {total_chunks} total chunks from {directory}")
    return total_chunks


def get_indexed_stats() -> dict:
    """Get statistics about indexed documents."""
    from .vectorstore import get_vectorstore

    vectorstore = get_vectorstore()
    collection = vectorstore._collection

    # Get count by category
    results = collection.get(include=["metadatas"])

    stats = {
        "total_documents": len(results["ids"]),
        "by_category": {},
        "by_file_type": {},
    }

    for metadata in results["metadatas"]:
        category = metadata.get("category", "unknown")
        file_type = metadata.get("file_type", "unknown")

        stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
        stats["by_file_type"][file_type] = stats["by_file_type"].get(file_type, 0) + 1

    return stats
