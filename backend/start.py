#!/usr/bin/env python3
"""
Production startup script for Railway deployment.

This script starts the LangGraph server with the FastAPI webapp.
It uses the LangGraph Python API to serve both the agent and the HTTP routes.

IMPORTANT: This script now configures PostgresSaver for checkpoint persistence.
Without this, thread history is lost on every restart.
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import uvicorn and the LangGraph server components
import uvicorn
from langgraph.server import GraphConfig
from langgraph.server.app import create_app

# =============================================================================
# PostgreSQL Checkpointer Configuration
# =============================================================================
# This is REQUIRED for thread history to persist across restarts.
# Without this, /threads/{id}/history returns 404 after each restart.

def get_postgres_connection_string() -> str | None:
    """
    Get PostgreSQL connection string from environment.
    
    Supports both:
    1. Direct DATABASE_URL (Railway standard)
    2. Supabase connection components (SUPABASE_DB_*)
    """
    # Option 1: Direct connection string
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url
    
    # Option 2: Supabase connection (construct from components)
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_db_host = os.environ.get("SUPABASE_DB_HOST")
    supabase_db_password = os.environ.get("SUPABASE_DB_PASSWORD")
    
    if supabase_db_host and supabase_db_password:
        # Supabase PostgreSQL connection string format
        # Format: postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres
        return f"postgresql://postgres:{supabase_db_password}@{supabase_db_host}:5432/postgres"
    
    # Fallback: Try to construct from SUPABASE_URL
    if supabase_url and supabase_db_password:
        # Extract project ref from supabase URL: https://[project-ref].supabase.co
        try:
            project_ref = supabase_url.replace("https://", "").split(".")[0]
            host = f"db.{project_ref}.supabase.co"
            return f"postgresql://postgres:{supabase_db_password}@{host}:5432/postgres"
        except Exception:
            pass
    
    return None


def create_checkpointer():
    """
    Create PostgreSQL checkpointer if connection string is available.
    Returns None if no database is configured (falls back to in-memory).
    """
    conn_string = get_postgres_connection_string()
    
    if not conn_string:
        print("⚠️  WARNING: No PostgreSQL connection configured. Thread history will NOT persist across restarts.")
        print("   Set DATABASE_URL or SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD to enable persistence.")
        return None
    
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        
        # Create PostgresSaver with connection string
        # Using sync version since GraphConfig expects sync checkpointer
        checkpointer = PostgresSaver.from_conn_string(conn_string)
        
        # Setup tables (idempotent - safe to call on every startup)
        checkpointer.setup()
        
        print("✅ PostgreSQL checkpointer configured. Thread history will persist across restarts.")
        return checkpointer
        
    except Exception as e:
        print(f"⚠️  WARNING: Failed to configure PostgreSQL checkpointer: {e}")
        print("   Falling back to in-memory storage. Thread history will NOT persist.")
        return None


# Import our graph and webapp
from src.agent.graph import graph
from src.api.webapp import app as webapp
from src.runtime_context_middleware import RuntimeContextASGIMiddleware

# Create checkpointer for persistence
checkpointer = create_checkpointer()

# Create the LangGraph application with our custom HTTP routes
config = GraphConfig(
    graphs={
        "data_analyst": graph,
    },
    http_app=webapp,
    checkpointer=checkpointer,  # Enable checkpoint persistence
)

app = create_app(config)
app = RuntimeContextASGIMiddleware(app)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))

    print(f"🚀 Starting Data Analyst Agent on port {port}")
    print(f"   - LangGraph Agent: /data_analyst/*")
    print(f"   - File API: /files/*")
    print(f"   - Image API: /images/*")
    print(f"   - Health: /health")
    if checkpointer:
        print(f"   - Checkpoint: PostgreSQL (persistent)")
    else:
        print(f"   - Checkpoint: In-Memory (NON-persistent)")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
    )
