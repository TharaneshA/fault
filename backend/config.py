"""
Configuration settings for the INGD backend.
"""
import sys
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Base paths - handle PyInstaller frozen apps
if getattr(sys, 'frozen', False):
    # Running as compiled executable - use PyInstaller's temp directory
    BACKEND_DIR = Path(sys._MEIPASS)
else:
    # Running as script
    BACKEND_DIR = Path(__file__).parent

# Load environment variables from .env file
load_dotenv(BACKEND_DIR / ".env")

WEIGHTS_DIR = BACKEND_DIR / "weights"
DATA_DIR = BACKEND_DIR / "data"

# Ensure directories exist (may fail in frozen app, that's ok)
try:
    WEIGHTS_DIR.mkdir(exist_ok=True)
    DATA_DIR.mkdir(exist_ok=True)
except (PermissionError, OSError):
    pass  # Frozen apps have read-only bundled directories


class NeuralGrangerConfig(BaseModel):
    """Configuration for Neural Granger model."""
    hidden_dim: int = 64
    num_layers: int = 2
    dropout: float = 0.1
    lambda_sparse: float = 0.01  # Group-lasso sparsity penalty
    learning_rate: float = 0.001
    max_lag: int = 5  # Maximum time lag for Granger causality
    batch_size: int = 32
    num_epochs: int = 100


class HierarchicalConfig(BaseModel):
    """Configuration for Hierarchical Divide-and-Conquer approach."""
    max_subset_size: int = 50  # Maximum metrics per subset before splitting
    min_subset_size: int = 10  # Minimum metrics per subset
    merge_threshold: float = 0.3  # Threshold for merging causal edges
    num_workers: int = 4  # Parallel processing workers


class HypergraphConfig(BaseModel):
    """Configuration for Hypergraph construction."""
    min_cascade_length: int = 2  # Minimum nodes in a cascade path
    max_cascade_length: int = 5  # Maximum nodes in a cascade path
    edge_weight_threshold: float = 0.5  # Minimum edge weight to include
    max_paths_per_source: int = 20  # Limit paths per source node for performance


class RootCauseScorerConfig(BaseModel):
    """Configuration for Root Cause Scorer."""
    top_k: int = 5  # Number of top root causes to return
    anomaly_weight: float = 0.4  # Weight for anomaly score
    centrality_weight: float = 0.3  # Weight for graph centrality
    cascade_weight: float = 0.3  # Weight for cascade impact


class CCREConfig(BaseModel):
    """Configuration for CCRE (Causal Chain Reasoning Explanation)."""
    model: str = "gemini-2.5-flash"  # Gemini 2.5 Flash model
    max_tokens: int = 4096
    temperature: float = 0.3  # Lower for more consistent explanations


class INGDConfig(BaseModel):
    """Main INGD configuration combining all sub-configs."""
    neural_granger: NeuralGrangerConfig = NeuralGrangerConfig()
    hierarchical: HierarchicalConfig = HierarchicalConfig()
    hypergraph: HypergraphConfig = HypergraphConfig()
    scorer: RootCauseScorerConfig = RootCauseScorerConfig()

    # Input mode: "raw_metrics" or "cmea_embeddings"
    input_mode: str = "raw_metrics"

    # Device for inference
    device: str = "cpu"


# Default configuration instance
default_config = INGDConfig()
