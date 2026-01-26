#!/usr/bin/env python3
"""
INGD Backend Server Runner.

This script starts the INGD backend server with proper configuration.
Used as the entry point for the Tauri sidecar.
"""
import sys
import os
from pathlib import Path

# Determine if we're running as a PyInstaller bundle
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    backend_dir = Path(sys._MEIPASS)
else:
    # Running as script
    backend_dir = Path(__file__).parent

# Add the backend directory to path
sys.path.insert(0, str(backend_dir))

# Set environment variables
os.environ.setdefault("INGD_ENV", "production")

def main():
    """Start the INGD backend server."""
    import uvicorn
    from loguru import logger

    # Import the app directly so PyInstaller can trace dependencies
    from main import app

    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
        level="INFO"
    )

    # Ensure log directory exists (use temp dir for frozen app)
    if getattr(sys, 'frozen', False):
        log_dir = Path(os.environ.get('TEMP', '/tmp')) / "fault-backend-logs"
    else:
        log_dir = backend_dir / "logs"
    log_dir.mkdir(exist_ok=True)

    logger.info("Starting INGD Backend Server...")
    logger.info(f"Backend directory: {backend_dir}")
    logger.info(f"Frozen: {getattr(sys, 'frozen', False)}")

    # Run server with the app object directly (not string import)
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="warning",
        access_log=False
    )


if __name__ == "__main__":
    main()
