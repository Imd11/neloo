#!/usr/bin/env python3
"""
Clean up ALL data in Supabase (Database + Storage)
WARNING: This will delete ALL data permanently!
"""
import asyncio
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

from supabase import create_client

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Tables to clear (in order to respect foreign key constraints)
TABLES = [
    "thread_files",     # References threads and files
    "chat_messages",    # References threads
    "files",            # File metadata
    "threads",          # Thread records
]

# Storage buckets to clear
BUCKETS = [
    "data-analyst-files",
    "data-analyst-images",
    "data-analyst-generated"
]


def cleanup_database():
    """Delete all records from database tables"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"\n{'='*60}")
    print("CLEANING DATABASE TABLES")
    print(f"{'='*60}")

    for table in TABLES:
        try:
            print(f"\nCleaning table: {table}")
            # Delete all rows (using a filter that matches everything)
            result = supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            print(f"  ✓ Deleted records from {table}")
        except Exception as e:
            print(f"  ✗ Error cleaning {table}: {e}")


def cleanup_storage():
    """Delete all files from storage buckets"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"\n{'='*60}")
    print("CLEANING STORAGE BUCKETS")
    print(f"{'='*60}")

    for bucket_name in BUCKETS:
        try:
            print(f"\nCleaning bucket: {bucket_name}")
            
            # List all files in bucket (including nested)
            result = supabase.storage.from_(bucket_name).list()
            
            if not result:
                print(f"  ✓ Bucket {bucket_name} is already empty")
                continue

            print(f"  Found {len(result)} items")

            # Collect all file paths to delete
            paths_to_delete = []
            
            for item in result:
                item_name = item.get('name')
                if not item_name:
                    continue
                paths_to_delete.append(item_name)

            # Delete all files
            if paths_to_delete:
                supabase.storage.from_(bucket_name).remove(paths_to_delete)
                print(f"  ✓ Deleted {len(paths_to_delete)} items from {bucket_name}")
            
        except Exception as e:
            print(f"  ✗ Error cleaning {bucket_name}: {e}")


def main():
    print("\n" + "="*60)
    print("SUPABASE FULL CLEANUP SCRIPT")
    print("="*60)
    print("\n⚠️  WARNING: This will DELETE ALL DATA:")
    print("\nDatabase tables:")
    for table in TABLES:
        print(f"  - {table}")
    print("\nStorage buckets:")
    for bucket in BUCKETS:
        print(f"  - {bucket}")

    print("\n" + "="*60)
    
    # Clean database first (to remove references)
    cleanup_database()
    
    # Then clean storage
    cleanup_storage()

    print("\n" + "="*60)
    print("✅ CLEANUP COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
