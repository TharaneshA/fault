# INGD Training on Kaggle

This folder contains scripts for training INGD (Neural Granger) models on Kaggle with GPU acceleration.

## Files

- `train_ingd.py` - Main training script (can run standalone)
- `INGD_Training_Kaggle.ipynb` - Jupyter notebook for interactive training
- `export_for_app.py` - Export trained weights to app format
- `requirements.txt` - Python dependencies

## Quick Start on Kaggle

### Option 1: Using the Notebook

1. Go to [Kaggle](https://www.kaggle.com/) and create a new notebook
2. Upload `INGD_Training_Kaggle.ipynb`
3. Enable GPU: Settings → Accelerator → GPU T4 x2
4. (Optional) Add a dataset like Train-Ticket or GAIA
5. Run all cells
6. Download the `weights/` folder from output

### Option 2: Using the Script

1. Create a new Kaggle notebook
2. Upload `train_ingd.py`
3. Run:
   ```python
   !python train_ingd.py
   ```
4. Download weights from `/kaggle/working/weights/`

## Adding Datasets

For real benchmark evaluation, add one of these datasets to your Kaggle notebook:

### Train-Ticket Benchmark
- Search for "train-ticket benchmark" or "microservice-benchmark" on Kaggle
- Contains failure cases with ground truth labels

### GAIA Dataset
- Multi-modal AIOps dataset
- Contains metrics, logs, and traces

### Custom Data
The training script also works with custom CSV files:
- Format: rows = time steps, columns = metrics
- Optional: Add `metadata.json` with `{"root_cause": "service_name"}`

## Exporting to App

After training on Kaggle:

1. Download the `weights/` folder from Kaggle output
2. Run the export script:
   ```bash
   python export_for_app.py --kaggle-dir ./downloaded_weights --app-dir ../backend/weights
   ```

Or manually copy `.pt` files to `backend/weights/`.

## Training Configuration

Modify `TrainingConfig` in the scripts to adjust:

```python
@dataclass
class TrainingConfig:
    hidden_dim: int = 64       # Hidden layer size
    num_layers: int = 2        # Number of hidden layers
    dropout: float = 0.1       # Dropout rate
    max_lag: int = 5           # Time lag for Granger causality
    learning_rate: float = 0.001
    lambda_sparse: float = 0.01  # Sparsity penalty weight
    batch_size: int = 32
    num_epochs: int = 100
    early_stopping_patience: int = 10
```

## Expected Output

After training, you'll have:

```
weights/
├── neural_granger_case1.pt    # Model weights for each case
├── neural_granger_case2.pt
├── config.json                # Training configuration
└── manifest.json              # List of trained models
```

## Evaluation Metrics

The scripts evaluate:
- **Hit@1**: Root cause in top 1 prediction
- **Hit@3**: Root cause in top 3 predictions
- **Hit@5**: Root cause in top 5 predictions
- **Rank**: Position of true root cause in ranking

## GPU Memory Usage

With T4x2 (2x16GB):
- ~50 metrics: ~2GB per model
- ~100 metrics: ~4GB per model
- ~200 metrics: ~8GB per model (use hierarchical splitting)

The training automatically handles large systems by splitting into subsets.
