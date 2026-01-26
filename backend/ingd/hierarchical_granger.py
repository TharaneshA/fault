"""
Hierarchical Divide-and-Conquer Granger Causality.

This module implements a scalable approach to causal discovery by:
1. Splitting large metric sets into manageable subsets
2. Running Neural Granger on each subset
3. Merging results across subsets
4. Refining through hierarchical exploration

Reference: Ikram et al., "Root Cause Analysis of Failures in Microservices
through Causal Discovery", NeurIPS 2022 (RCD algorithm)
"""
import numpy as np
from typing import Dict, List, Optional, Tuple, Set
from concurrent.futures import ThreadPoolExecutor, as_completed
from loguru import logger
import networkx as nx

import torch
from .neural_granger import NeuralGrangerTrainer
from config import HierarchicalConfig, NeuralGrangerConfig, WEIGHTS_DIR


class HierarchicalGranger:
    """
    Hierarchical Divide-and-Conquer Granger Causality Discovery.

    For large-scale systems (200+ metrics), this approach:
    1. Partitions metrics into smaller subsets based on correlation
    2. Runs Neural Granger independently on each subset
    3. Merges causal edges across overlapping subsets
    4. Identifies candidate root causes through intervention-based analysis
    """

    def __init__(
        self,
        config: Optional[HierarchicalConfig] = None,
        granger_config: Optional[NeuralGrangerConfig] = None,
        device: str = "cpu"
    ):
        """
        Initialize the hierarchical Granger discovery.

        Args:
            config: Hierarchical configuration
            granger_config: Neural Granger configuration
            device: Device for computation
        """
        self.config = config or HierarchicalConfig()
        self.granger_config = granger_config or NeuralGrangerConfig()
        self.device = device

        # Store intermediate results
        self.subset_causal_matrices: List[np.ndarray] = []
        self.subset_indices: List[List[int]] = []
        self.global_causal_matrix: Optional[np.ndarray] = None
        self.metric_names: List[str] = []

    def _try_load_pretrained(
        self,
        num_metrics: int
    ) -> Optional[Tuple[np.ndarray, Dict]]:
        """
        Try to load pretrained weights from WEIGHTS_DIR.

        Args:
            num_metrics: Number of metrics in the data

        Returns:
            Tuple of (causal_matrix, metadata) if weights found, None otherwise
        """
        import json
        from pathlib import Path

        weights_path = Path(WEIGHTS_DIR)
        if not weights_path.exists():
            logger.debug(f"Weights directory not found: {weights_path}")
            return None

        # Check config.json for num_series
        config_file = weights_path / "config.json"
        saved_num_series = None
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    config_data = json.load(f)
                    saved_num_series = config_data.get('num_series')
            except Exception:
                pass

        # Look for matching weight files
        # Format: neural_granger_{num_series}series_*.pt
        pattern_files = list(weights_path.glob(f"neural_granger_{num_metrics}series_*.pt"))

        # Also check for generic weights that might work
        if not pattern_files:
            pattern_files = list(weights_path.glob("neural_granger_*.pt"))

        if not pattern_files:
            logger.debug(f"No pretrained weights found for {num_metrics} metrics")
            return None

        # Use the most recent file
        weight_file = max(pattern_files, key=lambda p: p.stat().st_mtime)
        logger.info(f"Loading pretrained weights from: {weight_file}")

        try:
            # Load the checkpoint
            checkpoint = torch.load(weight_file, map_location=self.device, weights_only=False)

            # Check if it's a full checkpoint or just state_dict
            if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
                if saved_num_series is None:
                    saved_num_series = checkpoint.get('num_series')
            else:
                state_dict = checkpoint

            # If still no num_series, try to infer from input_layer weights
            if saved_num_series is None:
                # input_layer has shape (num_series * max_lag, hidden_dim)
                input_weight_key = 'input_layer.weight'
                if input_weight_key in state_dict:
                    input_dim = state_dict[input_weight_key].shape[1]
                    max_lag = self.granger_config.max_lag
                    saved_num_series = input_dim // max_lag
                    logger.debug(f"Inferred num_series={saved_num_series} from weights")

            # Default to num_metrics if we still can't determine
            if saved_num_series is None:
                saved_num_series = num_metrics

            # Verify the model matches our data
            if saved_num_series != num_metrics:
                logger.warning(f"Weight file has {saved_num_series} series, but data has {num_metrics}. "
                             f"Training from scratch instead.")
                return None

            # Create model and load weights
            trainer = NeuralGrangerTrainer(
                num_series=num_metrics,
                config=self.granger_config,
                device=self.device
            )
            trainer.model.load_state_dict(state_dict)
            trainer.model.eval()

            # Extract causal weights
            causal_matrix = trainer.get_causal_weights()
            self.global_causal_matrix = causal_matrix

            metadata = {
                "num_subsets": 1,
                "subset_sizes": [num_metrics],
                "edge_count": int((causal_matrix > self.config.merge_threshold).sum()),
                "density": float((causal_matrix > self.config.merge_threshold).sum()) / (num_metrics * (num_metrics - 1)),
                "pretrained": True,
                "weight_file": str(weight_file.name)
            }

            logger.info(f"Successfully loaded pretrained model with {metadata['edge_count']} edges")
            return causal_matrix, metadata

        except Exception as e:
            logger.warning(f"Failed to load pretrained weights: {e}. Training from scratch.")
            return None

    def discover(
        self,
        data: np.ndarray,
        metric_names: Optional[List[str]] = None,
        anomaly_scores: Optional[np.ndarray] = None,
        use_pretrained: bool = True
    ) -> Tuple[np.ndarray, Dict]:
        """
        Discover causal structure using hierarchical approach.

        Args:
            data: Time series data of shape (time_steps, num_metrics)
            metric_names: Names of metrics (optional)
            anomaly_scores: Pre-computed anomaly scores for each metric (optional)
            use_pretrained: Whether to try loading pretrained weights first

        Returns:
            causal_matrix: Global causal adjacency matrix
            metadata: Dictionary with intermediate results
        """
        num_metrics = data.shape[1]
        self.metric_names = metric_names or [f"metric_{i}" for i in range(num_metrics)]

        logger.info(f"Starting hierarchical causal discovery for {num_metrics} metrics")

        # Try to load pretrained weights first
        if use_pretrained:
            pretrained_result = self._try_load_pretrained(num_metrics)
            if pretrained_result is not None:
                return pretrained_result

        # Check if we need hierarchical approach
        if num_metrics <= self.config.max_subset_size:
            logger.info("No pretrained weights found, training from scratch")
            return self._run_direct_granger(data)

        # Step 1: Partition metrics into subsets
        subsets = self._partition_metrics(data, anomaly_scores)
        logger.info(f"Created {len(subsets)} metric subsets")

        # Step 2: Run Neural Granger on each subset (parallel)
        subset_results = self._process_subsets_parallel(data, subsets)

        # Step 3: Merge results into global causal matrix
        global_matrix = self._merge_causal_matrices(num_metrics, subsets, subset_results)

        # Step 4: Refine through candidate root cause analysis
        refined_matrix, candidates = self._refine_structure(
            data, global_matrix, anomaly_scores
        )

        self.global_causal_matrix = refined_matrix

        metadata = {
            "num_subsets": len(subsets),
            "subset_sizes": [len(s) for s in subsets],
            "candidate_root_causes": candidates,
            "edge_count": int(refined_matrix.sum()),
            "density": float(refined_matrix.sum()) / (num_metrics * (num_metrics - 1))
        }

        return refined_matrix, metadata

    def _partition_metrics(
        self,
        data: np.ndarray,
        anomaly_scores: Optional[np.ndarray] = None
    ) -> List[List[int]]:
        """
        Partition metrics into subsets based on correlation structure.

        Uses correlation-based clustering to create overlapping subsets
        that capture local causal relationships.
        """
        num_metrics = data.shape[1]

        # Compute correlation matrix
        corr_matrix = np.corrcoef(data.T)
        corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)

        # Use spectral clustering-like approach
        # Group highly correlated metrics together
        subsets = []
        remaining = set(range(num_metrics))

        # If we have anomaly scores, prioritize anomalous metrics
        if anomaly_scores is not None:
            # Sort metrics by anomaly score (descending)
            priority_order = np.argsort(-anomaly_scores)
        else:
            # Random order
            priority_order = np.random.permutation(num_metrics)

        while remaining:
            # Pick seed metric (prioritize high anomaly score)
            seed = None
            for m in priority_order:
                if m in remaining:
                    seed = m
                    break

            if seed is None:
                break

            # Find correlated metrics
            correlations = np.abs(corr_matrix[seed])
            correlated_indices = np.where(correlations > 0.3)[0]

            # Filter to remaining metrics
            subset = [i for i in correlated_indices if i in remaining]

            # Ensure minimum subset size
            if len(subset) < self.config.min_subset_size:
                # Add closest metrics
                remaining_list = list(remaining)
                distances = 1 - np.abs(corr_matrix[seed, remaining_list])
                sorted_indices = np.argsort(distances)
                for idx in sorted_indices:
                    if remaining_list[idx] not in subset:
                        subset.append(remaining_list[idx])
                    if len(subset) >= self.config.min_subset_size:
                        break

            # Ensure maximum subset size
            if len(subset) > self.config.max_subset_size:
                # Keep most correlated
                subset_corrs = np.abs(corr_matrix[seed, subset])
                sorted_indices = np.argsort(-subset_corrs)
                subset = [subset[i] for i in sorted_indices[:self.config.max_subset_size]]

            subsets.append(sorted(subset))

            # Remove processed metrics (with some overlap for merging)
            overlap_count = min(5, len(subset) // 4)
            to_remove = set(subset[:-overlap_count]) if overlap_count > 0 else set(subset)
            remaining -= to_remove

        return subsets

    def _run_direct_granger(self, data: np.ndarray) -> Tuple[np.ndarray, Dict]:
        """Run Neural Granger directly without partitioning."""
        num_metrics = data.shape[1]

        trainer = NeuralGrangerTrainer(
            num_series=num_metrics,
            config=self.granger_config,
            device=self.device
        )

        trainer.train(data, verbose=True)

        causal_matrix = trainer.get_causal_weights()
        self.global_causal_matrix = causal_matrix

        metadata = {
            "num_subsets": 1,
            "subset_sizes": [num_metrics],
            "edge_count": int((causal_matrix > self.config.merge_threshold).sum()),
            "density": float((causal_matrix > self.config.merge_threshold).sum()) / (num_metrics * (num_metrics - 1))
        }

        return causal_matrix, metadata

    def _process_subsets_parallel(
        self,
        data: np.ndarray,
        subsets: List[List[int]]
    ) -> List[np.ndarray]:
        """
        Process metric subsets in parallel.

        Returns list of local causal matrices for each subset.
        """
        results = [None] * len(subsets)

        def process_subset(subset_idx: int, subset: List[int]) -> Tuple[int, np.ndarray]:
            subset_data = data[:, subset]

            trainer = NeuralGrangerTrainer(
                num_series=len(subset),
                config=self.granger_config,
                device=self.device
            )

            trainer.train(subset_data, verbose=False)
            local_matrix = trainer.get_causal_weights()

            return subset_idx, local_matrix

        # Use ThreadPoolExecutor for parallel processing
        with ThreadPoolExecutor(max_workers=self.config.num_workers) as executor:
            futures = {
                executor.submit(process_subset, idx, subset): idx
                for idx, subset in enumerate(subsets)
            }

            for future in as_completed(futures):
                subset_idx, local_matrix = future.result()
                results[subset_idx] = local_matrix
                logger.debug(f"Completed subset {subset_idx + 1}/{len(subsets)}")

        self.subset_causal_matrices = results
        self.subset_indices = subsets

        return results

    def _merge_causal_matrices(
        self,
        num_metrics: int,
        subsets: List[List[int]],
        local_matrices: List[np.ndarray]
    ) -> np.ndarray:
        """
        Merge local causal matrices into global matrix.

        Uses weighted averaging for overlapping regions.
        """
        global_matrix = np.zeros((num_metrics, num_metrics))
        count_matrix = np.zeros((num_metrics, num_metrics))

        for subset, local_matrix in zip(subsets, local_matrices):
            for i, global_i in enumerate(subset):
                for j, global_j in enumerate(subset):
                    if i != j:
                        global_matrix[global_i, global_j] += local_matrix[i, j]
                        count_matrix[global_i, global_j] += 1

        # Average where we have multiple estimates
        mask = count_matrix > 0
        global_matrix[mask] = global_matrix[mask] / count_matrix[mask]

        return global_matrix

    def _refine_structure(
        self,
        data: np.ndarray,
        causal_matrix: np.ndarray,
        anomaly_scores: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, List[int]]:
        """
        Refine causal structure using intervention-based analysis.

        Treats failures as interventions on root causes, allowing
        faster detection without learning complete causal graph.
        """
        num_metrics = data.shape[1]

        # Identify candidate root causes based on:
        # 1. High anomaly scores (if available)
        # 2. High out-degree in causal graph
        # 3. Low in-degree in causal graph

        # Compute graph properties
        out_degree = causal_matrix.sum(axis=1)
        in_degree = causal_matrix.sum(axis=0)

        # Root cause score: high out-degree, low in-degree
        # (causes other failures but not caused by others)
        root_score = out_degree - in_degree

        if anomaly_scores is not None:
            # Weight by anomaly scores
            root_score = root_score * anomaly_scores

        # Get top candidates
        num_candidates = min(10, num_metrics // 4)
        candidates = np.argsort(-root_score)[:num_candidates].tolist()

        # Refine edges: focus on causal paths from candidates
        refined_matrix = causal_matrix.copy()

        # Apply threshold
        refined_matrix[refined_matrix < self.config.merge_threshold] = 0

        return refined_matrix, candidates

    def get_causal_graph(self) -> nx.DiGraph:
        """
        Convert causal matrix to NetworkX directed graph.

        Returns:
            NetworkX DiGraph with edge weights
        """
        if self.global_causal_matrix is None:
            raise ValueError("No causal matrix available. Run discover() first.")

        G = nx.DiGraph()

        # Add nodes
        for i, name in enumerate(self.metric_names):
            G.add_node(i, name=name)

        # Add edges with weights
        num_metrics = len(self.metric_names)
        for i in range(num_metrics):
            for j in range(num_metrics):
                if i != j and self.global_causal_matrix[i, j] > self.config.merge_threshold:
                    G.add_edge(i, j, weight=self.global_causal_matrix[i, j])

        return G

    def get_causal_paths(
        self,
        source: int,
        max_length: int = 5
    ) -> List[List[int]]:
        """
        Find all causal paths from a source node.

        Args:
            source: Source node index
            max_length: Maximum path length

        Returns:
            List of paths (each path is a list of node indices)
        """
        G = self.get_causal_graph()

        paths = []
        for target in G.nodes():
            if target != source:
                try:
                    for path in nx.all_simple_paths(G, source, target, cutoff=max_length):
                        paths.append(path)
                except nx.NetworkXNoPath:
                    continue

        return paths
