"""
INGD Training Script for Kaggle

This script trains the Neural Granger models on benchmark datasets.
Designed to run on Kaggle with T4x2 GPUs.

Usage on Kaggle:
1. Upload this script and the ingd module to Kaggle
2. Add Train-Ticket or GAIA dataset
3. Run with GPU accelerator enabled

Output:
- Trained model weights saved to /kaggle/working/weights/
- Training logs and metrics
- Evaluation results on test cases
"""

import os
import sys
import json
import torch
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from tqdm import tqdm
import matplotlib.pyplot as plt

# Kaggle paths
KAGGLE_INPUT = Path("/kaggle/input")
KAGGLE_OUTPUT = Path("/kaggle/working")
WEIGHTS_DIR = KAGGLE_OUTPUT / "weights"
LOGS_DIR = KAGGLE_OUTPUT / "logs"

# Create directories
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Check for GPU
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")
if DEVICE == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")


@dataclass
class TrainingConfig:
    """Configuration for INGD training."""
    # Model architecture
    hidden_dim: int = 64
    num_layers: int = 2
    dropout: float = 0.1
    max_lag: int = 5

    # Training hyperparameters
    learning_rate: float = 0.001
    lambda_sparse: float = 0.01
    batch_size: int = 32
    num_epochs: int = 100
    early_stopping_patience: int = 10

    # Hierarchical settings
    max_subset_size: int = 50
    min_subset_size: int = 10
    merge_threshold: float = 0.3

    # Evaluation
    top_k: int = 5

    def save(self, path: Path):
        with open(path, 'w') as f:
            json.dump(asdict(self), f, indent=2)

    @classmethod
    def load(cls, path: Path) -> 'TrainingConfig':
        with open(path) as f:
            return cls(**json.load(f))


class MLPGranger(torch.nn.Module):
    """MLP-based Neural Granger model (same as backend)."""

    def __init__(
        self,
        num_series: int,
        max_lag: int = 5,
        hidden_dim: int = 64,
        num_layers: int = 2,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.num_series = num_series
        self.max_lag = max_lag
        self.hidden_dim = hidden_dim

        input_dim = num_series * max_lag

        self.input_layer = torch.nn.Linear(input_dim, hidden_dim)

        layers = []
        for _ in range(num_layers - 1):
            layers.extend([
                torch.nn.Linear(hidden_dim, hidden_dim),
                torch.nn.ReLU(),
                torch.nn.Dropout(dropout)
            ])
        self.hidden_layers = torch.nn.Sequential(*layers) if layers else torch.nn.Identity()

        self.output_layer = torch.nn.Linear(hidden_dim, num_series)
        self._init_weights()

    def _init_weights(self):
        for module in self.modules():
            if isinstance(module, torch.nn.Linear):
                torch.nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    torch.nn.init.zeros_(module.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = torch.nn.functional.relu(self.input_layer(x))
        h = self.hidden_layers(h)
        return self.output_layer(h)

    def get_causal_weights(self) -> torch.Tensor:
        weights = self.input_layer.weight.data
        weights = weights.view(self.hidden_dim, self.num_series, self.max_lag)
        output_weights = self.output_layer.weight.data

        causal_matrix = torch.zeros(self.num_series, self.num_series)

        for target_idx in range(self.num_series):
            target_output_weights = output_weights[target_idx]
            for source_idx in range(self.num_series):
                source_input_weights = weights[:, source_idx, :]
                weighted_contribution = torch.abs(target_output_weights).unsqueeze(1) * torch.abs(source_input_weights)
                causal_matrix[target_idx, source_idx] = weighted_contribution.sum()

        if causal_matrix.max() > 0:
            causal_matrix = causal_matrix / causal_matrix.max()

        return causal_matrix

    def group_lasso_penalty(self) -> torch.Tensor:
        weights = self.input_layer.weight
        weights = weights.view(self.hidden_dim, self.num_series, self.max_lag)
        group_norms = torch.sqrt((weights ** 2).sum(dim=(0, 2)) + 1e-8)
        return group_norms.sum()


def create_lagged_features(data: np.ndarray, max_lag: int) -> Tuple[np.ndarray, np.ndarray]:
    """Create lagged feature matrix for training."""
    time_steps, num_series = data.shape
    X_list = []
    for lag in range(1, max_lag + 1):
        X_list.append(data[max_lag - lag:-lag])
    X = np.concatenate(X_list, axis=1)
    y = data[max_lag:]
    return X, y


def load_train_ticket_case(case_path: Path) -> Tuple[np.ndarray, List[str], Optional[str]]:
    """Load a Train-Ticket benchmark case."""
    # Try different file naming conventions
    metrics_file = None
    for name in ["metrics.csv", "kpi.csv", "data.csv"]:
        if (case_path / name).exists():
            metrics_file = case_path / name
            break

    if metrics_file is None:
        # Check if case_path is a file itself
        if case_path.suffix == '.csv':
            metrics_file = case_path

    if metrics_file is None:
        raise FileNotFoundError(f"No metrics file found in {case_path}")

    df = pd.read_csv(metrics_file)

    # Remove timestamp column if present
    for col in ['timestamp', 'time', 'Timestamp', 'Time']:
        if col in df.columns:
            df = df.drop(columns=[col])

    # Keep only numeric columns
    df = df.select_dtypes(include=[np.number])

    metrics = df.values.astype(np.float32)
    metric_names = df.columns.tolist()

    # Load ground truth if available
    ground_truth = None
    for gt_file in ["metadata.json", "ground_truth.json", "info.json"]:
        gt_path = case_path / gt_file if case_path.is_dir() else case_path.parent / gt_file
        if gt_path.exists():
            with open(gt_path) as f:
                gt_data = json.load(f)
            ground_truth = gt_data.get("root_cause") or gt_data.get("ground_truth")
            break

    return metrics, metric_names, ground_truth


def preprocess_data(data: np.ndarray) -> np.ndarray:
    """Preprocess metrics data."""
    # Handle missing values
    data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    # Normalize
    mean = np.mean(data, axis=0)
    std = np.std(data, axis=0) + 1e-8
    data = (data - mean) / std

    # Clip outliers
    data = np.clip(data, -5, 5)

    return data


class INGDTrainer:
    """Trainer for INGD models."""

    def __init__(self, config: TrainingConfig, device: str = DEVICE):
        self.config = config
        self.device = device
        self.models: Dict[str, MLPGranger] = {}
        self.training_history: Dict[str, List[float]] = {}

    def train_on_case(
        self,
        data: np.ndarray,
        metric_names: List[str],
        case_id: str,
        verbose: bool = True
    ) -> Dict:
        """Train Neural Granger model on a single case."""
        num_metrics = data.shape[1]

        if verbose:
            print(f"\nTraining on case {case_id}: {data.shape[0]} timesteps, {num_metrics} metrics")

        # Preprocess
        data = preprocess_data(data)

        # Create lagged features
        X, y = create_lagged_features(data, self.config.max_lag)

        # Convert to tensors
        X_tensor = torch.FloatTensor(X).to(self.device)
        y_tensor = torch.FloatTensor(y).to(self.device)

        # Create model
        model = MLPGranger(
            num_series=num_metrics,
            max_lag=self.config.max_lag,
            hidden_dim=self.config.hidden_dim,
            num_layers=self.config.num_layers,
            dropout=self.config.dropout
        ).to(self.device)

        optimizer = torch.optim.Adam(model.parameters(), lr=self.config.learning_rate)
        criterion = torch.nn.MSELoss()

        # Training loop
        history = {"loss": [], "recon_loss": [], "sparse_loss": []}
        best_loss = float('inf')
        patience_counter = 0

        dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
        dataloader = torch.utils.data.DataLoader(
            dataset, batch_size=self.config.batch_size, shuffle=True
        )

        epoch_iter = tqdm(range(self.config.num_epochs), desc=f"Training {case_id}") if verbose else range(self.config.num_epochs)

        for epoch in epoch_iter:
            model.train()
            epoch_loss = 0
            epoch_recon = 0
            epoch_sparse = 0

            for batch_X, batch_y in dataloader:
                optimizer.zero_grad()

                predictions = model(batch_X)
                recon_loss = criterion(predictions, batch_y)
                sparse_loss = self.config.lambda_sparse * model.group_lasso_penalty()
                loss = recon_loss + sparse_loss

                loss.backward()
                optimizer.step()

                epoch_loss += loss.item()
                epoch_recon += recon_loss.item()
                epoch_sparse += sparse_loss.item()

            n_batches = len(dataloader)
            history["loss"].append(epoch_loss / n_batches)
            history["recon_loss"].append(epoch_recon / n_batches)
            history["sparse_loss"].append(epoch_sparse / n_batches)

            # Early stopping
            if history["loss"][-1] < best_loss:
                best_loss = history["loss"][-1]
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= self.config.early_stopping_patience:
                    if verbose:
                        print(f"Early stopping at epoch {epoch}")
                    break

            if verbose:
                epoch_iter.set_postfix({"loss": f"{history['loss'][-1]:.4f}"})

        # Store model
        self.models[case_id] = model
        self.training_history[case_id] = history

        # Extract causal matrix
        model.eval()
        with torch.no_grad():
            causal_matrix = model.get_causal_weights().cpu().numpy()

        return {
            "case_id": case_id,
            "num_metrics": num_metrics,
            "final_loss": history["loss"][-1],
            "epochs_trained": len(history["loss"]),
            "causal_matrix": causal_matrix,
            "metric_names": metric_names
        }

    def save_model(self, case_id: str, path: Optional[Path] = None):
        """Save trained model weights."""
        if case_id not in self.models:
            raise ValueError(f"No model found for case {case_id}")

        model = self.models[case_id]

        if path is None:
            path = WEIGHTS_DIR / f"neural_granger_{case_id}.pt"

        torch.save({
            "model_state_dict": model.state_dict(),
            "num_series": model.num_series,
            "max_lag": model.max_lag,
            "hidden_dim": model.hidden_dim,
            "config": asdict(self.config),
            "history": self.training_history.get(case_id, {})
        }, path)

        print(f"Model saved to {path}")

    def save_all_models(self):
        """Save all trained models."""
        for case_id in self.models:
            self.save_model(case_id)

        # Also save a combined manifest
        manifest = {
            "timestamp": datetime.now().isoformat(),
            "device": self.device,
            "config": asdict(self.config),
            "models": list(self.models.keys())
        }

        with open(WEIGHTS_DIR / "manifest.json", 'w') as f:
            json.dump(manifest, f, indent=2)

        print(f"Saved {len(self.models)} models to {WEIGHTS_DIR}")


def evaluate_root_cause(
    causal_matrix: np.ndarray,
    metric_names: List[str],
    ground_truth: str,
    top_k: int = 5
) -> Dict:
    """Evaluate root cause detection accuracy."""
    # Compute root cause scores
    out_degree = causal_matrix.sum(axis=1)
    in_degree = causal_matrix.sum(axis=0)
    scores = out_degree / (in_degree + 1)

    # Rank metrics
    ranked_indices = np.argsort(-scores)
    ranked_names = [metric_names[i] for i in ranked_indices]

    # Check if ground truth is in top-k
    gt_lower = ground_truth.lower()

    results = {
        "ground_truth": ground_truth,
        "top_k_predictions": ranked_names[:top_k],
        "top_k_scores": [float(scores[ranked_indices[i]]) for i in range(top_k)],
        "hit_at_1": False,
        "hit_at_3": False,
        "hit_at_5": False,
        "rank": -1
    }

    for rank, name in enumerate(ranked_names):
        if gt_lower in name.lower() or name.lower() in gt_lower:
            results["rank"] = rank + 1
            if rank < 1:
                results["hit_at_1"] = True
            if rank < 3:
                results["hit_at_3"] = True
            if rank < 5:
                results["hit_at_5"] = True
            break

    return results


def plot_training_history(history: Dict[str, List[float]], case_id: str, save_path: Optional[Path] = None):
    """Plot training loss curves."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))

    axes[0].plot(history["loss"])
    axes[0].set_title("Total Loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")

    axes[1].plot(history["recon_loss"])
    axes[1].set_title("Reconstruction Loss")
    axes[1].set_xlabel("Epoch")

    axes[2].plot(history["sparse_loss"])
    axes[2].set_title("Sparsity Loss")
    axes[2].set_xlabel("Epoch")

    plt.suptitle(f"Training History: {case_id}")
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')

    plt.show()


def main():
    """Main training function."""
    print("=" * 60)
    print("INGD Training Script")
    print("=" * 60)

    # Initialize config
    config = TrainingConfig()
    config.save(WEIGHTS_DIR / "config.json")

    # Initialize trainer
    trainer = INGDTrainer(config)

    # Find datasets
    # Look for Train-Ticket or similar datasets in Kaggle input
    dataset_paths = []

    for dataset_dir in KAGGLE_INPUT.iterdir():
        print(f"Found dataset: {dataset_dir.name}")

        # Check for case directories or CSV files
        for item in dataset_dir.iterdir():
            if item.is_dir() or item.suffix == '.csv':
                dataset_paths.append(item)

    if not dataset_paths:
        print("\nNo datasets found. Creating synthetic data for demonstration...")

        # Generate synthetic data
        np.random.seed(42)
        num_services = 10
        num_timesteps = 200
        fault_service = 2

        # Create service names
        service_names = [f"ts-service-{i}" for i in range(num_services)]
        service_names[fault_service] = "ts-order-service"

        # Generate base metrics
        base_latency = np.random.uniform(10, 50, num_services)
        metrics = np.zeros((num_timesteps, num_services))

        for t in range(num_timesteps):
            metrics[t] = base_latency + np.random.randn(num_services) * 5

        # Inject fault at t=100
        fault_start = 100
        for t in range(fault_start, num_timesteps):
            metrics[t, fault_service] *= (1 + 2 * np.random.rand())
            # Cascade to dependent services
            for dep in [(fault_service + i) % num_services for i in range(1, 4)]:
                if t >= fault_start + 5:
                    metrics[t, dep] *= (1 + np.random.rand())

        # Train on synthetic data
        result = trainer.train_on_case(
            metrics,
            service_names,
            case_id="synthetic_demo"
        )

        # Evaluate
        eval_result = evaluate_root_cause(
            result["causal_matrix"],
            service_names,
            "ts-order-service",
            top_k=5
        )

        print("\nEvaluation Results:")
        print(f"  Ground Truth: {eval_result['ground_truth']}")
        print(f"  Top 5 Predictions: {eval_result['top_k_predictions']}")
        print(f"  Hit@1: {eval_result['hit_at_1']}")
        print(f"  Hit@3: {eval_result['hit_at_3']}")
        print(f"  Hit@5: {eval_result['hit_at_5']}")
        print(f"  Rank: {eval_result['rank']}")

        # Plot
        plot_training_history(
            trainer.training_history["synthetic_demo"],
            "synthetic_demo",
            LOGS_DIR / "training_history_synthetic.png"
        )

    else:
        # Train on found datasets
        all_results = []

        for case_path in tqdm(dataset_paths, desc="Processing cases"):
            try:
                metrics, metric_names, ground_truth = load_train_ticket_case(case_path)
                case_id = case_path.stem if case_path.is_file() else case_path.name

                result = trainer.train_on_case(
                    metrics,
                    metric_names,
                    case_id=case_id
                )

                if ground_truth:
                    eval_result = evaluate_root_cause(
                        result["causal_matrix"],
                        metric_names,
                        ground_truth
                    )
                    result["evaluation"] = eval_result

                all_results.append(result)

            except Exception as e:
                print(f"Error processing {case_path}: {e}")
                continue

        # Save results summary
        summary = {
            "num_cases": len(all_results),
            "config": asdict(config),
            "cases": [
                {
                    "case_id": r["case_id"],
                    "num_metrics": r["num_metrics"],
                    "final_loss": r["final_loss"],
                    "evaluation": r.get("evaluation", {})
                }
                for r in all_results
            ]
        }

        with open(LOGS_DIR / "training_summary.json", 'w') as f:
            json.dump(summary, f, indent=2)

        # Compute aggregate metrics
        if any(r.get("evaluation") for r in all_results):
            hit_at_1 = sum(1 for r in all_results if r.get("evaluation", {}).get("hit_at_1", False))
            hit_at_3 = sum(1 for r in all_results if r.get("evaluation", {}).get("hit_at_3", False))
            hit_at_5 = sum(1 for r in all_results if r.get("evaluation", {}).get("hit_at_5", False))
            total = len([r for r in all_results if r.get("evaluation")])

            print("\n" + "=" * 60)
            print("Aggregate Evaluation Results")
            print("=" * 60)
            print(f"Total cases with ground truth: {total}")
            print(f"Hit@1: {hit_at_1}/{total} = {hit_at_1/total*100:.1f}%")
            print(f"Hit@3: {hit_at_3}/{total} = {hit_at_3/total*100:.1f}%")
            print(f"Hit@5: {hit_at_5}/{total} = {hit_at_5/total*100:.1f}%")

    # Save all models
    trainer.save_all_models()

    print("\n" + "=" * 60)
    print("Training Complete!")
    print(f"Models saved to: {WEIGHTS_DIR}")
    print(f"Logs saved to: {LOGS_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
