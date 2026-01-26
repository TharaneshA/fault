"""
Data Loader for Benchmark Datasets.

Supports loading and parsing data from:
- Train-Ticket benchmark
- GAIA dataset
- RCAEval benchmark format
"""
import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from loguru import logger

from config import DATA_DIR


@dataclass
class BenchmarkDataset:
    """
    Loaded benchmark dataset.

    Attributes:
        metrics: Time series metrics data (time_steps, num_metrics)
        metric_names: Names of metrics/services
        timestamps: Timestamp for each time step
        ground_truth: Ground truth root cause (if available)
        fault_type: Type of injected fault
        metadata: Additional dataset metadata
    """
    metrics: np.ndarray
    metric_names: List[str]
    timestamps: Optional[np.ndarray] = None
    ground_truth: Optional[str] = None
    fault_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    @property
    def num_metrics(self) -> int:
        return self.metrics.shape[1]

    @property
    def num_timesteps(self) -> int:
        return self.metrics.shape[0]


class DataLoader:
    """
    Loader for RCA benchmark datasets.

    Supports multiple dataset formats commonly used in
    root cause analysis research.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """
        Initialize the data loader.

        Args:
            data_dir: Directory containing datasets
        """
        self.data_dir = Path(data_dir) if data_dir else DATA_DIR

    def load_train_ticket(
        self,
        case_id: str,
        data_path: Optional[Path] = None
    ) -> BenchmarkDataset:
        """
        Load a Train-Ticket benchmark case.

        Train-Ticket format typically includes:
        - metrics.csv: Time series metrics
        - metadata.json: Case information and ground truth

        Args:
            case_id: Identifier for the case (e.g., "case_001")
            data_path: Optional path to data directory

        Returns:
            BenchmarkDataset
        """
        base_path = data_path or self.data_dir / "train_ticket"

        # Try to load metrics CSV
        metrics_file = base_path / case_id / "metrics.csv"
        if not metrics_file.exists():
            # Try alternative naming
            metrics_file = base_path / f"{case_id}_metrics.csv"

        if metrics_file.exists():
            df = pd.read_csv(metrics_file)

            # Extract timestamps if present
            if 'timestamp' in df.columns:
                timestamps = df['timestamp'].values
                df = df.drop(columns=['timestamp'])
            elif 'time' in df.columns:
                timestamps = df['time'].values
                df = df.drop(columns=['time'])
            else:
                timestamps = np.arange(len(df))

            metrics = df.values.astype(np.float32)
            metric_names = df.columns.tolist()
        else:
            raise FileNotFoundError(f"Metrics file not found: {metrics_file}")

        # Try to load metadata
        metadata_file = base_path / case_id / "metadata.json"
        if not metadata_file.exists():
            metadata_file = base_path / f"{case_id}_metadata.json"

        ground_truth = None
        fault_type = None
        metadata = {}

        if metadata_file.exists():
            with open(metadata_file) as f:
                metadata = json.load(f)
            ground_truth = metadata.get("root_cause") or metadata.get("ground_truth")
            fault_type = metadata.get("fault_type") or metadata.get("injection_type")

        return BenchmarkDataset(
            metrics=metrics,
            metric_names=metric_names,
            timestamps=timestamps,
            ground_truth=ground_truth,
            fault_type=fault_type,
            metadata=metadata
        )

    def load_gaia(
        self,
        case_id: str,
        data_path: Optional[Path] = None
    ) -> BenchmarkDataset:
        """
        Load a GAIA dataset case.

        GAIA format includes multi-modal data (metrics, logs, traces).
        This loader focuses on the metrics portion for INGD.

        Args:
            case_id: Case identifier
            data_path: Optional path to GAIA data

        Returns:
            BenchmarkDataset
        """
        base_path = data_path or self.data_dir / "gaia"

        # GAIA typically has KPI metrics
        metrics_file = base_path / case_id / "kpi.csv"
        if not metrics_file.exists():
            metrics_file = base_path / f"{case_id}" / "metric.csv"

        if metrics_file.exists():
            df = pd.read_csv(metrics_file)

            # Handle GAIA timestamp format
            if 'timestamp' in df.columns:
                timestamps = pd.to_datetime(df['timestamp']).values
                df = df.drop(columns=['timestamp'])
            else:
                timestamps = np.arange(len(df))

            metrics = df.values.astype(np.float32)
            metric_names = df.columns.tolist()
        else:
            raise FileNotFoundError(f"GAIA metrics file not found: {metrics_file}")

        # Load ground truth
        gt_file = base_path / case_id / "ground_truth.json"
        ground_truth = None
        fault_type = None
        metadata = {}

        if gt_file.exists():
            with open(gt_file) as f:
                gt_data = json.load(f)
            ground_truth = gt_data.get("root_cause")
            fault_type = gt_data.get("fault_type")
            metadata = gt_data

        return BenchmarkDataset(
            metrics=metrics,
            metric_names=metric_names,
            timestamps=timestamps,
            ground_truth=ground_truth,
            fault_type=fault_type,
            metadata=metadata
        )

    def load_rcaeval(
        self,
        case_id: str,
        data_path: Optional[Path] = None
    ) -> BenchmarkDataset:
        """
        Load an RCAEval benchmark case.

        RCAEval is a standardized benchmark for evaluating RCA methods.

        Args:
            case_id: Case identifier (e.g., "RE2-047")
            data_path: Optional path to RCAEval data

        Returns:
            BenchmarkDataset
        """
        base_path = data_path or self.data_dir / "rcaeval"

        # RCAEval format
        case_dir = base_path / case_id
        metrics_file = case_dir / "metrics.csv"

        if metrics_file.exists():
            df = pd.read_csv(metrics_file, index_col=0)
            timestamps = df.index.values
            metrics = df.values.astype(np.float32)
            metric_names = df.columns.tolist()
        else:
            raise FileNotFoundError(f"RCAEval case not found: {case_id}")

        # Load case info
        info_file = case_dir / "info.json"
        ground_truth = None
        fault_type = None
        metadata = {}

        if info_file.exists():
            with open(info_file) as f:
                metadata = json.load(f)
            ground_truth = metadata.get("root_cause")
            fault_type = metadata.get("fault_type")

        return BenchmarkDataset(
            metrics=metrics,
            metric_names=metric_names,
            timestamps=timestamps,
            ground_truth=ground_truth,
            fault_type=fault_type,
            metadata=metadata
        )

    def load_csv(
        self,
        file_path: Path,
        timestamp_col: Optional[str] = None
    ) -> BenchmarkDataset:
        """
        Load a generic CSV file.

        Args:
            file_path: Path to CSV file
            timestamp_col: Name of timestamp column (optional)

        Returns:
            BenchmarkDataset
        """
        df = pd.read_csv(file_path)

        timestamps = None
        if timestamp_col and timestamp_col in df.columns:
            timestamps = df[timestamp_col].values
            df = df.drop(columns=[timestamp_col])

        # Remove any non-numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df = df[numeric_cols]

        metrics = df.values.astype(np.float32)
        metric_names = df.columns.tolist()

        if timestamps is None:
            timestamps = np.arange(len(df))

        return BenchmarkDataset(
            metrics=metrics,
            metric_names=metric_names,
            timestamps=timestamps
        )

    def list_available_cases(self, dataset: str = "train_ticket") -> List[str]:
        """
        List available cases for a dataset.

        Args:
            dataset: Dataset name ('train_ticket', 'gaia', 'rcaeval')

        Returns:
            List of case identifiers
        """
        dataset_path = self.data_dir / dataset

        if not dataset_path.exists():
            logger.warning(f"Dataset directory not found: {dataset_path}")
            return []

        cases = []
        for item in dataset_path.iterdir():
            if item.is_dir():
                cases.append(item.name)
            elif item.suffix == '.csv':
                cases.append(item.stem)

        return sorted(cases)


def generate_synthetic_data(
    num_services: int = 10,
    num_timesteps: int = 200,
    fault_service: int = 0,
    fault_start: int = 100,
    noise_level: float = 0.1,
    seed: Optional[int] = None
) -> BenchmarkDataset:
    """
    Generate synthetic data for testing.

    Creates a simple causal structure where one service (fault_service)
    causes cascading delays in dependent services.

    Args:
        num_services: Number of services/metrics
        num_timesteps: Number of time steps
        fault_service: Index of the faulty service
        fault_start: Time step when fault starts
        noise_level: Noise level for metrics
        seed: Random seed

    Returns:
        BenchmarkDataset with synthetic data
    """
    if seed is not None:
        np.random.seed(seed)

    # Create service names
    service_names = [f"ts-service-{i}" for i in range(num_services)]
    service_names[fault_service] = f"ts-{['order', 'travel', 'config', 'station', 'route'][fault_service % 5]}-service"

    # Generate base metrics (normal operation)
    base_latency = np.random.uniform(10, 50, num_services)
    metrics = np.zeros((num_timesteps, num_services))

    for t in range(num_timesteps):
        metrics[t] = base_latency + np.random.randn(num_services) * noise_level * base_latency

    # Create causal structure (simple chain)
    # fault_service -> dependent services with increasing delay
    dependents = [(fault_service + i) % num_services for i in range(1, min(5, num_services))]

    # Inject fault
    for t in range(fault_start, num_timesteps):
        # Fault service shows high latency
        metrics[t, fault_service] *= (1 + 2 * np.random.rand())

        # Cascading effect on dependents
        for i, dep in enumerate(dependents):
            delay = (i + 1) * 3  # Increasing delay for downstream services
            if t >= fault_start + delay:
                metrics[t, dep] *= (1 + 1.5 * np.random.rand() / (i + 1))

    return BenchmarkDataset(
        metrics=metrics.astype(np.float32),
        metric_names=service_names,
        timestamps=np.arange(num_timesteps),
        ground_truth=service_names[fault_service],
        fault_type="latency_spike",
        metadata={
            "fault_service": fault_service,
            "fault_start": fault_start,
            "dependents": dependents,
            "synthetic": True
        }
    )
