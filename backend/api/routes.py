"""
FastAPI Routes for INGD Backend.

Provides HTTP endpoints for:
- Root cause analysis
- Dataset management
- Model status
"""
import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import io
import pandas as pd
from loguru import logger

from ingd import INGDPipeline
from ingd.pipeline import INGDResult
from data import DataLoader, DataPreprocessor
from data.loader import generate_synthetic_data, BenchmarkDataset
from config import INGDConfig, DATA_DIR


router = APIRouter(prefix="/api/v1", tags=["ingd"])

# Global pipeline instance (lazy loaded)
_pipeline: Optional[INGDPipeline] = None
_current_result: Optional[INGDResult] = None


def get_pipeline() -> INGDPipeline:
    """Get or create pipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = INGDPipeline()
    return _pipeline


# Request/Response Models

class AnalyzeRequest(BaseModel):
    """Request body for analysis endpoint."""
    dataset: str = Field(description="Dataset name (train_ticket, gaia, rcaeval)")
    case_id: str = Field(description="Case identifier")
    top_k: int = Field(default=5, description="Number of root causes to return")


class AnalyzeMetricsRequest(BaseModel):
    """Request body for direct metrics analysis."""
    metrics: List[List[float]] = Field(description="Metrics data (time_steps x num_metrics)")
    metric_names: Optional[List[str]] = Field(default=None, description="Names of metrics")
    top_k: int = Field(default=5, description="Number of root causes to return")


class RootCauseResponse(BaseModel):
    """Response for a single root cause."""
    node_id: int
    node_name: str
    confidence: float
    rank: int
    anomaly_score: float
    causal_score: float
    cascade_score: float
    details: Dict[str, Any]


class AnalysisResponse(BaseModel):
    """Full analysis response."""
    success: bool
    root_causes: List[RootCauseResponse]
    causal_graph: Dict[str, Any]
    hypergraph: Dict[str, Any]
    metadata: Dict[str, Any]


class DatasetInfo(BaseModel):
    """Information about a dataset."""
    name: str
    num_cases: int
    cases: List[str]


class CaseInfo(BaseModel):
    """Information about a specific case."""
    case_id: str
    num_metrics: int
    num_timesteps: int
    metric_names: List[str]
    ground_truth: Optional[str]
    fault_type: Optional[str]


# Health Check

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ingd-backend"}


# Analysis Endpoints

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_dataset(request: AnalyzeRequest):
    """
    Run INGD analysis on a benchmark dataset case.

    Args:
        request: Analysis request with dataset and case_id

    Returns:
        AnalysisResponse with root causes and graphs
    """
    global _current_result

    try:
        loader = DataLoader()

        # Load dataset
        if request.dataset == "train_ticket":
            dataset = loader.load_train_ticket(request.case_id)
        elif request.dataset == "gaia":
            dataset = loader.load_gaia(request.case_id)
        elif request.dataset == "rcaeval":
            dataset = loader.load_rcaeval(request.case_id)
        elif request.dataset == "synthetic":
            # Generate synthetic data for testing (41 services to match pretrained weights)
            dataset = generate_synthetic_data(
                num_services=41,
                num_timesteps=200,
                seed=42
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown dataset: {request.dataset}")

        # Preprocess
        preprocessor = DataPreprocessor()
        processed_metrics = preprocessor.fit_transform(dataset.metrics)

        # Run analysis
        pipeline = get_pipeline()
        pipeline.config.scorer.top_k = request.top_k

        result = pipeline.analyze(
            data=processed_metrics,
            metric_names=dataset.metric_names
        )

        _current_result = result
        result_dict = result.to_dict()

        # Add ground truth to metadata if available
        result_dict["metadata"]["ground_truth"] = dataset.ground_truth
        result_dict["metadata"]["fault_type"] = dataset.fault_type

        return AnalysisResponse(
            success=True,
            root_causes=result_dict["root_causes"],
            causal_graph=result_dict["causal_graph"],
            hypergraph=result_dict["hypergraph"],
            metadata=result_dict["metadata"]
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/metrics", response_model=AnalysisResponse)
async def analyze_metrics(request: AnalyzeMetricsRequest):
    """
    Run INGD analysis on provided metrics data.

    Args:
        request: Request with metrics array

    Returns:
        AnalysisResponse with root causes and graphs
    """
    global _current_result

    try:
        # Convert to numpy array
        metrics = np.array(request.metrics, dtype=np.float32)

        if metrics.ndim != 2:
            raise HTTPException(status_code=400, detail="Metrics must be 2D array")

        # Generate metric names if not provided
        metric_names = request.metric_names
        if metric_names is None:
            metric_names = [f"metric_{i}" for i in range(metrics.shape[1])]

        # Preprocess
        preprocessor = DataPreprocessor()
        processed_metrics = preprocessor.fit_transform(metrics)

        # Run analysis
        pipeline = get_pipeline()
        pipeline.config.scorer.top_k = request.top_k

        result = pipeline.analyze(
            data=processed_metrics,
            metric_names=metric_names
        )

        _current_result = result
        result_dict = result.to_dict()

        return AnalysisResponse(
            success=True,
            root_causes=result_dict["root_causes"],
            causal_graph=result_dict["causal_graph"],
            hypergraph=result_dict["hypergraph"],
            metadata=result_dict["metadata"]
        )

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/upload")
async def analyze_upload(
    file: UploadFile = File(...),
    top_k: int = 5,
    timestamp_col: Optional[str] = None
):
    """
    Analyze an uploaded CSV file.

    Args:
        file: Uploaded CSV file
        top_k: Number of root causes to return
        timestamp_col: Name of timestamp column (optional)

    Returns:
        AnalysisResponse
    """
    global _current_result

    try:
        # Read CSV
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))

        # Extract timestamps if present
        timestamps = None
        if timestamp_col and timestamp_col in df.columns:
            timestamps = df[timestamp_col].values
            df = df.drop(columns=[timestamp_col])

        # Keep only numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df = df[numeric_cols]

        metrics = df.values.astype(np.float32)
        metric_names = df.columns.tolist()

        # Preprocess and analyze
        preprocessor = DataPreprocessor()
        processed_metrics = preprocessor.fit_transform(metrics)

        pipeline = get_pipeline()
        pipeline.config.scorer.top_k = top_k

        result = pipeline.analyze(
            data=processed_metrics,
            metric_names=metric_names
        )

        _current_result = result

        return JSONResponse(content={
            "success": True,
            **result.to_dict()
        })

    except Exception as e:
        logger.error(f"Upload analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Dataset Management

@router.get("/datasets", response_model=List[DatasetInfo])
async def list_datasets():
    """List available datasets and their cases."""
    loader = DataLoader()

    datasets = []
    for dataset_name in ["train_ticket", "gaia", "rcaeval"]:
        cases = loader.list_available_cases(dataset_name)
        datasets.append(DatasetInfo(
            name=dataset_name,
            num_cases=len(cases),
            cases=cases
        ))

    # Always include synthetic option
    datasets.append(DatasetInfo(
        name="synthetic",
        num_cases=1,
        cases=["default"]
    ))

    return datasets


@router.get("/datasets/{dataset}/cases/{case_id}", response_model=CaseInfo)
async def get_case_info(dataset: str, case_id: str):
    """Get information about a specific case."""
    try:
        loader = DataLoader()

        if dataset == "train_ticket":
            data = loader.load_train_ticket(case_id)
        elif dataset == "gaia":
            data = loader.load_gaia(case_id)
        elif dataset == "rcaeval":
            data = loader.load_rcaeval(case_id)
        elif dataset == "synthetic":
            data = generate_synthetic_data(num_services=41)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown dataset: {dataset}")

        return CaseInfo(
            case_id=case_id,
            num_metrics=data.num_metrics,
            num_timesteps=data.num_timesteps,
            metric_names=data.metric_names,
            ground_truth=data.ground_truth,
            fault_type=data.fault_type
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Result Retrieval

@router.get("/results/latest")
async def get_latest_result():
    """Get the most recent analysis result."""
    if _current_result is None:
        raise HTTPException(status_code=404, detail="No analysis has been run yet")

    return JSONResponse(content=_current_result.to_dict())


@router.get("/results/causal-graph")
async def get_causal_graph():
    """Get the causal graph from the latest analysis."""
    if _current_result is None:
        raise HTTPException(status_code=404, detail="No analysis has been run yet")

    result_dict = _current_result.to_dict()
    return JSONResponse(content=result_dict["causal_graph"])


@router.get("/results/hypergraph")
async def get_hypergraph():
    """Get the hypergraph from the latest analysis."""
    if _current_result is None:
        raise HTTPException(status_code=404, detail="No analysis has been run yet")

    return JSONResponse(content=_current_result.hypergraph.to_dict())


@router.get("/results/root-causes")
async def get_root_causes():
    """Get root causes from the latest analysis."""
    if _current_result is None:
        raise HTTPException(status_code=404, detail="No analysis has been run yet")

    return JSONResponse(content={
        "root_causes": [rc.to_dict() for rc in _current_result.root_causes]
    })


# Model Management

@router.get("/model/status")
async def get_model_status():
    """Get status of the INGD model."""
    global _pipeline

    return {
        "initialized": _pipeline is not None,
        "device": _pipeline.device if _pipeline else "not loaded",
        "config": _pipeline.config.model_dump() if _pipeline else None
    }


@router.post("/model/reset")
async def reset_model():
    """Reset the pipeline (clears cached results)."""
    global _pipeline, _current_result

    _pipeline = None
    _current_result = None

    return {"status": "reset", "message": "Pipeline and results cleared"}
