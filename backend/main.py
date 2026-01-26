"""
INGD Backend - FastAPI Application Entry Point.

This is the main entry point for the INGD (Improved Neural Granger Discovery)
backend server that provides root cause analysis APIs.
"""
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from api import router
from config import WEIGHTS_DIR, DATA_DIR


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    "logs/ingd_{time}.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Handles startup and shutdown tasks.
    """
    # Startup
    logger.info("=" * 50)
    logger.info("INGD Backend Starting")
    logger.info("=" * 50)

    # Ensure directories exist
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Path("logs").mkdir(exist_ok=True)

    logger.info(f"Weights directory: {WEIGHTS_DIR}")
    logger.info(f"Data directory: {DATA_DIR}")

    # Pre-initialize pipeline in background (optional)
    # This makes first request faster
    logger.info("Backend ready to accept requests")

    yield

    # Shutdown
    logger.info("INGD Backend Shutting Down")


# Create FastAPI app
app = FastAPI(
    title="INGD Backend",
    description="""
    Improved Neural Granger Discovery (INGD) Backend API.

    Provides root cause analysis for microservice systems using:
    - Hierarchical Neural Granger Causality
    - Hypergraph-based cascade modeling
    - Multi-signal root cause scoring

    Part of the Fault.ai multi-modal root cause analysis system.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "INGD Backend",
        "version": "1.0.0",
        "description": "Improved Neural Granger Discovery for Root Cause Analysis",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


def main():
    """Run the server directly (for development)."""
    import uvicorn

    logger.info("Starting INGD Backend Server...")

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main()
