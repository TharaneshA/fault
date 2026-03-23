"""
Build script to create a standalone executable from the backend.

This uses PyInstaller to package the Python backend into a single binary
that Tauri can use as a sidecar. Works on both Windows and macOS.

Usage:
    pip install pyinstaller
    python build_exe.py
"""
import subprocess
import sys
import platform
import shutil
from pathlib import Path

BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
TAURI_BINARIES = PROJECT_ROOT / "src-tauri" / "binaries"


def get_target_triple():
    """
    Get the Rust-style target triple for the current platform.
    Tauri expects sidecar binaries named: <name>-<target_triple>[.exe]
    """
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "windows":
        return "x86_64-pc-windows-msvc"
    elif system == "darwin":
        # Apple Silicon (M1/M2/M3) vs Intel
        if machine == "arm64" or machine == "aarch64":
            return "aarch64-apple-darwin"
        else:
            return "x86_64-apple-darwin"
    elif system == "linux":
        return "x86_64-unknown-linux-gnu"
    else:
        raise RuntimeError(f"Unsupported platform: {system} {machine}")


def get_data_separator():
    """
    PyInstaller uses ';' on Windows and ':' on macOS/Linux
    for the --add-data argument.
    """
    if platform.system() == "Windows":
        return ";"
    return ":"


def build():
    """Build the backend executable."""
    system = platform.system()
    target_triple = get_target_triple()
    sep = get_data_separator()

    print("=" * 60)
    print("Building Fault.ai Backend Executable")
    print(f"  Platform:     {system} ({platform.machine()})")
    print(f"  Target:       {target_triple}")
    print(f"  Data sep:     '{sep}'")
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
        "--hidden-import", "google.generativeai",
        # Add all backend source files (separator is OS-dependent)
        "--add-data", f"{BACKEND_DIR / 'main.py'}{sep}.",
        "--add-data", f"{BACKEND_DIR / 'config.py'}{sep}.",
        "--add-data", f"{BACKEND_DIR / 'api'}{sep}api",
        "--add-data", f"{BACKEND_DIR / 'ccre'}{sep}ccre",
        "--add-data", f"{BACKEND_DIR / 'data'}{sep}data",
        "--add-data", f"{BACKEND_DIR / 'ingd'}{sep}ingd",
        "--add-data", f"{BACKEND_DIR / '.env'}{sep}.",
        # Add pretrained weights
        "--add-data", f"{BACKEND_DIR / 'weights'}{sep}weights",
        str(BACKEND_DIR / "run_server.py"),  # Entry point
    ]

    # macOS: disable universal2 to keep the binary smaller
    if system == "Darwin":
        cmd.insert(3, "--target-arch")
        cmd.insert(4, platform.machine())

    print(f"\nRunning: {' '.join(cmd)}\n")

    try:
        subprocess.check_call(cmd, cwd=str(BACKEND_DIR))
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        return False

    # Determine the output executable name
    if system == "Windows":
        exe_name = "fault-backend.exe"
        target_name = f"fault-backend-{target_triple}.exe"
    else:
        exe_name = "fault-backend"
        target_name = f"fault-backend-{target_triple}"

    exe_path = BACKEND_DIR / "dist" / exe_name

    if exe_path.exists():
        TAURI_BINARIES.mkdir(parents=True, exist_ok=True)
        target_path = TAURI_BINARIES / target_name

        shutil.copy2(exe_path, target_path)

        # On macOS/Linux, ensure the binary is executable
        if system != "Windows":
            target_path.chmod(0o755)

        print(f"\n[OK] Executable copied to: {target_path}")
        print(f"  Size: {target_path.stat().st_size / 1024 / 1024:.1f} MB")
        return True
    else:
        print(f"ERROR: Expected executable not found at {exe_path}")
        return False


if __name__ == "__main__":
    success = build()
    sys.exit(0 if success else 1)
