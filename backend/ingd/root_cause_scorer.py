"""
Root Cause Scorer for ranking potential root causes.

This module combines multiple signals (anomaly detection, causal structure,
hypergraph features) to produce a ranked list of likely root causes.
"""
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from loguru import logger
import networkx as nx

from .hypergraph_constructor import Hypergraph
from config import RootCauseScorerConfig


@dataclass
class RootCauseResult:
    """Result for a single root cause candidate."""
    node_id: int
    node_name: str
    confidence: float  # Overall confidence score [0, 1]
    rank: int
    anomaly_score: float
    causal_score: float
    cascade_score: float
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "node_id": self.node_id,
            "node_name": self.node_name,
            "confidence": round(self.confidence, 4),
            "rank": self.rank,
            "anomaly_score": round(self.anomaly_score, 4),
            "causal_score": round(self.causal_score, 4),
            "cascade_score": round(self.cascade_score, 4),
            "details": self.details
        }


class RootCauseScorer:
    """
    Scores and ranks potential root causes.

    Combines three main signals:
    1. Anomaly scores: How anomalous is each metric/service
    2. Causal centrality: Position in the causal graph (high out-degree, low in-degree)
    3. Cascade impact: Size and strength of cascades originating from each node
    """

    def __init__(self, config: Optional[RootCauseScorerConfig] = None):
        """
        Initialize the root cause scorer.

        Args:
            config: Scorer configuration
        """
        self.config = config or RootCauseScorerConfig()

    def score(
        self,
        causal_matrix: np.ndarray,
        hypergraph: Optional[Hypergraph] = None,
        anomaly_scores: Optional[np.ndarray] = None,
        node_names: Optional[List[str]] = None
    ) -> List[RootCauseResult]:
        """
        Score and rank potential root causes.

        Args:
            causal_matrix: Causal weight matrix of shape (n, n)
            hypergraph: Optional hypergraph for cascade analysis
            anomaly_scores: Optional anomaly scores for each node
            node_names: Names of nodes

        Returns:
            List of RootCauseResult sorted by confidence (descending)
        """
        num_nodes = causal_matrix.shape[0]
        node_names = node_names or [f"service_{i}" for i in range(num_nodes)]

        # Initialize scores
        if anomaly_scores is None:
            anomaly_scores = np.ones(num_nodes)  # Equal weight if not provided

        # Normalize anomaly scores to [0, 1]
        if anomaly_scores.max() > 0:
            norm_anomaly = (anomaly_scores - anomaly_scores.min()) / (anomaly_scores.max() - anomaly_scores.min() + 1e-8)
        else:
            norm_anomaly = np.zeros(num_nodes)

        # Compute causal scores
        causal_scores = self._compute_causal_scores(causal_matrix)

        # Compute cascade scores (from hypergraph if available)
        cascade_scores = self._compute_cascade_scores(hypergraph, num_nodes)

        # Combine scores
        final_scores = (
            self.config.anomaly_weight * norm_anomaly +
            self.config.centrality_weight * causal_scores +
            self.config.cascade_weight * cascade_scores
        )

        # Create results
        results = []
        sorted_indices = np.argsort(-final_scores)

        for rank, idx in enumerate(sorted_indices[:self.config.top_k], start=1):
            # Gather details
            details = self._gather_node_details(
                idx, causal_matrix, hypergraph, node_names
            )

            result = RootCauseResult(
                node_id=int(idx),
                node_name=node_names[idx],
                confidence=float(final_scores[idx]),
                rank=rank,
                anomaly_score=float(norm_anomaly[idx]),
                causal_score=float(causal_scores[idx]),
                cascade_score=float(cascade_scores[idx]),
                details=details
            )
            results.append(result)

        logger.info(f"Ranked {len(results)} root cause candidates. "
                   f"Top: {results[0].node_name} (conf: {results[0].confidence:.3f})")

        return results

    def _compute_causal_scores(self, causal_matrix: np.ndarray) -> np.ndarray:
        """
        Compute causal centrality scores.

        Root causes typically have:
        - High out-degree (affect many other services)
        - Low in-degree (not caused by other failures)
        """
        num_nodes = causal_matrix.shape[0]

        # Compute degrees
        out_degree = causal_matrix.sum(axis=1)  # Row sum = outgoing edges
        in_degree = causal_matrix.sum(axis=0)   # Column sum = incoming edges

        # Root cause score: high out, low in
        # Use ratio: out / (in + 1) to avoid division by zero
        causal_score = out_degree / (in_degree + 1)

        # Also consider PageRank-style influence
        G = nx.DiGraph()
        for i in range(num_nodes):
            G.add_node(i)
        for i in range(num_nodes):
            for j in range(num_nodes):
                if i != j and causal_matrix[i, j] > 0:
                    G.add_edge(i, j, weight=causal_matrix[i, j])

        if G.number_of_edges() > 0:
            try:
                pagerank = nx.pagerank(G, weight='weight')
                pr_scores = np.array([pagerank.get(i, 0) for i in range(num_nodes)])
            except nx.PowerIterationFailedConvergence:
                pr_scores = np.zeros(num_nodes)
        else:
            pr_scores = np.zeros(num_nodes)

        # Combine: causal ratio + inverse pagerank
        # (root causes influence others but aren't influenced)
        combined = causal_score + (1 - pr_scores)

        # Normalize to [0, 1]
        if combined.max() > 0:
            combined = (combined - combined.min()) / (combined.max() - combined.min() + 1e-8)

        return combined

    def _compute_cascade_scores(
        self,
        hypergraph: Optional[Hypergraph],
        num_nodes: int
    ) -> np.ndarray:
        """
        Compute cascade impact scores from hypergraph.

        Nodes that are sources of large cascades get higher scores.
        """
        if hypergraph is None:
            return np.zeros(num_nodes)

        scores = np.zeros(num_nodes)

        for node in range(num_nodes):
            if node not in hypergraph.nodes:
                continue

            source_edges = hypergraph.get_source_hyperedges(node)

            if source_edges:
                # Score based on cascade size and weight
                for edge in source_edges:
                    cascade_size = len(edge.nodes)
                    scores[node] += cascade_size * edge.weight

        # Normalize to [0, 1]
        if scores.max() > 0:
            scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-8)

        return scores

    def _gather_node_details(
        self,
        node_idx: int,
        causal_matrix: np.ndarray,
        hypergraph: Optional[Hypergraph],
        node_names: List[str]
    ) -> Dict[str, Any]:
        """
        Gather detailed information about a node for explanation.
        """
        details = {}

        # Causal graph details
        out_edges = np.where(causal_matrix[node_idx] > 0.1)[0]
        in_edges = np.where(causal_matrix[:, node_idx] > 0.1)[0]

        details["affects"] = [
            {"name": node_names[i], "strength": float(causal_matrix[node_idx, i])}
            for i in out_edges
        ]
        details["affected_by"] = [
            {"name": node_names[i], "strength": float(causal_matrix[i, node_idx])}
            for i in in_edges
        ]

        # Hypergraph details
        if hypergraph and node_idx in hypergraph.nodes:
            source_cascades = hypergraph.get_source_hyperedges(node_idx)
            details["cascades"] = [
                {
                    "id": edge.id,
                    "path": [node_names[n] for n in edge.path],
                    "size": len(edge.nodes),
                    "weight": float(edge.weight)  # Convert numpy to Python float
                }
                for edge in source_cascades[:5]  # Limit to top 5
            ]
            details["total_cascade_impact"] = int(sum(
                len(e.nodes) for e in source_cascades
            ))
        else:
            details["cascades"] = []
            details["total_cascade_impact"] = 0

        return details


class AnomalyDetector:
    """
    Simple anomaly detection for metrics time series.

    Uses statistical methods to identify anomalous time periods
    and metrics.
    """

    def __init__(self, threshold_sigma: float = 3.0):
        """
        Initialize anomaly detector.

        Args:
            threshold_sigma: Number of standard deviations for anomaly threshold
        """
        self.threshold_sigma = threshold_sigma

    def detect(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detect anomalies in time series data.

        Args:
            data: Time series data of shape (time_steps, num_metrics)

        Returns:
            anomaly_mask: Boolean mask of shape (time_steps, num_metrics)
            anomaly_scores: Per-metric anomaly scores of shape (num_metrics,)
        """
        # Compute statistics
        mean = np.mean(data, axis=0)
        std = np.std(data, axis=0) + 1e-8

        # Z-score
        z_scores = np.abs((data - mean) / std)

        # Anomaly mask
        anomaly_mask = z_scores > self.threshold_sigma

        # Per-metric anomaly score: fraction of anomalous time points
        anomaly_scores = anomaly_mask.mean(axis=0)

        # Also consider magnitude of deviations
        max_deviation = z_scores.max(axis=0) / self.threshold_sigma
        max_deviation = np.clip(max_deviation, 0, 1)

        # Combined score
        combined_scores = 0.5 * anomaly_scores + 0.5 * max_deviation

        return anomaly_mask, combined_scores

    def detect_anomalous_window(
        self,
        data: np.ndarray,
        window_size: int = 10
    ) -> Tuple[int, int]:
        """
        Find the most anomalous time window.

        Args:
            data: Time series data
            window_size: Size of sliding window

        Returns:
            start_idx, end_idx of the most anomalous window
        """
        time_steps = data.shape[0]

        if time_steps <= window_size:
            return 0, time_steps

        # Compute overall deviation for each window
        window_scores = []
        for i in range(time_steps - window_size + 1):
            window = data[i:i + window_size]
            _, scores = self.detect(window)
            window_scores.append(scores.mean())

        # Find most anomalous window
        best_idx = np.argmax(window_scores)

        return best_idx, best_idx + window_size
