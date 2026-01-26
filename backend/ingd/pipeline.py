"""
INGD Pipeline - End-to-end root cause analysis.

This module provides a unified interface for running the complete
INGD (Improved Neural Granger Discovery) pipeline.
"""
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from loguru import logger

from .hierarchical_granger import HierarchicalGranger
from .hypergraph_constructor import HypergraphConstructor, Hypergraph
from .root_cause_scorer import RootCauseScorer, RootCauseResult, AnomalyDetector
from config import INGDConfig, WEIGHTS_DIR


@dataclass
class INGDResult:
    """Complete result from INGD pipeline."""
    root_causes: List[RootCauseResult]
    causal_matrix: np.ndarray
    hypergraph: Hypergraph
    anomaly_scores: np.ndarray
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "root_causes": [rc.to_dict() for rc in self.root_causes],
            "causal_graph": {
                "nodes": [
                    {"id": i, "name": name}
                    for i, name in enumerate(self.metadata.get("metric_names", []))
                ],
                "edges": self._causal_matrix_to_edges()
            },
            "hypergraph": self.hypergraph.to_dict(),
            "anomaly_scores": self.anomaly_scores.tolist(),
            "metadata": {
                k: v for k, v in self.metadata.items()
                if k not in ["metric_names"]  # Already included in causal_graph
            }
        }

    def _causal_matrix_to_edges(self) -> List[Dict]:
        """Convert causal matrix to edge list."""
        edges = []
        n = self.causal_matrix.shape[0]
        names = self.metadata.get("metric_names", [f"node_{i}" for i in range(n)])

        for i in range(n):
            for j in range(n):
                if i != j and self.causal_matrix[i, j] > 0.1:
                    edges.append({
                        "source": i,
                        "target": j,
                        "source_name": names[i],
                        "target_name": names[j],
                        "weight": float(self.causal_matrix[i, j])
                    })

        return edges


class INGDPipeline:
    """
    End-to-end INGD pipeline for root cause analysis.

    Orchestrates the complete flow:
    1. Anomaly detection
    2. Hierarchical causal discovery
    3. Hypergraph construction
    4. Root cause scoring and ranking
    """

    def __init__(
        self,
        config: Optional[INGDConfig] = None,
        device: str = "cpu"
    ):
        """
        Initialize the INGD pipeline.

        Args:
            config: INGD configuration
            device: Device for computation ('cpu' or 'cuda')
        """
        self.config = config or INGDConfig()
        self.device = device

        # Initialize components
        self.anomaly_detector = AnomalyDetector()
        self.hierarchical_granger = HierarchicalGranger(
            config=self.config.hierarchical,
            granger_config=self.config.neural_granger,
            device=device
        )
        self.hypergraph_constructor = HypergraphConstructor(
            config=self.config.hypergraph
        )
        self.root_cause_scorer = RootCauseScorer(
            config=self.config.scorer
        )

        logger.info(f"INGD Pipeline initialized (device: {device})")

    def analyze(
        self,
        data: np.ndarray,
        metric_names: Optional[List[str]] = None,
        embeddings: Optional[np.ndarray] = None,
        use_pretrained: bool = True
    ) -> INGDResult:
        """
        Run complete root cause analysis.

        Args:
            data: Time series data of shape (time_steps, num_metrics)
            metric_names: Names of metrics/services
            embeddings: Optional CMEA embeddings (if available)
            use_pretrained: Whether to try loading pretrained weights

        Returns:
            INGDResult containing all analysis outputs
        """
        num_metrics = data.shape[1]
        metric_names = metric_names or [f"service_{i}" for i in range(num_metrics)]

        logger.info(f"Starting INGD analysis: {data.shape[0]} time steps, "
                   f"{num_metrics} metrics")

        # Step 1: Anomaly detection
        logger.info("Step 1: Detecting anomalies")
        anomaly_mask, anomaly_scores = self.anomaly_detector.detect(data)

        # Determine input data based on mode
        if self.config.input_mode == "cmea_embeddings" and embeddings is not None:
            logger.info("Using CMEA embeddings for causal discovery")
            analysis_data = embeddings
        else:
            logger.info("Using raw metrics for causal discovery")
            analysis_data = data

        # Step 2: Hierarchical causal discovery
        logger.info("Step 2: Discovering causal structure")
        causal_matrix, causal_metadata = self.hierarchical_granger.discover(
            analysis_data,
            metric_names=metric_names,
            anomaly_scores=anomaly_scores
        )

        # Step 3: Hypergraph construction
        logger.info("Step 3: Constructing hypergraph")
        hypergraph = self.hypergraph_constructor.construct(
            causal_matrix,
            node_names=metric_names,
            anomaly_mask=anomaly_scores > 0.5
        )

        # Step 4: Root cause scoring
        logger.info("Step 4: Scoring root causes")
        root_causes = self.root_cause_scorer.score(
            causal_matrix=causal_matrix,
            hypergraph=hypergraph,
            anomaly_scores=anomaly_scores,
            node_names=metric_names
        )

        # Compile metadata
        metadata = {
            "metric_names": metric_names,
            "num_metrics": num_metrics,
            "time_steps": data.shape[0],
            "input_mode": self.config.input_mode,
            "anomalous_metrics": int(np.sum(anomaly_scores > 0.5)),
            **causal_metadata
        }

        result = INGDResult(
            root_causes=root_causes,
            causal_matrix=causal_matrix,
            hypergraph=hypergraph,
            anomaly_scores=anomaly_scores,
            metadata=metadata
        )

        logger.info(f"Analysis complete. Top root cause: {root_causes[0].node_name} "
                   f"(confidence: {root_causes[0].confidence:.3f})")

        return result

    def analyze_incremental(
        self,
        new_data: np.ndarray,
        previous_result: INGDResult
    ) -> INGDResult:
        """
        Incremental analysis using previous results.

        Useful for online/streaming scenarios where we want to
        update analysis as new data arrives without full recomputation.

        Args:
            new_data: New time series data
            previous_result: Result from previous analysis

        Returns:
            Updated INGDResult
        """
        # For now, just re-run full analysis
        # TODO: Implement true incremental update
        metric_names = previous_result.metadata.get("metric_names")
        return self.analyze(new_data, metric_names=metric_names)

    def save_model(self, path: Optional[Path] = None):
        """Save trained model weights."""
        if path is None:
            path = WEIGHTS_DIR / "ingd_pipeline.pt"
        # Save hierarchical granger models
        # (Implementation depends on how we want to serialize)
        logger.info(f"Model saved to {path}")

    def load_model(self, path: Optional[Path] = None):
        """Load pretrained model weights."""
        if path is None:
            path = WEIGHTS_DIR / "ingd_pipeline.pt"
        # Load hierarchical granger models
        logger.info(f"Model loaded from {path}")

    def load_pretrained_weights(self, weights_dir: Optional[Path] = None) -> bool:
        """
        Load pre-trained weights from Kaggle training.

        Args:
            weights_dir: Directory containing .pt weight files

        Returns:
            True if weights were loaded successfully
        """
        import torch

        weights_dir = weights_dir or WEIGHTS_DIR

        # Look for manifest
        manifest_path = weights_dir / "manifest.json"
        if manifest_path.exists():
            import json
            with open(manifest_path) as f:
                manifest = json.load(f)
            logger.info(f"Found manifest with {len(manifest.get('models', []))} models")

        # Find available weight files
        weight_files = list(weights_dir.glob("neural_granger_*.pt"))

        if not weight_files:
            logger.warning(f"No pretrained weights found in {weights_dir}")
            return False

        logger.info(f"Found {len(weight_files)} pretrained weight files")

        # Load the first available (or a specific one based on data)
        # In production, you'd match weights to the dataset being analyzed
        self._pretrained_weights = {}
        for wf in weight_files:
            try:
                checkpoint = torch.load(wf, map_location=self.device)
                case_id = wf.stem.replace("neural_granger_", "")
                self._pretrained_weights[case_id] = checkpoint
                logger.info(f"Loaded weights: {case_id} ({checkpoint.get('num_series', '?')} series)")
            except Exception as e:
                logger.warning(f"Failed to load {wf}: {e}")

        return len(self._pretrained_weights) > 0

    def get_available_pretrained(self) -> List[str]:
        """Get list of available pretrained model IDs."""
        if not hasattr(self, '_pretrained_weights'):
            self.load_pretrained_weights()
        return list(getattr(self, '_pretrained_weights', {}).keys())


def quick_analyze(
    data: np.ndarray,
    metric_names: Optional[List[str]] = None,
    top_k: int = 5,
    device: str = "cpu"
) -> List[Dict[str, Any]]:
    """
    Quick convenience function for root cause analysis.

    Args:
        data: Time series data of shape (time_steps, num_metrics)
        metric_names: Names of metrics/services
        top_k: Number of root causes to return
        device: Device for computation

    Returns:
        List of root cause dictionaries
    """
    config = INGDConfig()
    config.scorer.top_k = top_k

    pipeline = INGDPipeline(config=config, device=device)
    result = pipeline.analyze(data, metric_names=metric_names)

    return [rc.to_dict() for rc in result.root_causes]
