"""
Data Preprocessor for INGD.

Handles data cleaning, normalization, and preparation
for causal discovery.
"""
import numpy as np
from typing import Optional, Tuple
from loguru import logger


class DataPreprocessor:
    """
    Preprocessor for time series metrics data.

    Handles:
    - Missing value imputation
    - Normalization/standardization
    - Outlier handling
    - Windowing for analysis
    """

    def __init__(
        self,
        normalize: bool = True,
        fill_missing: str = "interpolate",
        clip_outliers: bool = True,
        outlier_sigma: float = 5.0
    ):
        """
        Initialize preprocessor.

        Args:
            normalize: Whether to normalize data
            fill_missing: Method for filling missing values
                         ('interpolate', 'mean', 'zero')
            clip_outliers: Whether to clip extreme outliers
            outlier_sigma: Sigma threshold for outlier detection
        """
        self.normalize = normalize
        self.fill_missing = fill_missing
        self.clip_outliers = clip_outliers
        self.outlier_sigma = outlier_sigma

        # Stored statistics for inverse transform
        self.mean_: Optional[np.ndarray] = None
        self.std_: Optional[np.ndarray] = None

    def fit_transform(
        self,
        data: np.ndarray,
        copy: bool = True
    ) -> np.ndarray:
        """
        Fit preprocessor and transform data.

        Args:
            data: Time series data of shape (time_steps, num_metrics)
            copy: Whether to copy input data

        Returns:
            Preprocessed data
        """
        if copy:
            data = data.copy()

        # Handle missing values
        data = self._handle_missing(data)

        # Handle outliers
        if self.clip_outliers:
            data = self._handle_outliers(data)

        # Normalize
        if self.normalize:
            data = self._normalize(data, fit=True)

        return data

    def transform(self, data: np.ndarray, copy: bool = True) -> np.ndarray:
        """
        Transform data using fitted statistics.

        Args:
            data: Time series data
            copy: Whether to copy input data

        Returns:
            Preprocessed data
        """
        if copy:
            data = data.copy()

        data = self._handle_missing(data)

        if self.clip_outliers:
            data = self._handle_outliers(data)

        if self.normalize:
            if self.mean_ is None or self.std_ is None:
                raise ValueError("Preprocessor not fitted. Call fit_transform first.")
            data = self._normalize(data, fit=False)

        return data

    def inverse_transform(self, data: np.ndarray) -> np.ndarray:
        """
        Inverse transform normalized data.

        Args:
            data: Normalized data

        Returns:
            Original scale data
        """
        if self.mean_ is None or self.std_ is None:
            return data

        return data * self.std_ + self.mean_

    def _handle_missing(self, data: np.ndarray) -> np.ndarray:
        """Handle missing values (NaN, Inf)."""
        # Replace inf with nan
        data = np.where(np.isinf(data), np.nan, data)

        # Check for missing values
        if not np.any(np.isnan(data)):
            return data

        num_missing = np.sum(np.isnan(data))
        logger.warning(f"Found {num_missing} missing values, filling with '{self.fill_missing}'")

        if self.fill_missing == "interpolate":
            # Linear interpolation for each column
            for col in range(data.shape[1]):
                mask = np.isnan(data[:, col])
                if np.any(mask) and not np.all(mask):
                    data[:, col] = np.interp(
                        np.arange(len(data)),
                        np.where(~mask)[0],
                        data[~mask, col]
                    )
                elif np.all(mask):
                    data[:, col] = 0

        elif self.fill_missing == "mean":
            col_means = np.nanmean(data, axis=0)
            for col in range(data.shape[1]):
                data[np.isnan(data[:, col]), col] = col_means[col]

        elif self.fill_missing == "zero":
            data = np.nan_to_num(data, nan=0.0)

        return data

    def _handle_outliers(self, data: np.ndarray) -> np.ndarray:
        """Clip extreme outliers."""
        mean = np.mean(data, axis=0)
        std = np.std(data, axis=0) + 1e-8

        lower = mean - self.outlier_sigma * std
        upper = mean + self.outlier_sigma * std

        data = np.clip(data, lower, upper)

        return data

    def _normalize(self, data: np.ndarray, fit: bool = True) -> np.ndarray:
        """Standardize data to zero mean and unit variance."""
        if fit:
            self.mean_ = np.mean(data, axis=0)
            self.std_ = np.std(data, axis=0) + 1e-8

        return (data - self.mean_) / self.std_


def create_sliding_windows(
    data: np.ndarray,
    window_size: int,
    stride: int = 1
) -> np.ndarray:
    """
    Create sliding windows from time series data.

    Args:
        data: Time series data of shape (time_steps, num_metrics)
        window_size: Size of each window
        stride: Step between consecutive windows

    Returns:
        Windows of shape (num_windows, window_size, num_metrics)
    """
    time_steps = data.shape[0]
    num_windows = (time_steps - window_size) // stride + 1

    windows = np.zeros((num_windows, window_size, data.shape[1]))

    for i in range(num_windows):
        start = i * stride
        windows[i] = data[start:start + window_size]

    return windows


def split_normal_anomaly(
    data: np.ndarray,
    fault_start: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Split data into normal and anomaly periods.

    Args:
        data: Time series data
        fault_start: Time step when fault starts

    Returns:
        normal_data, anomaly_data
    """
    return data[:fault_start], data[fault_start:]
