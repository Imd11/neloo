#!/usr/bin/env python3
"""
Clean up all files in Supabase Storage buckets
WARNING: This will delete ALL files in the specified buckets!
"""
import asyncio
import os
from supabase import create_client

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Need service key for admin operations

BUCKETS = [
    "data-analyst-files",
    "data-analyst-images",
    "data-analyst-generated"
]

async def cleanup_bucket(bucket_name: str):
    """Delete all files in a bucket"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"\n{'='*60}")
    print(f"Cleaning bucket: {bucket_name}")
    print(f"{'='*60}")

    try:
        # List all files in bucket
        result = supabase.storage.from_(bucket_name).list()

        if not result:
            print(f"✓ Bucket {bucket_name} is already empty")
            return

        print(f"Found {len(result)} items")

        # Delete each item (files and folders)
        for item in result:
            item_name = item.get('name')
            if not item_name:
                continue

            try:
                # Try to delete as folder first (will recursively delete contents)
                supabase.storage.from_(bucket_name).remove([item_name])
                print(f"  ✓ Deleted: {item_name}")
            except Exception as e:
                print(f"  ✗ Failed to delete {item_name}: {e}")

        print(f"✓ Finished cleaning {bucket_name}")

    except Exception as e:
        print(f"✗ Error cleaning {bucket_name}: {e}")

async def main():
    print("\n" + "="*60)
    print("SUPABASE STORAGE CLEANUP SCRIPT")
    print("="*60)
    print("\nWARNING: This will DELETE ALL FILES in the following buckets:")
    for bucket in BUCKETS:
        print(f"  - {bucket}")

    confirm = input("\nType 'yes' to continue: ")
    if confirm.lower() != 'yes':
        print("Aborted.")
        return

    for bucket in BUCKETS:
        await cleanup_bucket(bucket)

    print("\n" + "="*60)
    print("CLEANUP COMPLETE")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
