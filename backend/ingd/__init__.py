"""
INGD (Improved Neural Granger Discovery) Module

This module implements the causal discovery component for multi-modal
root cause analysis in microservice systems.

Components:
- Neural Granger: MLP-based causal structure learning with group-lasso sparsity
- Hierarchical Granger: Divide-and-conquer approach for scalability
- Hypergraph Constructor: Build hypergraphs capturing multi-way cascades
- Root Cause Scorer: Score and rank potential root causes
"""
from .neural_granger import NeuralGrangerTrainer
from .hierarchical_granger import HierarchicalGranger
from .hypergraph_constructor import HypergraphConstructor
from .root_cause_scorer import RootCauseScorer
from .pipeline import INGDPipeline

__all__ = [
    "NeuralGrangerTrainer",
    "HierarchicalGranger",
    "HypergraphConstructor",
    "RootCauseScorer",
    "INGDPipeline",
]
