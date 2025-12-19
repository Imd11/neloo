#!/usr/bin/env python
"""
Knowledge Base File Watcher

Monitors the knowledge/ directory for file changes and automatically
re-indexes when files are added, modified, or deleted.

Usage:
    python scripts/watch_knowledge.py

Press Ctrl+C to stop.
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")


def get_file_states(knowledge_dir: Path) -> dict:
    """Get current state of all files in knowledge directory."""
    states = {}
    for file_path in knowledge_dir.rglob("*"):
        if file_path.is_file() and not file_path.name.startswith("."):
            states[str(file_path)] = file_path.stat().st_mtime
    return states


def run_indexing():
    """Run the indexing process."""
    from src.rag import index_documents
    from src.rag.loader import get_knowledge_dir, get_indexed_stats

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Indexing knowledge base...")

    try:
        total_chunks = index_documents()
        stats = get_indexed_stats()

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Done! {total_chunks} chunks indexed")
        print(f"  Categories: {dict(stats['by_category'])}")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {e}")


def main():
    """Main watch loop."""
    from src.rag.loader import get_knowledge_dir

    knowledge_dir = get_knowledge_dir()

    print("=" * 50)
    print("Knowledge Base File Watcher")
    print("=" * 50)
    print(f"Watching: {knowledge_dir}")
    print("Press Ctrl+C to stop\n")

    # Initial indexing
    run_indexing()

    # Get initial file states
    last_states = get_file_states(knowledge_dir)

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Watching for changes...")

    try:
        while True:
            time.sleep(2)  # Check every 2 seconds

            current_states = get_file_states(knowledge_dir)

            # Check for changes
            added = set(current_states.keys()) - set(last_states.keys())
            removed = set(last_states.keys()) - set(current_states.keys())
            modified = {
                f for f in current_states.keys() & last_states.keys()
                if current_states[f] != last_states[f]
            }

            if added or removed or modified:
                if added:
                    for f in added:
                        print(f"[+] Added: {Path(f).name}")
                if removed:
                    for f in removed:
                        print(f"[-] Removed: {Path(f).name}")
                if modified:
                    for f in modified:
                        print(f"[~] Modified: {Path(f).name}")

                run_indexing()
                last_states = current_states
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Watching for changes...")

    except KeyboardInterrupt:
        print("\n\nStopped watching.")


if __name__ == "__main__":
    main()
