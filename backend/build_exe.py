"""
Build script to create a standalone executable from the backend.

This uses PyInstaller to package the Python backend into a single .exe
that Tauri can use as a sidecar.

Usage:
    pip install pyinstaller
    python build_exe.py
"""
import subprocess
import sys
import shutil
from pathlib import Path

BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
TAURI_BINARIES = PROJECT_ROOT / "src-tauri" / "binaries"


def build():
    """Build the backend executable."""
    print("=" * 60)
    print("Building Fault.ai Backend Executable")
    print("=" * 60)

    # Ensure PyInstaller is installed
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",  # Single executable
        "--name", "fault-backend",
        "--distpath", str(BACKEND_DIR / "dist"),
        "--workpath", str(BACKEND_DIR / "build"),
        "--specpath", str(BACKEND_DIR),
        "--clean",
        "--noconfirm",
        # Hidden imports that PyInstaller might miss
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.lifespan.off",
        "--hidden-import", "fastapi",
        "--hidden-import", "pydantic",
        "--hidden-import", "torch",
        "--hidden-import", "numpy",
        "--hidden-import", "pandas",
        "--hidden-import", "networkx",
        "--hidden-import", "scipy",
        "--hidden-import", "sklearn",
        "--hidden-import", "loguru",
        # Add all backend source files
        "--add-data", f"{BACKEND_DIR / 'main.py'};.",
        "--add-data", f"{BACKEND_DIR / 'config.py'};.",
        "--add-data", f"{BACKEND_DIR / 'api'};api",
        "--add-data", f"{BACKEND_DIR / 'data'};data",
        "--add-data", f"{BACKEND_DIR / 'ingd'};ingd",
        # Add pretrained weights
        "--add-data", f"{BACKEND_DIR / 'weights'};weights",
        str(BACKEND_DIR / "run_server.py"),  # Entry point
    ]

    print(f"\nRunning: {' '.join(cmd)}\n")

    try:
        subprocess.check_call(cmd, cwd=str(BACKEND_DIR))
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        return False

    # Copy to Tauri binaries folder
    exe_path = BACKEND_DIR / "dist" / "fault-backend.exe"
    if exe_path.exists():
        TAURI_BINARIES.mkdir(parents=True, exist_ok=True)

        # Tauri expects the format: name-target_triple.exe
        # For Windows x64: fault-backend-x86_64-pc-windows-msvc.exe
        target_name = "fault-backend-x86_64-pc-windows-msvc.exe"
        target_path = TAURI_BINARIES / target_name

        shutil.copy2(exe_path, target_path)
        print(f"\n[OK] Executable copied to: {target_path}")
        print(f"  Size: {target_path.stat().st_size / 1024 / 1024:.1f} MB")
        return True
    else:
        print(f"ERROR: Expected executable not found at {exe_path}")
        return False


if __name__ == "__main__":
    success = build()
    sys.exit(0 if success else 1)
