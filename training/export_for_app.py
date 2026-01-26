"""
Export Trained Models for Fault.ai App

This script exports trained model weights to the format expected
by the Fault.ai backend.

Usage:
1. After training on Kaggle, download the weights folder
2. Run this script to copy and organize weights for the app
"""

import shutil
import json
from pathlib import Path
from datetime import datetime


def export_weights(
    kaggle_weights_dir: Path,
    app_weights_dir: Path,
    verbose: bool = True
):
    """
    Export trained weights to app format.

    Args:
        kaggle_weights_dir: Path to Kaggle output weights folder
        app_weights_dir: Path to app's backend/weights folder
    """
    kaggle_weights_dir = Path(kaggle_weights_dir)
    app_weights_dir = Path(app_weights_dir)

    if not kaggle_weights_dir.exists():
        raise FileNotFoundError(f"Kaggle weights not found: {kaggle_weights_dir}")

    app_weights_dir.mkdir(parents=True, exist_ok=True)

    # Copy all .pt files
    pt_files = list(kaggle_weights_dir.glob("*.pt"))
    for pt_file in pt_files:
        dest = app_weights_dir / pt_file.name
        shutil.copy2(pt_file, dest)
        if verbose:
            print(f"Copied: {pt_file.name}")

    # Copy config if exists
    config_file = kaggle_weights_dir / "config.json"
    if config_file.exists():
        shutil.copy2(config_file, app_weights_dir / "config.json")
        if verbose:
            print("Copied: config.json")

    # Copy manifest if exists
    manifest_file = kaggle_weights_dir / "manifest.json"
    if manifest_file.exists():
        shutil.copy2(manifest_file, app_weights_dir / "manifest.json")
        if verbose:
            print("Copied: manifest.json")

    # Create export metadata
    export_meta = {
        "exported_at": datetime.now().isoformat(),
        "source": str(kaggle_weights_dir),
        "files": [f.name for f in pt_files],
        "total_size_mb": sum(f.stat().st_size for f in pt_files) / 1e6
    }

    with open(app_weights_dir / "export_meta.json", 'w') as f:
        json.dump(export_meta, f, indent=2)

    if verbose:
        print(f"\nExported {len(pt_files)} model files to {app_weights_dir}")
        print(f"Total size: {export_meta['total_size_mb']:.2f} MB")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Export Kaggle weights to app")
    parser.add_argument(
        "--kaggle-dir",
        type=Path,
        required=True,
        help="Path to Kaggle weights folder"
    )
    parser.add_argument(
        "--app-dir",
        type=Path,
        default=Path(__file__).parent.parent / "backend" / "weights",
        help="Path to app weights folder (default: ../backend/weights)"
    )

    args = parser.parse_args()
    export_weights(args.kaggle_dir, args.app_dir)


if __name__ == "__main__":
    main()
