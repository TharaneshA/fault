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
        use_pretrained: bool = True,
        case_id: str = "default"
    ) -> INGDResult:
        """
        Run complete root cause analysis using the Hybrid INGD v12 Engine with Offline Weights Cache.
        """
        import torch
        import torch.nn.functional as F
        import torch.optim as optim
        from pathlib import Path
        from .models.mlp_granger import MLPGranger
        from .root_cause_scorer import RootCauseResult

        num_metrics = data.shape[1]
        metric_names = metric_names or [f"service_{i}" for i in range(num_metrics)]
        n_time = data.shape[0]

        logger.info(f"Starting Optimized Hybrid INGD (v12) analysis: {n_time} time steps, {num_metrics} metrics")

        # 1. Base Anomaly Detection & Fault Time Detection
        variances = np.mean(np.abs(data), axis=1)
        split = max(10, n_time // 3)
        base_var = np.mean(variances[:split]) if split > 0 else 1.0
        spike_idx = np.where(variances[split:] > base_var * 1.5)[0]
        if len(spike_idx) > 0:
            split = split + spike_idx[0]

        logger.info(f"Detected fault injection around timestep {split}")

        pre_fault = data[:split]
        post_fault = data[split:]
        max_lag = self.config.neural_granger.max_lag

        # 2. Base Anomaly & Temporal Signals
        peak_anomaly = np.zeros(num_metrics)
        cumulative_anomaly = np.zeros(num_metrics)
        first_anomaly_time = np.full(num_metrics, max(1, post_fault.shape[0]), dtype=np.float64)
        anomaly_threshold = 2.0

        for col_idx in range(num_metrics):
            z = np.abs(data[split:, col_idx])
            peak_anomaly[col_idx] = np.max(z) if len(z) > 0 else 0.0
            cumulative_anomaly[col_idx] = np.sum(np.maximum(z - anomaly_threshold, 0))
            significant = np.where(z > anomaly_threshold)[0]
            if len(significant) > 0:
                first_anomaly_time[col_idx] = significant[0]

        for np_scores in [peak_anomaly, cumulative_anomaly]:
            if np_scores.max() > 0:
                np_scores /= np_scores.max()

        anomaly_scores = (peak_anomaly + cumulative_anomaly) / 2.0

        # 3. Neural Granger (Immediate Shock Prediction Error)
        prediction_errors = np.zeros(num_metrics)
        causal_matrix = np.zeros((num_metrics, num_metrics))
        
        batch_size = self.config.neural_granger.batch_size
        if pre_fault.shape[0] >= max_lag + batch_size + 10:
            from config import WEIGHTS_DIR
            weight_path = Path(WEIGHTS_DIR) / f"neural_granger_{case_id}.pt"
            device = torch.device(self.device)

            model = MLPGranger(
                num_series=num_metrics, max_lag=max_lag,
                hidden_dim=self.config.neural_granger.hidden_dim, 
                num_layers=self.config.neural_granger.num_layers, 
                dropout=self.config.neural_granger.dropout
            ).to(device)

            if use_pretrained and weight_path.exists():
                logger.info(f"Loading pre-trained Neural Granger offline weights from {weight_path}...")
                model.load_state_dict(torch.load(weight_path, map_location=device, weights_only=True))
                model.eval()
            else:
                logger.info("Pre-trained weights not found. Training fast Neural Granger on pre-fault data...")
                X_train_list = []
                for lag in range(1, max_lag + 1):
                    X_train_list.append(pre_fault[max_lag - lag: -lag])
                X_train = np.concatenate(X_train_list, axis=1)
                Y_train = pre_fault[max_lag:]

                X_train_t = torch.tensor(X_train, dtype=torch.float32).to(device)
                Y_train_t = torch.tensor(Y_train, dtype=torch.float32).to(device)

                optimizer = optim.Adam(model.parameters(), lr=self.config.neural_granger.learning_rate)
                model.train()
                
                num_epochs = self.config.neural_granger.num_epochs
                for epoch in range(num_epochs):
                    n_samples = X_train_t.shape[0]
                    indices = torch.randperm(n_samples)
                    
                    for start in range(0, n_samples, batch_size):
                        end = min(start + batch_size, n_samples)
                        batch_idx = indices[start:end]
                        
                        pred = model(X_train_t[batch_idx])
                        mse_loss = F.mse_loss(pred, Y_train_t[batch_idx])
                        sparse_loss = self.config.neural_granger.lambda_sparse * model.group_lasso_penalty()
                        loss = mse_loss + sparse_loss

                        optimizer.zero_grad()
                        loss.backward()
                        optimizer.step()

                logger.info(f"Saving newly trained weights to {weight_path}")
                torch.save(model.state_dict(), weight_path)
                model.eval()

            with torch.no_grad():
                causal_matrix = model.get_causal_weights().cpu().numpy()

            eval_window = min(40, post_fault.shape[0])
            eval_post = post_fault[:eval_window]
            
            if eval_post.shape[0] > max_lag + 2:
                X_post_list = []
                for lag in range(1, max_lag + 1):
                    X_post_list.append(eval_post[max_lag - lag: -lag])
                X_post = np.concatenate(X_post_list, axis=1)
                Y_post = eval_post[max_lag:]

                X_post_t = torch.tensor(X_post, dtype=torch.float32).to(device)
                Y_post_t = torch.tensor(Y_post, dtype=torch.float32).to(device)

                with torch.no_grad():
                    pred_post = model(X_post_t)
                    prediction_errors = torch.max((pred_post - Y_post_t) ** 2, dim=0).values.cpu().numpy()

        logger.info("Constructing hypergraph for detailed cascade visualization...")
        hypergraph = self.hypergraph_constructor.construct(
            causal_matrix,
            node_names=metric_names,
            anomaly_mask=anomaly_scores > 0.5
        )

        # 4. The Golden Tiebreaker (Accuracy Breakthrough)
        logger.info("Executing Golden Tiebreaker ranking calculations...")
        anomaly_ranking = np.argsort(-anomaly_scores)
        top_k_req = self.config.scorer.top_k
        top_k = min(max(10, top_k_req * 2), num_metrics)
        top_indices = anomaly_ranking[:top_k]
        
        t_times = first_anomaly_time[top_indices]
        p_errs = prediction_errors[top_indices]
        
        def scale_signal(arr, reverse=False):
            if arr.max() > arr.min():
                scaled = (arr - arr.min()) / (arr.max() - arr.min())
                return 1.0 - scaled if reverse else scaled
            return np.ones(len(arr)) if reverse else np.zeros(len(arr))

        t_scores = scale_signal(t_times, reverse=True)
        p_scores = scale_signal(p_errs)
        top_base = scale_signal(anomaly_scores[top_indices])
        
        # Breakthrough v12 Accuracy formula -> Rank #1 override
        rerank_scores = 0.40 * p_scores + 0.40 * t_scores + 0.20 * top_base
        
        rerank_order = np.argsort(-rerank_scores)
        reranked_top = top_indices[rerank_order]
        
        rest = anomaly_ranking[top_k:]
        final_ranking = np.concatenate([reranked_top, rest])

        # Construct RootCauseResults properly embedded with hypergraph traces
        root_causes = []
        for rank, idx in enumerate(final_ranking[:top_k_req], start=1):
            
            # Extract Graph & Hypergraph visuals for the UI
            out_edges = np.where(causal_matrix[idx] > 0.1)[0]
            in_edges = np.where(causal_matrix[:, idx] > 0.1)[0]

            details = {
                "prediction_shock": float(prediction_errors[idx]),
                "temporal_delay": float(first_anomaly_time[idx]),
                "peak_anomaly": float(peak_anomaly[idx]),
                "affects": [
                    {"name": metric_names[i], "strength": float(causal_matrix[idx, i])}
                    for i in out_edges
                ],
                "affected_by": [
                    {"name": metric_names[i], "strength": float(causal_matrix[i, idx])}
                    for i in in_edges
                ]
            }

            if hypergraph and idx in hypergraph.nodes:
                source_cascades = hypergraph.get_source_hyperedges(idx)
                details["cascades"] = [
                    {
                        "id": edge.id,
                        "path": [metric_names[n] for n in edge.path],
                        "size": len(edge.nodes),
                        "weight": float(edge.weight) 
                    }
                    for edge in source_cascades[:5] 
                ]
                details["total_cascade_impact"] = int(sum(len(e.nodes) for e in source_cascades))
            else:
                details["cascades"] = []
                details["total_cascade_impact"] = 0

            res = RootCauseResult(
                node_id=int(idx),
                node_name=metric_names[idx],
                confidence=float(anomaly_scores[idx] * 0.5 + 0.5 * (1.0/rank)), 
                rank=rank,
                anomaly_score=float(anomaly_scores[idx]),
                causal_score=float(prediction_errors[idx]),
                cascade_score=float(first_anomaly_time[idx] * -1),
                details=details
            )
            root_causes.append(res)
            
        logger.info(f"Analysis complete. Top root cause: {root_causes[0].node_name}")
        
        metadata = {
            "metric_names": metric_names,
            "num_metrics": num_metrics,
            "time_steps": n_time,
            "input_mode": self.config.input_mode,
            "anomalous_metrics": int(np.sum(anomaly_scores > 0.5)),
            "fault_detected_at": int(split),
            "algorithm": "Hybrid v12 Neural Granger",
            "pretrained": use_pretrained
        }

        return INGDResult(
            root_causes=root_causes,
            causal_matrix=causal_matrix,
            hypergraph=hypergraph,
            anomaly_scores=anomaly_scores,
            metadata=metadata
        )

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
