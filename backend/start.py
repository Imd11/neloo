#!/usr/bin/env python3
"""
Production startup script for Railway deployment.

This script starts the LangGraph server with the FastAPI webapp.
It uses the LangGraph Python API to serve both the agent and the HTTP routes.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import uvicorn and the LangGraph server components
import uvicorn
from langgraph.server import GraphConfig
from langgraph.server.app import create_app

# Import our graph and webapp
from src.agent.graph import graph
from src.api.webapp import app as webapp
from src.runtime_context_middleware import RuntimeContextASGIMiddleware

# Create the LangGraph application with our custom HTTP routes
config = GraphConfig(
    graphs={
        "data_analyst": graph,
    },
    http_app=webapp,
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

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
    )
