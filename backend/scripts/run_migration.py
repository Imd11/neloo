#!/usr/bin/env python3
"""Execute database migration for message branching feature."""

import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

async def run_migration():
    from supabase import acreate_client
    
    print("Connecting to Supabase...")
    supabase = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Migration SQL statements
    migrations = [
        # 1. Add target_ai_message_id to shared_conversations
        """ALTER TABLE shared_conversations ADD COLUMN IF NOT EXISTS target_ai_message_id TEXT""",
        
        # 2. Add fork columns to threads
        """ALTER TABLE threads ADD COLUMN IF NOT EXISTS parent_thread_id TEXT""",
        """ALTER TABLE threads ADD COLUMN IF NOT EXISTS fork_target_ai_message_id TEXT""",
        """ALTER TABLE threads ADD COLUMN IF NOT EXISTS fork_anchor_human_message_id TEXT""",
    ]
    
    print("Running migrations...")
    
    # Try using rpc if available, otherwise use postgrest-py execute
    try:
        # Use raw SQL via postgrest
        for i, sql in enumerate(migrations, 1):
            print(f"  [{i}/{len(migrations)}] {sql[:60]}...")
            # Try to execute via rpc
            result = await supabase.rpc("exec_sql", {"sql": sql}).execute()
            print(f"    ✓ Done")
    except Exception as e:
        print(f"RPC method failed: {e}")
        print("\nPlease run the following SQL manually in Supabase Dashboard:")
        print("-" * 60)
        for sql in migrations:
            print(sql + ";")
        print("-" * 60)
        return False
    
    print("\n✓ All migrations completed!")
    return True

if __name__ == "__main__":
    asyncio.run(run_migration())
