"""
MLP-based Neural Granger Causality Model.

This implements the core neural network for learning causal structure
from multivariate time series data using group-lasso sparsity.

Reference: Tank et al., "Neural Granger Causality", TPAMI 2021
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Optional
import numpy as np


class MLPGranger(nn.Module):
    """
    MLP-based Neural Granger Causality model.

    For each target time series, learns which other time series
    Granger-cause it by using group-lasso regularization on input weights.

    Args:
        num_series: Number of time series (metrics/services)
        max_lag: Maximum time lag to consider
        hidden_dim: Hidden layer dimension
        num_layers: Number of hidden layers
        dropout: Dropout probability
    """

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
        self.num_layers = num_layers

        # Input dimension: all series * max_lag
        input_dim = num_series * max_lag

        # Build MLP layers
        layers = []

        # First layer (input -> hidden)
        # We keep the first layer weights separate for group-lasso
        self.input_layer = nn.Linear(input_dim, hidden_dim)

        # Hidden layers
        for _ in range(num_layers - 1):
            layers.append(nn.Linear(hidden_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))

        self.hidden_layers = nn.Sequential(*layers) if layers else nn.Identity()

        # Output layer: predict all series
        self.output_layer = nn.Linear(hidden_dim, num_series)

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using Xavier initialization."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (batch_size, num_series * max_lag)
               Contains lagged values for all series concatenated

        Returns:
            Predictions of shape (batch_size, num_series)
        """
        # Input layer
        h = F.relu(self.input_layer(x))

        # Hidden layers
        h = self.hidden_layers(h)

        # Output layer
        out = self.output_layer(h)

        return out

    def get_causal_weights(self) -> torch.Tensor:
        """
        Extract causal structure from input layer weights.

        Uses L2 norm of weight groups to determine causal strength.
        Each group corresponds to one source series affecting predictions.

        Returns:
            Causal weight matrix of shape (num_series, num_series)
            Entry [i, j] represents causal influence from series j to series i
        """
        # Get input layer weights: (hidden_dim, num_series * max_lag)
        weights = self.input_layer.weight.data

        # Reshape to (hidden_dim, num_series, max_lag)
        weights = weights.view(self.hidden_dim, self.num_series, self.max_lag)

        # Compute L2 norm across lag and hidden dimensions
        # This gives us the "strength" of each source series
        # Shape: (num_series,) for each target

        # We need to consider the full path through the network
        # For simplicity, use input layer weights as proxy for causal strength
        # Compute group norm: sqrt(sum of squared weights for each source)
        group_norms = torch.sqrt(
            (weights ** 2).sum(dim=(0, 2))  # Sum over hidden_dim and lag
        )

        # For a more accurate estimate, we should consider output layer too
        # Combine input and output layer information
        output_weights = self.output_layer.weight.data  # (num_series, hidden_dim)

        # Compute contribution of each source to each target
        # This is a simplified approximation
        causal_matrix = torch.zeros(self.num_series, self.num_series)

        for target_idx in range(self.num_series):
            # Output weights for this target: (hidden_dim,)
            target_output_weights = output_weights[target_idx]

            # Weighted combination of input contributions
            for source_idx in range(self.num_series):
                # Input weights from this source: (hidden_dim, max_lag)
                source_input_weights = weights[:, source_idx, :]

                # Compute weighted norm
                weighted_contribution = torch.abs(target_output_weights).unsqueeze(1) * torch.abs(source_input_weights)
                causal_matrix[target_idx, source_idx] = weighted_contribution.sum()

        # Normalize to [0, 1] range
        if causal_matrix.max() > 0:
            causal_matrix = causal_matrix / causal_matrix.max()

        return causal_matrix

    def group_lasso_penalty(self) -> torch.Tensor:
        """
        Compute group-lasso penalty for sparsity.

        Groups weights by source series and penalizes the L2 norm of each group.
        This encourages entire groups to be zero, resulting in sparse causal structure.

        Returns:
            Group-lasso penalty value
        """
        # Get input layer weights: (hidden_dim, num_series * max_lag)
        weights = self.input_layer.weight

        # Reshape to (hidden_dim, num_series, max_lag)
        weights = weights.view(self.hidden_dim, self.num_series, self.max_lag)

        # Compute L2 norm for each source series group
        # Shape: (num_series,)
        group_norms = torch.sqrt(
            (weights ** 2).sum(dim=(0, 2)) + 1e-8  # Sum over hidden_dim and lag
        )

        # Sum of group norms (L1 over groups)
        penalty = group_norms.sum()

        return penalty


def create_lagged_features(
    data: np.ndarray,
    max_lag: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create lagged feature matrix for Granger causality learning.

    Args:
        data: Time series data of shape (time_steps, num_series)
        max_lag: Maximum lag to include

    Returns:
        X: Lagged features of shape (time_steps - max_lag, num_series * max_lag)
        y: Target values of shape (time_steps - max_lag, num_series)
    """
    time_steps, num_series = data.shape

    # Create lagged features
    X_list = []
    for lag in range(1, max_lag + 1):
        X_list.append(data[max_lag - lag:-lag])

    # Concatenate along feature dimension
    X = np.concatenate(X_list, axis=1)

    # Target is current values
    y = data[max_lag:]

    return X, y


class GrangerDataset(torch.utils.data.Dataset):
    """PyTorch Dataset for Granger causality training."""

    def __init__(self, X: np.ndarray, y: np.ndarray):
        self.X = torch.FloatTensor(X)
        self.y = torch.FloatTensor(y)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]
