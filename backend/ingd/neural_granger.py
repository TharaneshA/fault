"""
Neural Granger Causality Training and Inference.

This module handles training the MLP Granger model and extracting
causal structure from learned weights.
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import numpy as np
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from loguru import logger
from tqdm import tqdm

from .models.mlp_granger import MLPGranger, create_lagged_features, GrangerDataset
from config import NeuralGrangerConfig, WEIGHTS_DIR


class NeuralGrangerTrainer:
    """
    Trainer for Neural Granger Causality model.

    Handles model initialization, training loop, and causal structure extraction.
    """

    def __init__(
        self,
        num_series: int,
        config: Optional[NeuralGrangerConfig] = None,
        device: str = "cpu"
    ):
        """
        Initialize the trainer.

        Args:
            num_series: Number of time series (metrics/services)
            config: Configuration object
            device: Device for computation ('cpu' or 'cuda')
        """
        self.config = config or NeuralGrangerConfig()
        self.device = torch.device(device)
        self.num_series = num_series

        # Initialize model
        self.model = MLPGranger(
            num_series=num_series,
            max_lag=self.config.max_lag,
            hidden_dim=self.config.hidden_dim,
            num_layers=self.config.num_layers,
            dropout=self.config.dropout,
        ).to(self.device)

        # Initialize optimizer
        self.optimizer = optim.Adam(
            self.model.parameters(),
            lr=self.config.learning_rate
        )

        # Loss function
        self.criterion = nn.MSELoss()

        # Training history
        self.history: Dict[str, List[float]] = {
            "loss": [],
            "reconstruction_loss": [],
            "sparsity_loss": []
        }

    def train(
        self,
        data: np.ndarray,
        num_epochs: Optional[int] = None,
        verbose: bool = True
    ) -> Dict[str, List[float]]:
        """
        Train the Neural Granger model.

        Args:
            data: Time series data of shape (time_steps, num_series)
            num_epochs: Number of training epochs (uses config if not specified)
            verbose: Whether to show progress bar

        Returns:
            Training history dictionary
        """
        num_epochs = num_epochs or self.config.num_epochs

        # Create lagged features
        X, y = create_lagged_features(data, self.config.max_lag)

        # Create dataset and dataloader
        dataset = GrangerDataset(X, y)
        dataloader = DataLoader(
            dataset,
            batch_size=self.config.batch_size,
            shuffle=True
        )

        # Training loop
        self.model.train()
        epoch_iter = tqdm(range(num_epochs), desc="Training") if verbose else range(num_epochs)

        for epoch in epoch_iter:
            epoch_loss = 0.0
            epoch_recon_loss = 0.0
            epoch_sparse_loss = 0.0

            for batch_X, batch_y in dataloader:
                batch_X = batch_X.to(self.device)
                batch_y = batch_y.to(self.device)

                # Forward pass
                self.optimizer.zero_grad()
                predictions = self.model(batch_X)

                # Reconstruction loss
                recon_loss = self.criterion(predictions, batch_y)

                # Sparsity penalty (group-lasso)
                sparse_loss = self.config.lambda_sparse * self.model.group_lasso_penalty()

                # Total loss
                loss = recon_loss + sparse_loss

                # Backward pass
                loss.backward()
                self.optimizer.step()

                epoch_loss += loss.item()
                epoch_recon_loss += recon_loss.item()
                epoch_sparse_loss += sparse_loss.item()

            # Record history
            num_batches = len(dataloader)
            self.history["loss"].append(epoch_loss / num_batches)
            self.history["reconstruction_loss"].append(epoch_recon_loss / num_batches)
            self.history["sparsity_loss"].append(epoch_sparse_loss / num_batches)

            if verbose:
                epoch_iter.set_postfix({
                    "loss": f"{epoch_loss / num_batches:.4f}",
                    "recon": f"{epoch_recon_loss / num_batches:.4f}",
                    "sparse": f"{epoch_sparse_loss / num_batches:.4f}"
                })

        logger.info(f"Training completed. Final loss: {self.history['loss'][-1]:.4f}")
        return self.history

    def get_causal_matrix(self, threshold: float = 0.1) -> np.ndarray:
        """
        Extract causal adjacency matrix from trained model.

        Args:
            threshold: Minimum weight to consider as causal edge

        Returns:
            Binary causal matrix of shape (num_series, num_series)
        """
        self.model.eval()
        with torch.no_grad():
            causal_weights = self.model.get_causal_weights().cpu().numpy()

        # Apply threshold
        causal_matrix = (causal_weights > threshold).astype(np.float32)

        # Remove self-loops
        np.fill_diagonal(causal_matrix, 0)

        return causal_matrix

    def get_causal_weights(self) -> np.ndarray:
        """
        Get continuous causal weight matrix.

        Returns:
            Weight matrix of shape (num_series, num_series) with values in [0, 1]
        """
        self.model.eval()
        with torch.no_grad():
            causal_weights = self.model.get_causal_weights().cpu().numpy()

        # Remove self-loops
        np.fill_diagonal(causal_weights, 0)

        return causal_weights

    def save(self, path: Optional[Path] = None):
        """Save model weights to disk."""
        if path is None:
            path = WEIGHTS_DIR / f"neural_granger_{self.num_series}series.pt"

        torch.save({
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "config": self.config.model_dump(),
            "num_series": self.num_series,
            "history": self.history
        }, path)

        logger.info(f"Model saved to {path}")

    def load(self, path: Optional[Path] = None):
        """Load model weights from disk."""
        if path is None:
            path = WEIGHTS_DIR / f"neural_granger_{self.num_series}series.pt"

        checkpoint = torch.load(path, map_location=self.device)

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.history = checkpoint.get("history", self.history)

        logger.info(f"Model loaded from {path}")

    @classmethod
    def from_pretrained(
        cls,
        path: Path,
        device: str = "cpu"
    ) -> "NeuralGrangerTrainer":
        """
        Load a pre-trained model.

        Args:
            path: Path to saved model
            device: Device for computation

        Returns:
            Initialized trainer with loaded weights
        """
        checkpoint = torch.load(path, map_location=device)

        num_series = checkpoint["num_series"]
        config = NeuralGrangerConfig(**checkpoint["config"])

        trainer = cls(num_series=num_series, config=config, device=device)
        trainer.model.load_state_dict(checkpoint["model_state_dict"])
        trainer.history = checkpoint.get("history", trainer.history)

        return trainer
